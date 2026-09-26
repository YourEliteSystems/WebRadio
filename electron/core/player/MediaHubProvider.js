"use strict";

/**
 * MediaHubProvider – Adapter zwischen der Unified Player API und dem
 * MediaHub YouTube Player.
 *
 * MediaHub läuft im Renderer-Prozess (YouTube IFrame API).
 * Dieser Provider dient als Core-Seite für die Kommunikation:
 *   - Wird bei Plugin-Start als Provider registriert
 *   - Aktiviert/Deaktiviert den Player-Zustand (setActiveProvider)
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
  id: "mediahub",
  name: "MediaHub",
  provider: "YouTube",
  type: "youtube"
});

// ─── Main-to-Renderer-Kommando-Kanal ──────────────────────────────────────────
// Jedes Kommando erhält eine eindeutige commandId, die Session-IDs und
// eine Status-Möglichkeit (callback/reply), damit veraltete Befehle verworfen
// werden können, wenn sie vor der IFrame-Bereitschaft eintreffen.
const COMMAND_EVENTS = Object.freeze({
  PLAY:       "player:command:play",
  PAUSE:      "player:command:pause",
  STOP:       "player:command:stop",
  SET_VOLUME: "player:command:setVolume"
});

class MediaHubProvider {
  constructor() {
    this._state      = PLAYER_STATES.IDLE;
    this._title      = null;
    this._artist     = null;
    this._artwork    = null;
    this._videoId    = null;
    this._commandId  = 0;

    // Bei schnellem Titelwechsel kann ein neuer Befehl eintreffen, bevor
    // das letzte verarbeitet wurde. Diese Referenz kennzeichnet den
    // aktuell laufenden Befehl; veraltete Befehle werden abgelehnt.
    this._activeCommandId = 0;

    // Cache für die zuletzt gesendete Video-ID, damit der Renderer
    // veraltete Kommandos ignorieren kann.
    this._lastCalledVideoId = null;

    // RequestObserver für die Status-Rückmeldung (optional, für Tests)
    this._requestObserver = null;

    // Zustand, ob der Provider bereits vom Zuständigkeitswechsel
    // (setActiveProvider) durchlaufen hat. Dieser Zustand ist für den
    // Reactiven Playflow (Mausklick auf YouTube-Titel im Renderer)
    // entscheidend: Ohne aktive Provider-Referenz wird updateProviderState
    // vom PlayerManager ignoriert.
    this._activated = false;
  }

  // ─────────────────────────────────────────────
  // Provider Interface
  // ─────────────────────────────────────────────

  /**
   * Aktiviert den Provider als aktiven Player.
   * Muss vor play() aufgerufen werden, damit PlayerManager den State
   * für diesen Provider zulässt.
   *
   * Wird vom Plugin-Runtime-Pfad (youtube/main.js) aufgerufen.
   */
  activate() {
    if (this._activated) {
      return;
    }
    this._activated = true;
    this._activeCommandId++;
    this._reportState(PLAYER_STATES.LOADING);
    logger.info(`MediaHub Provider aktiviert als aktiver Provider`);
  }

  /**
   * Deaktiviert den Provider. Der PlayerManager stoppt den Provider
   * und setzt den State zurück.
   *
   * Wird vom Plugin-Runtime-Pfad (youtube/main.js destroy()) aufgerufen.
   */
  deactivate() {
    this._videoId = null;
    this._title   = null;
    this._artist  = null;
    this._artwork = null;
    this._activated = false;
    this._activeCommandId++;
    this._reportState(PLAYER_STATES.STOPPED);
    logger.info(`MediaHub Provider deaktiviert`);
  }

  /**
   * Startet die Wiedergabe eines YouTube-Titels.
   *
   * @param {string} videoId  11-stellige YouTube-Video-ID
   * @param {object} metadata Titel/Metadaten für den State
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

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    // Sicherstellen, dass der Provider aktiv ist (damit updateProviderState
    // akzeptiert wird).
    this._ensureActivated();

    this._reportState(PLAYER_STATES.LOADING, { commandId });

    // Kommando nach Renderer ausgeben (synchron, bevor IFrame läuft)
    this._sendCommand(COMMAND_EVENTS.PLAY, {
      commandId,
      videoId,
      title: this._title,
      artist: this._artist,
      artwork: this._artwork,
      source: SOURCE
    });

    logger.info(`MediaHub play: ${videoId} (commandId=${commandId})`);
  }

  async pause() {
    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    this._reportState(PLAYER_STATES.PAUSED, { commandId });

    // Kommando nach Renderer ausgeben
    this._sendCommand(COMMAND_EVENTS.PAUSE, { commandId });

    logger.info(`MediaHub pause (commandId=${commandId})`);
  }

  async stop() {
    this._videoId = null;
    this._title   = null;
    this._artist  = null;
    this._artwork = null;

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    this._reportState(PLAYER_STATES.STOPPED, { commandId });

    // Kommando nach Renderer ausgeben (inkl. beendeter Session)
    this._sendCommand(COMMAND_EVENTS.STOP, { commandId, videoId: null });

    logger.info(`MediaHub stop (commandId=${commandId})`);
  }

  /**
   * Setzt die Lautstärke (0.0–1.0). Der Wert wird im Renderer
   * (YouTube IFrame API) gesetzt.
   *
   * Main-Prozess: nur State-Tracking + Kommando.
   */
  setVolume(value) {
    const vol = Math.max(0, Math.min(1, Number(value) || 0));
    if (Number.isNaN(vol)) return;

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    this._reportState(PLAYER_STATES.LOADING, { commandId, volume: vol });

    // Kommando nach Renderer ausgeben
    this._sendCommand(COMMAND_EVENTS.SET_VOLUME, {
      commandId,
      volume: vol
    });
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
      videoId: this._videoId,
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
   * @param {object} partialState  { state, title, artist, artwork, videoId, commandId? }
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

    // Bei Status-Rückmeldungen: nur mit einem CommandId versehen,
    // damit der Renderer veraltete Meldungen verwirft.
    const payload = {
      state:   this._state,
      title:   this._title,
      artist:  this._artist,
      artwork: this._artwork,
      source:  SOURCE
    };
    if (partialState.commandId) {
      payload.commandId = partialState.commandId;
    }

    this._reportState(this._state, payload);
  }

  // ─────────────────────────────────────────────
  // Intern
  // ─────────────────────────────────────────────

  /**
   * Sicherstellen, dass der Provider vom PlayerManager als aktiv
   * markiert ist. Wird bei jedem Spielbefehl (play/pause/stop/setVolume)
   * aufgerufen, damit ungeprüfte States vom Renderer nicht ignoriert
   * werden.
   */
  _ensureActivated() {
    if (this._activated) {
      return;
    }
    this._activated = true;

    const playerManager = require("./PlayerManager");
    if (playerManager.activeProviderId !== PROVIDER_ID) {
      playerManager.setActiveProvider(PROVIDER_ID);
    }
  }

  /**
   * Sendet ein Kommando an den MediaHub-Renderer.
   * Der Renderer hängt per IPC-EventListener auf diesen Kanal.
   *
   * @param {string} channel
   * @param {object} payload
   */
  _sendCommand(channel, payload) {
    const { ipcRenderer } = require("electron");
    const message = {
      channel:      payload.channel || channel,
      commandId:    payload.commandId,
      videoId:      payload.videoId || this._videoId,
      sessionId:    payload.sessionId || PROVIDER_ID,
      timestamp:    Date.now()
    };

    // Die tatsächliche Nachrichtenstruktur muss zum Architekturvertrag
    // passen. "command"-Kennung + Video-ID/Session + Status-Möglichkeit.
    ipcRenderer.send("mediahub:command", message);
  }

  /**
   * Ermöglicht es Tests, den Status extern zu beobachten,
   * anstatt nur an den PlayerManager zu senden.
   */
  setStatusObserver(observer) {
    this._requestObserver = observer;
  }

  _reportState(state, payload = {}) {
    const playerManager = require("./PlayerManager");
    playerManager.updateProviderState(PROVIDER_ID, {
      state:   state,
      title:   this._title,
      artist:  this._artist,
      artwork: this._artwork,
      source:  SOURCE,
      ...payload
    });

    // Optional: externe Statusbeobachter für Tests
    if (this._requestObserver && typeof this._requestObserver === "function") {
      try {
        this._requestObserver({ state, payload });
      } catch (err) {
        logger.warn(`MediaHubProvider StatusObserver Fehler: ${err.message}`);
      }
    }
  }
}

const mediaHubProvider = new MediaHubProvider();

module.exports = mediaHubProvider;
module.exports.MediaHubProvider = MediaHubProvider;
module.exports.PROVIDER_ID = PROVIDER_ID;
module.exports.COMMAND_EVENTS = COMMAND_EVENTS;
