"use strict";

/**
 * RadioProvider – Adapter zwischen der Unified Player API und dem
 * bestehenden StreamManager (FFmpeg-Pipeline).
 *
 * Wichtig: StreamManager und FFmpeg werden NICHT neu implementiert.
 * Dieser Provider bildet lediglich das Provider-Interface auf die
 * vorhandene Radio-Engine ab.
 *
 * Architektur:
 *   PlayerManager → RadioProvider → StreamManager → FFmpeg → PCM → AudioWorklet
 *
 * Der RadioProvider hört auf den eventBus (play / stop / metadata),
 * um seinen internen State aktuell zu halten, und meldet diesen an
 * den PlayerManager via updateProviderState().
 */

const eventBus   = require("../eventBus");
const streamManager = require("../audio/streamManager");
const playerManager = require("./PlayerManager");
const { PLAYER_STATES } = require("./PlayerManager");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("RadioProvider");

const PROVIDER_ID = "radio";

const SOURCE = Object.freeze({
  id:       "radio",
  name:     "Radio",
  provider: "FFmpeg",
  type:     "radio"
});

class RadioProvider {
  constructor() {
    this._state     = PLAYER_STATES.IDLE;
    this._title     = null;
    this._artist    = null;
    this._station   = null;

    // Bound handlers für sauberes Off()
    this._onPlay     = this._handlePlay.bind(this);
    this._onStop     = this._handleStop.bind(this);
    this._onMetadata = this._handleMetadata.bind(this);

    this._listening = false;
  }

  // ─────────────────────────────────────────────
  // Provider Interface
  // ─────────────────────────────────────────────

  /**
   * Startet die Radio-Wiedergabe.
   * @param {string} url  Stream-URL
   * @param {object} [station]  Station-Objekt (name, favicon, …)
   */
  async play(url, station) {
    if (!url) {
      logger.warn("play() ohne URL aufgerufen");
      return;
    }

    this._station = station || null;
    this._title   = null;
    this._artist  = null;

    this._reportState(PLAYER_STATES.LOADING, station);

    await streamManager.start(url, station);
  }

  /**
   * Radio unterstützt kein echtes Pause – wird als Stop behandelt.
   */
  async pause() {
    await this.stop();
  }

  async stop() {
    streamManager.stop();
  }

  /**
   * Volume wird im Renderer-Prozess (AudioWorklet / GainNode) gesetzt.
   * Im Main-Prozess gibt es keinen Lautstärke-State für Audio.
   */
  setVolume(_value) {
    // no-op im Main-Prozess; Lautstärke steuert playerService.js
  }

  /**
   * Gibt den aktuellen State-Snapshot zurück.
   */
  getState() {
    return {
      state:   this._state,
      title:   this._title,
      artist:  this._artist,
      artwork: this._station?.favicon || this._station?.logo || null,
      source:  SOURCE
    };
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /**
   * Aktiviert den Provider: EventBus-Listener einhängen.
   * Wird vom Application-Bootstrap aufgerufen.
   */
  activate() {
    if (this._listening) return;
    eventBus.on("play",     this._onPlay);
    eventBus.on("stop",     this._onStop);
    eventBus.on("metadata", this._onMetadata);
    this._listening = true;
    logger.info("RadioProvider aktiviert");
  }

  /**
   * Deaktiviert den Provider: eigene EventBus-Listener entfernen.
   * Entfernt NUR die eigenen Listener (kein removeAllListeners).
   */
  deactivate() {
    if (!this._listening) return;
    eventBus.off("play",     this._onPlay);
    eventBus.off("stop",     this._onStop);
    eventBus.off("metadata", this._onMetadata);
    this._listening = false;
    logger.info("RadioProvider deaktiviert");
  }

  // ─────────────────────────────────────────────
  // EventBus Handlers
  // ─────────────────────────────────────────────

  _handlePlay(data) {
    this._station = data?.station || null;
    this._title   = null;
    this._artist  = null;
    this._reportState(PLAYER_STATES.PLAYING, this._station);
  }

  _handleStop() {
    this._state   = PLAYER_STATES.STOPPED;
    this._title   = null;
    this._artist  = null;
    this._station = null;
    this._reportState(PLAYER_STATES.STOPPED, null);
  }

  _handleMetadata(metadata) {
    if (!metadata) return;
    this._title  = metadata.Song    || metadata.StreamTitle || null;
    this._artist = metadata.Artist  || null;
    this._reportState(PLAYER_STATES.PLAYING, this._station);
  }

  // ─────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────

  _reportState(state, station) {
    this._state = state;

    playerManager.updateProviderState(PROVIDER_ID, {
      state:   this._state,
      title:   this._title   || station?.name || null,
      artist:  this._artist  || null,
      artwork: station?.favicon || station?.logo || null,
      source:  SOURCE
    });
  }
}

const radioProvider = new RadioProvider();

module.exports = radioProvider;
module.exports.RadioProvider = RadioProvider;
module.exports.PROVIDER_ID   = PROVIDER_ID;
