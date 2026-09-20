"use strict";

/**
 * MediaHubProvider – Adapter zwischen der Unified Player API und dem
 * MediaHub YouTube Player.
 *
 * MediaHub läuft im Renderer-Prozess (YouTube IFrame API).
 * Dieser Provider dient als Core-Seite für die Kommunikation:
 *   - Wird bei Plugin-Start als Provider registriert
 *   - Empfängt State-Updates vom Renderer via IPC
 *   - Leitet Controls an den Renderer weiter
 *
 * Architektur:
 *   PlayerManager → MediaHubProvider → IPC → MediaHub (Renderer) → YouTube
 *
 * Wichtige Garantien:
 *  - MediaHub-Fehler beeinflussen NIEMALS den Radio-Playback
 *  - Provider kann aktiv/deaktiviert werden (Plugin-Start/Stop)
 *  - Kein direkter Renderer-Code im Main-Prozess
 */

const { PLAYER_STATES } = require("./PlayerManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("MediaHubProvider");

const PROVIDER_ID = "mediahub";

const SOURCE = Object.freeze({
  id:       "mediahub",
  name:     "MediaHub",
  provider: "YouTube",
  type:     "youtube"
});

class MediaHubProvider {
  constructor() {
    this._state      = PLAYER_STATES.IDLE;
    this._title      = null;
    this._artist     = null;
    this._artwork    = null;
    this._videoId    = null;
  }

  // ─────────────────────────────────────────────
  // Provider Interface
  // ─────────────────────────────────────────────

  /**
   * Wird vom PlayerManager aufgerufen.
   * Die eigentliche YouTube-Wiedergabe läuft im Renderer über die YouTube IFrame API.
   * Dieser Provider markiert nur den State als loading.
   */
  async play(videoId, metadata = {}) {
    if (!videoId) {
      logger.warn("play() ohne videoId aufgerufen");
      return;
    }

    this._videoId = videoId;
    this._title   = metadata.title || null;
    this._artist  = metadata.artist || null;
    this._artwork = metadata.artwork || null;

    this._reportState(PLAYER_STATES.LOADING);

    // Die eigentliche Wiedergabe-Steuerung läuft im Renderer
    // Über IPC wird dem MediaHub-Plugin signalisiert, zu starten
    logger.info(`MediaHub play: ${videoId}`);
  }

  async pause() {
    this._reportState(PLAYER_STATES.PAUSED);
    // Renderer wird über IPC informiert
  }

  async stop() {
    this._videoId = null;
    this._title   = null;
    this._artist  = null;
    this._artwork = null;
    this._reportState(PLAYER_STATES.STOPPED);
    // Renderer wird über IPC informiert
  }

  /**
   * Volume wird im Renderer (YouTube IFrame API) gesetzt.
   * Im Main-Prozess nur State-Tracking.
   */
  setVolume(_value) {
    // Volume-Steuerung läuft im Renderer
  }

  /**
   * Gibt den aktuellen State-Snapshot zurück.
   */
  getState() {
    return {
      state:   this._state,
      title:   this._title,
      artist:  this._artist,
      artwork: this._artwork,
      source:  SOURCE
    };
  }

  // ─────────────────────────────────────────────
  // External State Updates (vom Renderer)
  // ─────────────────────────────────────────────

  /**
   * Wird vom MediaHub-Plugin im Renderer aufgerufen (via IPC),
   * um State-Änderungen zu melden (z.B. YouTube Events).
   *
   * @param {object} partialState  { state, title, artist, artwork, videoId }
   */
  updateFromRenderer(partialState) {
    if (partialState.state) {
      this._state = partialState.state;
    }
    if (partialState.title !== undefined) {
      this._title = partialState.title;
    }
    if (partialState.artist !== undefined) {
      this._artist = partialState.artist;
    }
    if (partialState.artwork !== undefined) {
      this._artwork = partialState.artwork;
    }
    if (partialState.videoId !== undefined) {
      this._videoId = partialState.videoId;
    }

    this._reportState(this._state);
  }

  // ─────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────

  _reportState(state) {
    const playerManager = require("./PlayerManager");
    playerManager.updateProviderState(PROVIDER_ID, {
      state:   state,
      title:   this._title,
      artist:  this._artist,
      artwork: this._artwork,
      source:  SOURCE
    });
  }
}

const mediaHubProvider = new MediaHubProvider();

module.exports = mediaHubProvider;
module.exports.MediaHubProvider = MediaHubProvider;
module.exports.PROVIDER_ID = PROVIDER_ID;
