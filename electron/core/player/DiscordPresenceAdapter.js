"use strict";

/**
 * DiscordPresenceAdapter – Verbindet den Unified Player State mit der
 * bestehenden DiscordRichPresence-Implementierung.
 *
 * Architektur:
 *   PlayerManager.subscribe() → DiscordPresenceAdapter → DiscordRichPresence
 *
 * Wichtige Garantien:
 *  - Discord-Fehler beeinflussen NIEMALS den Playback
 *  - Kein direkter Discord-Code in MediaHub oder anderen Plugins
 *  - Discord ist optional: nicht installiert / deaktiviert / Fehler → Player läuft weiter
 *  - Sauberes Unsubscribe ohne removeAllListeners()
 */

const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("DiscordPresenceAdapter");

class DiscordPresenceAdapter {
  constructor() {
    this._unsubscribe      = null;
    this._playerManager    = null;
    this._discordPresence  = null;
    this._initialized      = false;
  }

  /**
   * Initialisiert den Adapter.
   * Wird nach initializeServices() in Application.js aufgerufen.
   *
   * @param {object} playerManager     PlayerManager-Singleton
   * @param {object} discordPresence   DiscordRichPresence-Singleton
   */
  initialize(playerManager, discordPresence) {
    if (this._initialized) {
      logger.warn("DiscordPresenceAdapter bereits initialisiert");
      return;
    }

    this._playerManager   = playerManager;
    this._discordPresence = discordPresence;

    // Player-State abonnieren
    this._unsubscribe = playerManager.subscribe((state) => {
      this._onPlayerStateChanged(state);
    });

    this._initialized = true;
    logger.info("DiscordPresenceAdapter initialisiert");
  }

  /**
   * Sauberes Herunterfahren – entfernt nur den eigenen Subscriber.
   */
  async shutdown() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._initialized = false;
    logger.info("DiscordPresenceAdapter heruntergefahren");
  }

  // ─────────────────────────────────────────────
  // State Handler
  // ─────────────────────────────────────────────

  _onPlayerStateChanged(state) {
    // Alle Discord-Operationen sind try/catch gekapselt:
    // Kein Fehler soll nach außen propagieren.
    try {
      if (!this._discordPresence) return;

      const { state: playState } = state;

      if (playState === "playing") {
        this._updateActivity(state);
      } else if (playState === "stopped" || playState === "idle") {
        this._clearActivity();
      }
      // loading / paused / error → keine Discord-Aktion
    } catch (err) {
      logger.error(`Fehler in _onPlayerStateChanged: ${err.message}`);
    }
  }

  _updateActivity(state) {
    try {
      const { title, artist, source } = state;

      // Discord-Activity-Objekt aus dem generischen Player-State aufbauen
      const stationLike = {
        name: this._buildSourceLabel(source)
      };
      const metadata = {};

      if (title)  metadata.Song = title;
      if (artist) metadata.Artist = artist;

      // StreamTitle als Fallback
      if (title && !artist) {
        metadata.StreamTitle = title;
      }

      this._discordPresence.setActivity(stationLike, metadata);
    } catch (err) {
      logger.error(`Fehler beim Setzen der Discord-Activity: ${err.message}`);
    }
  }

  _clearActivity() {
    try {
      this._discordPresence.clearActivity();
    } catch (err) {
      logger.error(`Fehler beim Löschen der Discord-Activity: ${err.message}`);
    }
  }

  /**
   * Baut das Source-Label für Discord-Anzeige auf.
   * Beispiele:
   *   { name: "Radio", type: "radio" }           → "Radio"
   *   { name: "MediaHub", provider: "YouTube" }  → "MediaHub · YouTube"
   */
  _buildSourceLabel(source) {
    if (!source) return "WebRadio";
    if (source.provider && source.provider !== source.name) {
      return `${source.name} · ${source.provider}`;
    }
    return source.name || "WebRadio";
  }
}

module.exports = new DiscordPresenceAdapter();
module.exports.DiscordPresenceAdapter = DiscordPresenceAdapter;
