"use strict";

/**
 * UpdateChannel.js
 *
 * Verantwortet die Zuordnung zwischen dem internen Channel-Namen
 * (stable / beta) und der electron-updater-Konfiguration.
 *
 * Keine I/O, keine Auto-Updater-Aufrufe – nur reine Konfigurations-
 * abbildung. Wird sowohl im UpdateManager als auch in den Tests
 * verwendet.
 */

const { CHANNELS, ERROR_CODES } = require("./UpdateState");

/**
 * Liefert die zuverlässige Information, ob eine gegebene Version
 * eine Pre-Release-Version ist.
 *
 * "1.0.6-beta.2"      -> true
 * "1.0.6"             -> false
 * "1.0.6-rc.1"        -> true
 * "1.0.7-alpha.3"     -> true
 * "1.0.0-nightly.42"  -> true
 *
 * Akzeptiert optional ein v-Präfix und vergleicht case-insensitive.
 */
function isPrerelease(version) {
    if (typeof version !== "string") return false;
    return /-(alpha|beta|rc|nightly)(\.\d+)?/i.test(version);
}

/**
 * Liefert die "stabile Hauptversion" (major.minor.patch) einer
 * beliebigen SemVer-Version. Pre-Release-Suffixe werden entfernt.
 *
 * "1.0.6-beta.2" -> "1.0.6"
 * "1.0.6"        -> "1.0.6"
 */
function getStableBase(version) {
    if (typeof version !== "string") return "";
    return version.replace(/-(alpha|beta|rc|nightly).*$/i, "");
}

/**
 * Validiert einen Channel-Namen.
 *
 * @param {string} channel
 * @returns {boolean}
 */
function isValidChannel(channel) {
    return channel === CHANNELS.STABLE || channel === CHANNELS.BETA || channel === CHANNELS.ALPHA;
}

/**
 * Liefert die electron-updater-Konfiguration für den angegebenen
 * Channel. Reine Funktion, daher deterministisch testbar.
 *
 * Stable: nur stable Releases.
 *   channel       = null  (electron-updater Standard)
 *   allowPrerelease = false
 *   allowDowngrade = false (interner Wechsel bleibt aber möglich)
 *
 * Beta: stable + pre-releases, die NICHT alpha sind.
 *   channel       = "beta"
 *   allowPrerelease = true
 *   allowDowngrade = true (Beta-User können jederzeit auf Stable zurück)
 *
 * Alpha: alle pre-releases einschließlich alpha.
 *   channel       = "alpha"
 *   allowPrerelease = true
 *   allowDowngrade = true (Alpha-User können jederzeit auf Stable/Beta zurück)
 *
 * WICHTIG: allowPrerelease ist KEIN globaler Schalter. Für Alpha-Channel
 * werden alle Pre-Releases akzeptiert. Für Beta werden alpha-Releases
 * zusätzlich über Filter ausgeschlossen.
 */
function getUpdaterConfig(channel, currentVersion) {
    if (!isValidChannel(channel)) {
        throw new Error(ERROR_CODES.INVALID_CHANNEL);
    }

    if (channel === CHANNELS.STABLE) {
        // Wenn die aktuell installierte Version ein Pre-Release (z.B. Beta/Alpha)
        // ist und der Benutzer auf Stable wechselt, muss allowDowngrade
        // aktiv sein, damit electron-updater auch eine Version akzeptiert,
        // die semver-seitig kleiner als die Beta-Version ist (z.B. 1.0.6-beta.2 -> 1.0.5).
        const allowDowngrade = currentVersion ? isPrerelease(currentVersion) : false;
        return {
            channel: null,            // "latest" = default
            allowPrerelease: false,
            allowDowngrade: allowDowngrade
        };
    }

    if (channel === CHANNELS.BETA) {
        // Beta: stable + pre-releases außer alpha
        const allowDowngrade = currentVersion ? isPrerelease(currentVersion) : false;
        return {
            channel: "beta",
            allowPrerelease: true,
            allowDowngrade: allowDowngrade
        };
    }

    // Alpha: alle pre-releases einschließlich alpha
    const allowDowngrade = currentVersion ? isPrerelease(currentVersion) : false;
    return {
        channel: "alpha",
        allowPrerelease: true,
        allowDowngrade: allowDowngrade
    };
}

