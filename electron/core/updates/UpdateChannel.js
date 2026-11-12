"use strict";

/**
 * UpdateChannel.js
 *
 * Verantwortet die Zuordnung zwischen dem internen Channel-Namen
 * (stable / beta / rc / alpha) und der electron-updater-Konfiguration.
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
    return channel === CHANNELS.STABLE ||
        channel === CHANNELS.BETA ||
        channel === CHANNELS.RC ||
        channel === CHANNELS.ALPHA;
}

/**
 * Liefert die electron-updater-Konfiguration für den angegebenen
 * Channel. Reine Funktion, daher deterministisch testbar.
 *
 * Stable: nur finale Releases ueber den Standard-Feed (latest.yml).
 * Beta:   beta.yml, Pre-Releases erlaubt, nur Beta/Stable akzeptiert.
 * RC:     rc.yml, Pre-Releases erlaubt, nur RC/Stable akzeptiert.
 * Alpha:  alpha.yml, Pre-Releases erlaubt, nur Alpha/Stable akzeptiert.
 *
 * allowDowngrade ist absichtlich IMMER false: Eine aeltere Version darf
 * nicht als regulaeres Update angeboten werden. Ein bewusster manueller
 * Downgrade ist ein separater Vorgang (Neuinstallation) und nicht Teil
 * des Update-Flusses.
 *
 * Die Stage-Trennung wird zusaetzlich in getAllowedPreReleaseFilter()
 * abgesichert, weil electron-updater pro Feed nur allowPrerelease kennt.
 */
function getUpdaterConfig(channel, currentVersion) {
    if (!isValidChannel(channel)) {
        throw new Error(ERROR_CODES.INVALID_CHANNEL);
    }

    if (channel === CHANNELS.STABLE) {
        return {
            channel: null,            // "latest" = default
            allowPrerelease: false,
            allowDowngrade: false
        };
    }

    if (channel === CHANNELS.BETA) {
        return {
            channel: "beta",
            allowPrerelease: true,
            allowDowngrade: false
        };
    }

    if (channel === CHANNELS.RC) {
        return {
            channel: "rc",
            allowPrerelease: true,
            allowDowngrade: false
        };
    }

    // Alpha: eigener Feed, Pre-Releases erlaubt
    return {
        channel: "alpha",
        allowPrerelease: true,
        allowDowngrade: false
    };
}

/**
 * Liefert einen Filter-Callback, der von electron-updater
 * unterstützte Pre-Releases filtert. Erwartet wird eine
 * Funktion (release) => boolean, die true liefert, wenn die
 * Release akzeptabel ist.
 *
 * Stable-Filter:  nur finale Releases.
 * RC-Filter:      RC und finale Releases.
 * Beta-Filter:    Beta, RC und finale Releases (Promotion-Pfad).
 * Alpha-Filter:   alle Stages (Alpha, Beta, RC, final).
 *
 * Kein Kanal akzeptiert eine Stage, die frueher ist als er selbst:
 * Beta sieht niemals Alpha, RC niemals Beta/Alpha, Stable nur final.
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
    const stageOf = (version) => {
        if (typeof version !== "string") return null;
        const match = /-(alpha|beta|rc|nightly)(?:\.|$)/i.exec(version);
        return match ? match[1].toLowerCase() : null;
    };

    if (channel === CHANNELS.STABLE) {
        return (release) => !isPrerelease(release?.version);
    }

    // Rang der Stages: alpha < beta < rc < stable(final).
    const stageRank = { alpha: 0, beta: 1, rc: 2, nightly: 0 };
    const channelRank = channel === CHANNELS.ALPHA
        ? 0
        : channel === CHANNELS.BETA
            ? 1
            : 2; // rc

    return (release) => {
        const stage = stageOf(release?.version);
        // Finale Releases sind in jedem Kanal erlaubt.
        if (stage === null) return true;
        return (stageRank[stage] ?? 0) >= channelRank;
    };
}

/**
 * Ermittelt den "kanonischen" Channel aus der aktuellen App-Version.
 * Wird für die initiale Anzeige (Beta-Badge) und für die Settings-
 * Default-Heuristik verwendet.
 */
function detectChannelFromVersion(version) {
    if (isPrerelease(version)) {
        if (/-alpha(\.|$)/i.test(version)) {
            return CHANNELS.ALPHA;
        }
        if (/-beta(\.|$)/i.test(version)) {
            return CHANNELS.BETA;
        }
        if (/-rc(\.|$)/i.test(version)) {
            return CHANNELS.RC;
        }
        // Unbekannte Pre-Release-Stages (z. B. nightly) bleiben
        // Beta-kompatibel, werden aber keinem eigenen Kanal zugeordnet.
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
 * @returns {string} Channel (stable|beta|rc|alpha)
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
