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
 * Kanal-Set: stable | rc | beta | alpha
 * Farben kommen von ChannelMetadata.CHANNEL_METADATA.{alpha,beta,rc,stable}.color
 */

const { CHANNEL_METADATA } = require("./ChannelMetadata");
const UpdateChannel = require("./UpdateChannel");

// ── Channel-Konstanten (konsistent mit UpdateState / UpdateChannel) ──────────

const CHANNELS = Object.freeze({
  STABLE: "stable",
  RC: "rc",
  BETA: "beta",
  ALPHA: "alpha"
});

// ── SemVer-Release-Channel-Erkennung ────────────────────────────────────────

/**
 * Erkennt den Release-Kanal einer Versionszeichenkette.
 *
 * @param {string} version - SemVer-String, z. B. "1.0.7-alpha.1"
 * @returns {"alpha" | "beta" | "rc" | "stable"} der Release-Kanal
 *
 * @example
 *   resolveChannel("1.0.7-alpha.1") // "alpha"
 *   resolveChannel("1.0.7-beta.3")  // "beta"
 *   resolveChannel("1.0.8-rc.1")    // "rc"
 *   resolveChannel("1.0.7")         // "stable"
 *
 * @public
 */
function resolveChannel(version) {
  // Eine einzige Erkennungsquelle im Core (UpdateChannel).
  return UpdateChannel.detectChannelFromVersion(version);
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
