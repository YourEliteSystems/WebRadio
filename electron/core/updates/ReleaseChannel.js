"use strict";

/**
 * ReleaseChannel.js
 *
 * Zentrale Release-Kanal-Erkennung für WebRadio.
 *
 * Zuständigkeiten:
 *   - SemVer-Release-Channel-Erkennung aus einer Versionszeichenkette
 *     (z. B. "1.0.7-alpha.1" -> channel: "alpha")
 *   - Einheitliche resolution für MainWindow, Settings, Update-System
 *     und Renderer-Indikatoren
 *
 * Nicht Zuständigkeiten (an andere Module delegiert):
 *   - electron-updater-Konfiguration (UpdateChannel.js)
 *   - UI-Metadaten / Farben / Icons (ChannelMetadata.js)
 *   - Channel-Validierung / Update-State (UpdateState.js)
 *
 * Kanal-Set: stable | beta | alpha
 * Farben kommen von ChannelMetadata.CHANNEL_METADATA.{alpha,beta,stable}.color
 */

const { CHANNEL_METADATA } = require("./ChannelMetadata");

// ── Channel-Konstanten (konsistent mit UpdateState / UpdateChannel) ──────────

const CHANNELS = Object.freeze({
  STABLE: "stable",
  BETA: "beta",
  ALPHA: "alpha"
});

// ── SemVer-Release-Channel-Erkennung ────────────────────────────────────────

/**
 * Erkennt den Release-Kanal einer Versionszeichenkette.
 *
 * @param {string} version - SemVer-String, z. B. "1.0.7-alpha.1"
 * @returns {"alpha" | "beta" | "stable"} der Release-Kanal
 *
 * @example
 *   resolveChannel("1.0.7-alpha.1") // "alpha"
 *   resolveChannel("1.0.7-beta.2")  // "beta"
 *   resolveChannel("1.0.7")         // "stable"
 *
 * @public
 */
function resolveChannel(version) {
  if (typeof version !== "string") {
    return CHANNELS.STABLE;
  }

  // Case-insensitive Prüfung, um v1.0.7-Beta usw. abzudecken.
  const v = version.trim();
  if (!v) {
    return CHANNELS.STABLE;
  }

  // Prerelease-Filter
  if (/-alpha(\.|$)/i.test(v)) {
    return CHANNELS.ALPHA;
  }
  if (/-beta(\.|$)/i.test(v)) {
    return CHANNELS.BETA;
  }

  // Falls der String explizit ein stabil-markiertes Prerelease ist (z. B. "v1.0.7-stable"),
  // wird "stable" zurückgegeben. Sonst ist die Version ohne Prerelease → stable.
  if (/^v?1\.0\.7(-.*)?$/i.test(v)) {
    return CHANNELS.STABLE;
  }

  return CHANNELS.STABLE;
}

/**
 * Löst eine Versionszeichenkette vollständig auf.
 *
 * @param {string} version
 * @returns {{ channel: string, label: string, shortLabel: string, color: string, version: string }}
 */
function resolve(version) {
  if (typeof version !== "string") {
    version = "";
  }

  const channel = resolveChannel(version);

  const meta = CHANNEL_METADATA[channel];
  return {
    channel,
    label: meta ? meta.label : "Stable",
    shortLabel: meta ? meta.shortLabel : "Stable",
    color: meta ? meta.color : CHANNEL_METADATA.stable.color,
    version
  };
}

/**
 * Prüft, ob eine Version eine Pre-Release ist.
 *
 * @param {string} version
 * @returns {boolean}
 */
function isPrerelease(version) {
  if (typeof version !== "string") {
    return false;
  }
  return /-(alpha|beta|rc|nightly)(\.|$)/i.test(version);
}

module.exports = {
  CHANNELS,
  resolveChannel,
  resolve,
  isPrerelease
};