/**
 * Liefert einen Filter-Callback, der von electron-updater
 * unterstützte Pre-Releases filtert. Erwartet wird eine
 * Funktion (release) => boolean, die true liefert, wenn die
 * Release akzeptabel ist.
 *
 * Stable-Filter:  alles ablehnen, was Pre-Release ist.
 * Beta-Filter:    alle Pre-Releases außer "alpha" erlauben.
 * Alpha-Filter:   alle Pre-Releases erlauben (inklusive alpha).
 *
 * Da electron-updater 6.x keinen direkten "includePrerelease"-Hook
 * hat, sondern nur allowPrerelease, prüfen wir die Pre-Release-
 * Erkennung im AFTER_CHECK-FOR-UPDATES-Event. Wenn dort eine
 * alpha-Version zurückkommt und der User im Beta-Channel ist,
 * wird sie verworfen.
 *
 * Für v1 genügt die semantische Korrektheit: ein Stable-User
 * bekommt durch allowPrerelease=false GARANTIERT keine Pre-Releases.
 */
function getAllowedPreReleaseFilter(channel) {
    if (channel === CHANNELS.STABLE) {
        return (release) => !isPrerelease(release?.version);
    }
    if (channel === CHANNELS.BETA) {
        // Beta: alles außer alpha erlauben
        return (release) => {
            const v = release?.version;
            if (typeof v !== "string") return true;
            return !/-alpha(\.|$)/i.test(v);
        };
    }
    // Alpha: alles erlauben
    return (release) => true;
}

/**
 * Ermittelt den "kanonischen" Channel aus der aktuellen App-Version.
 * Wird für die initiale Anzeige (Beta-Badge) und für die Settings-
 * Default-Heuristik verwendet.
 */
function detectChannelFromVersion(version) {
    if (isPrerelease(version)) {
        // Innerhalb der Pre-Releases unterscheiden wir zusätzlich.
        // v1 kennt Stable, Beta und Alpha als separate Channels.
        if (/-alpha(\.|$)/i.test(version)) {
            return CHANNELS.ALPHA;
        }
        if (/-beta(\.|$)/i.test(version)) {
            return CHANNELS.BETA;
        }
        // rc / nightly -> wir behandeln sie als Beta-kompatibel,
        // aber nur, wenn der Benutzer explizit Beta aktiviert hat.
        return CHANNELS.BETA;
    }
    return CHANNELS.STABLE;
}

/**
 * Zentrale Funktion zur Ermittlung des aktuellen Update-Channel.
 * Berücksichtigt User-Settings, aktuelle Version und Fallback-Logik.
 * 
 * Priorität:
 * 1. Explizite User-Settings (aus SettingsManager)
 * 2. Version-basierte Detection (für Default)
 * 3. Stable als absoluter Fallback
 * 
 * @param {object} settings - SettingsManager Konfiguration
 * @param {string} currentVersion - Aktuelle App-Version
 * @returns {string} Channel (stable|beta|alpha)
 */
function getUpdateChannel(settings, currentVersion) {
    // 1. User-Settings haben höchste Priorität
    if (settings && typeof settings === "object") {
        const userChannel = settings.updateChannel ||
            (settings.updates && typeof settings.updates === "object" ? settings.updates.channel : null) ||
            settings["updates.channel"] ||
            settings.channel;
        if (isValidChannel(userChannel)) {
            return userChannel;
        }
    }
    
    // 2. Version-basierte Detection
    if (currentVersion) {
        return detectChannelFromVersion(currentVersion);
    }
    
    // 3. Absoluter Fallback
    return CHANNELS.STABLE;
}

module.exports = {
    isPrerelease,
    getStableBase,
    isValidChannel,
    getUpdaterConfig,
    getAllowedPreReleaseFilter,
    detectChannelFromVersion,
    getUpdateChannel
};
