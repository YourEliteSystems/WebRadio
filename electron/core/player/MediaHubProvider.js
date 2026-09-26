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

/**
 * IPC-Kanal (Main → Renderer), auf dem die Kommandos versendet werden.
 * Der Renderer abonniert diesen Kanal über window.mediaHubPlayerAPI.onCommand().
 */
const COMMAND_CHANNEL = "mediahub:command";

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
    // Reaktiven Playflow (Mausklick auf YouTube-Titel im Renderer)
    // entscheidend: Ohne aktive Provider-Referenz wird updateProviderState
    // vom PlayerManager ignoriert.
    this._activated = false;

    // Zugriff auf das Hauptfenster (Dependency Injection aus der
    // Application-Initialisierung). Der Main-Prozess darf KEINEN
    // ipcRenderer verwenden – der Versand läuft ausschließlich über
    // mainWindow.webContents.send().
    this._windowManager = null;
  }

  /**
   * Injection der zentralen Window-Verwaltung.
   * Wird von Application.initializePlayer() aufgerufen.
   *
   * @param {object|null} windowManager  Instanz mit getMainWindow()
   */
  setWindowManager(windowManager) {
    this._windowManager = windowManager || null;
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
   * Ohne videoId wird die zuletzt gespielte Video-ID fortgesetzt
   * (z.B. globaler Play-Button, wenn zuvor pausiert wurde).
   *
   * @param {string} videoId  11-stellige YouTube-Video-ID
   * @param {object} metadata Titel/Metadaten für den State
   */
  async play(videoId, metadata = {}) {
    metadata = metadata || {};
    const targetVideoId = videoId || this._videoId;
    if (!targetVideoId) {
      logger.warn("play() ohne videoId und ohne zuletzt gespielte Video-ID aufgerufen");
      return false;
    }

    this._videoId = targetVideoId;
    if (videoId) {
      // Explizite (ggf. neue) Video-ID → Metadaten neu setzen
      this._title   = metadata.title   || null;
      this._artist  = metadata.artist  || null;
      this._artwork = metadata.artwork || null;
    } else {
      // Fortsetzung der zuletzt gespielten Video-ID → Metadaten beibehalten,
      // sofern nicht explizit überschrieben.
      if (metadata.title   !== undefined) this._title   = metadata.title;
      if (metadata.artist  !== undefined) this._artist  = metadata.artist;
      if (metadata.artwork !== undefined) this._artwork = metadata.artwork;
    }

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    // Sicherstellen, dass der Provider aktiv ist (damit updateProviderState
    // akzeptiert wird).
    this._ensureActivated();

    // Kommando nach Renderer ausgeben (synchron, bevor IFrame läuft)
    const sent = this._sendCommand(COMMAND_EVENTS.PLAY, {
      commandId,
      videoId: targetVideoId,
      title: this._title,
      artist: this._artist,
      artwork: this._artwork,
      source: SOURCE
    });

    // Status nur melden, wenn das Kommando tatsächlich versendet werden
    // konnte – der Renderer meldet den ausgeführten Zustand danach.
    if (sent) {
      this._reportState(PLAYER_STATES.LOADING, { commandId });
    }

    logger.info(`MediaHub play: ${targetVideoId} (commandId=${commandId}, sent=${sent})`);
    return sent;
  }

  async pause() {
    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    const sent = this._sendCommand(COMMAND_EVENTS.PAUSE, { commandId });

    if (sent) {
      this._reportState(PLAYER_STATES.PAUSED, { commandId });
    }

    logger.info(`MediaHub pause (commandId=${commandId}, sent=${sent})`);
    return sent;
  }

  async stop() {
    this._videoId = null;
    this._title   = null;
    this._artist  = null;
    this._artwork = null;

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    const sent = this._sendCommand(COMMAND_EVENTS.STOP, { commandId, videoId: null });

    if (sent) {
      this._reportState(PLAYER_STATES.STOPPED, { commandId });
    }

    logger.info(`MediaHub stop (commandId=${commandId}, sent=${sent})`);
    return sent;
  }

  /**
   * Setzt die Lautstärke (0.0–1.0). Der Wert wird im Renderer
   * (YouTube IFrame API) gesetzt.
   *
   * Main-Prozess: nur State-Tracking + Kommando. Der globale
   * Lautstärke-State wird bereits von PlayerManager.setVolume()
   * verwaltet – hier wird bewusst KEIN zusätzlicher Status gemeldet,
   * damit sich die Wiedergabe nicht in "loading" verschiebt.
   */
  setVolume(value) {
    const vol = Math.max(0, Math.min(1, Number(value) || 0));
    if (Number.isNaN(vol)) return false;

    this._activeCommandId++;
    const commandId = this._activeCommandId;

    this._ensureActivated();

    const sent = this._sendCommand(COMMAND_EVENTS.SET_VOLUME, {
      commandId,
      volume: vol
    });

    if (!sent) {
      logger.warn("setVolume: Kommando konnte nicht versendet werden");
    }
    return sent;
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
   * Liefert das Hauptfenster, sofern es existiert und nicht zerstört ist.
   * @returns {Electron.BrowserWindow|null}
   */
  _getWindow() {
    try {
      if (!this._windowManager || typeof this._windowManager.getMainWindow !== "function") {
        return null;
      }
      const win = this._windowManager.getMainWindow();
      if (!win || typeof win.isDestroyed !== "function" || win.isDestroyed()) {
        return null;
      }
      const wc = win.webContents;
      if (!wc || typeof wc.send !== "function") return null;
      if (typeof wc.isDestroyed === "function" && wc.isDestroyed()) return null;
      return win;
    } catch (err) {
      logger.warn(`Fensterzugriff fehlgeschlagen: ${err.message}`);
      return null;
    }
  }

  /**
   * Sendet ein Kommando an den MediaHub-Renderer.
   *
   * Der Versand erfolgt IMMER über mainWindow.webContents.send() – der
   * Main-Prozess hat keinen ipcRenderer und darf auch keinen verwenden.
   *
   * @param {string} channel   Eintrag aus COMMAND_EVENTS
   * @param {object} payload   Zusätzliche Nutzdaten (commandId, volume, …)
   * @returns {boolean} true, wenn die Nachricht an den Renderer übergeben wurde
   */
  _sendCommand(channel, payload = {}) {
    if (!Object.values(COMMAND_EVENTS).includes(channel)) {
      logger.warn(`Unbekannter Kommando-Kanal abgelehnt: ${String(channel)}`);
      return false;
    }

    const message = {
      channel,
      commandId: payload.commandId,
      videoId:   payload.videoId !== undefined ? payload.videoId : this._videoId,
      title:     payload.title   !== undefined ? payload.title   : this._title,
      artist:    payload.artist  !== undefined ? payload.artist  : this._artist,
      artwork:   payload.artwork !== undefined ? payload.artwork : this._artwork,
      source:    payload.source  || SOURCE,
      sessionId: payload.sessionId || PROVIDER_ID,
      timestamp: Date.now()
    };
    if (payload.volume !== undefined) {
      message.volume = payload.volume;
    }

    const win = this._getWindow();
    if (!win) {
      logger.warn(`Kommando "${channel}" nicht gesendet: kein verfügbares Hauptfenster`);
      return false;
    }

    try {
      win.webContents.send(COMMAND_CHANNEL, message);
      return true;
    } catch (err) {
      logger.warn(`Kommando "${channel}" nicht gesendet: ${err.message}`);
      return false;
    }
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
module.exports.COMMAND_CHANNEL = COMMAND_CHANNEL;
