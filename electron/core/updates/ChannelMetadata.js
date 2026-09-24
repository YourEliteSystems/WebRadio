"use strict";

/**
 * ChannelMetadata.js
 *
 * Zentrale, Core-seitige Definition aller UI-relevanten
 * Update-Channel-Metadaten.
 *
 * Zuständigkeiten:
 *   - Channel-ID
 *   - Label
 *   - Farbwert
 *   - Icon (inline SVG)
 *   - Beschreibung
 *   - Anzeigereihenfolge
 *
 * Nicht Zuständigkeiten:
 *   - Channel-Erkennung
 *   - Channel-Validierung
 *   - Updater-Konfiguration
 *   - SemVer-Logik
 *   - electron-updater-Kanäle
 *
 * Kanal-Erkennung und -Validierung bleiben ausschließlich
 * in UpdateChannel.js / UpdateState.js.
 *
 * Dieses Modul definiert ausschließlich statische Metadaten
 * und ist vollständig serialisierbar.
 */

const CHANNEL_METADATA = Object.freeze({
    alpha: Object.freeze({
        id: "alpha",
        label: "Alpha",
        shortLabel: "Alpha",
        color: "#a855f7", // Violet/Purple (werden im Core und in der UI zentriert)
        icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><circle cx="12" cy="10" r="3"/></svg>',
        description: "Experimentelle Vorab-Builds vor dem Beta-Kanal.",
        order: 0
    }),

    beta: Object.freeze({
        id: "beta",
        label: "Beta",
        shortLabel: "Beta",
        color: "#f59e0b",
        icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V15h-2v1.93A8 8 0 0 1 4.07 11H6V9H4.07A8 8 0 0 1 11 4.07V6h2V4.07A8 8 0 0 1 19.93 9H18v2h1.93A8 8 0 0 1 13 16.93z"/></svg>',
        description: "Frühe Versionen mit neuen Funktionen, aber ohne volle Stabilität.",
        order: 1
    }),

    stable: Object.freeze({
        id: "stable",
        label: "Stable",
        shortLabel: "Stable",
        color: "#22c55e",
        icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        description: "Offiziell veröffentlichte, stabile Versionen.",
        order: 2
    })
});

const CHANNEL_IDS = Object.freeze([
    CHANNEL_METADATA.alpha.id,
    CHANNEL_METADATA.beta.id,
    CHANNEL_METADATA.stable.id
]);

/**
 * Liefert die Metadaten für einen einzelnen Channel.
 *
 * @param {string} channel - Channel-ID
 * @returns {object|null}
 */
function getUpdateChannelMetadata(channel) {
    if (typeof channel !== "string") {
        return null;
    }
    if (!CHANNEL_METADATA[channel]) {
        return null;
    }
    return cloneChannelMetadata(CHANNEL_METADATA[channel]);
}

/**
 * Liefert die Metadaten aller bekannten Channels.
 *
 * Die Reihenfolge entspricht der internen Anzeigereihenfolge.
 *
 * @returns {Array<object>}
 */
function getAllUpdateChannelMetadata() {
    return [
        cloneChannelMetadata(CHANNEL_METADATA.alpha),
        cloneChannelMetadata(CHANNEL_METADATA.beta),
        cloneChannelMetadata(CHANNEL_METADATA.stable)
    ];
}

/**
 * Erzeugt eine tiefe Kopie eines einzelnen
 * Channel-Metadata-Objekts.
 *
 * Wichtig: Damit erhält der Aufrufer keinen direkten
 * Verweis auf das interne Objekt.
 */
function cloneChannelMetadata(metadata) {
    return Object.freeze({
        id: metadata.id,
        label: metadata.label,
        shortLabel: metadata.shortLabel,
        color: metadata.color,
        icon: metadata.icon,
        description: metadata.description,
        order: metadata.order
    });
}

/**
 * Prüft, ob ein Channel-ID einem bekannten Kanal entspricht.
 *
 * Hinweis: Dies ist KEIN Ersatz für UpdateChannel.isValidChannel().
 * UpdateChannel definiert die semantisch valide Channel-Menge.
 * Diese Funktion prüft nur den Metadaten-Bezug.
 */
function hasChannelMetadata(channel) {
    if (typeof channel !== "string") {
        return false;
    }
    return !!CHANNEL_METADATA[channel];
}

module.exports = {
    CHANNEL_METADATA,
    CHANNEL_IDS,
    getUpdateChannelMetadata,
    getAllUpdateChannelMetadata,
    hasChannelMetadata
};
