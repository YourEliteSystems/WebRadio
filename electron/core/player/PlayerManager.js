"use strict";

const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PlayerManager");

/**
 * Mögliche Player-Zustände.
 * Serialisierbar, stabil – andere Komponenten dürfen gegen diese Werte prüfen.
 */
const PLAYER_STATES = Object.freeze({
  IDLE:    "idle",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED:  "paused",
  STOPPED: "stopped",
  ERROR:   "error"
});

/**
 * Default-State – wird beim Start und nach einem Stop zurückgesetzt.
 */
function createDefaultState() {
  return {
    state:   PLAYER_STATES.IDLE,
    title:   null,
    artist:  null,
    artwork: null,
    volume:  1.0,
    source:  null   // { id, name, provider, type }
  };
}

/**
 * Unified Player API – Core-Singleton.
 *
 * Verwaltet:
 *  - Provider-Registry  (registerProvider / unregisterProvider / setActiveProvider)
 *  - Player-Controls    (play / pause / stop / toggle / setVolume)
 *  - Player-State       (getState / subscribe)
 *  - State-Subscribers  (keine Memory Leaks, kein removeAllListeners)
 *
 * Der Manager kennt keinerlei Medienanbieter-Logik (kein YouTube, kein FFmpeg).
 * Alle konkreten Implementierungen liegen in Providern.
 */
class PlayerManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.providers = new Map();

    /** @type {string|null} */
    this.activeProviderId = null;

    /** @type {object} */
    this.currentState = createDefaultState();

    /** @type {Set<Function>} */
    this.subscribers = new Set();
  }

  // ─────────────────────────────────────────────
  // Provider Registry
  // ─────────────────────────────────────────────

  /**
   * Registriert einen Player-Provider.
   *
   * @param {string} id  Eindeutige Provider-ID
   * @param {object} provider  Objekt mit play/pause/stop/setVolume/getState
   * @returns {object}  Handle mit { unregister() }
   */
  registerProvider(id, provider) {
    if (!id || typeof id !== "string") {
      throw new Error("[PlayerManager] registerProvider: id muss ein nicht-leerer String sein.");
    }
    if (!provider || typeof provider !== "object") {
      throw new Error(`[PlayerManager] registerProvider(${id}): provider muss ein Objekt sein.`);
    }

    if (this.providers.has(id)) {
      logger.warn(`Provider bereits registriert, wird überschrieben: ${id}`);
    }

    this.providers.set(id, provider);
    logger.info(`Provider registriert: ${id}`);

    return {
      unregister: () => this.unregisterProvider(id)
    };
  }

  /**
   * Entfernt einen Provider. Stoppt ihn zuerst, falls er aktiv ist.
   * @param {string} id
   */
  unregisterProvider(id) {
    if (!this.providers.has(id)) {
      logger.warn(`unregisterProvider: unbekannter Provider: ${id}`);
      return;
    }

    if (this.activeProviderId === id) {
      this._safeProviderCall(id, "stop");
      this.activeProviderId = null;
      this._setState(createDefaultState());
    }

    this.providers.delete(id);
    logger.info(`Provider entfernt: ${id}`);
  }

  /**
   * Aktiviert einen Provider. Der bisherige aktive Provider wird gestoppt.
   * @param {string} id
   */
  setActiveProvider(id) {
    if (!this.providers.has(id)) {
      throw new Error(`[PlayerManager] setActiveProvider: Provider "${id}" nicht registriert.`);
    }

    if (this.activeProviderId && this.activeProviderId !== id) {
      logger.info(`Provider-Wechsel: ${this.activeProviderId} → ${id}`);
      this._safeProviderCall(this.activeProviderId, "stop");
    }

    this.activeProviderId = id;
    logger.info(`Aktiver Provider: ${id}`);
  }

  /**
   * @returns {object|null}  Der aktuell aktive Provider oder null
   */
  getActiveProvider() {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) || null;
  }

  // ─────────────────────────────────────────────
  // Player Controls
  // ─────────────────────────────────────────────

  /**
   * Startet die Wiedergabe. Optionale Parameter werden an den Provider weitergegeben.
   * @param  {...any} args  Provider-spezifische Parameter (z.B. url, station)
   */
  async play(...args) {
    const provider = this.getActiveProvider();
    if (!provider) {
      logger.warn("play() aufgerufen, aber kein aktiver Provider.");
      return;
    }
    await this._safeProviderCall(this.activeProviderId, "play", ...args);
  }

  async pause() {
    const provider = this.getActiveProvider();
    if (!provider) return;
    await this._safeProviderCall(this.activeProviderId, "pause");
  }

  async stop() {
    const provider = this.getActiveProvider();
    if (!provider) return;
    await this._safeProviderCall(this.activeProviderId, "stop");
  }

  async toggle() {
    const state = this.currentState.state;
    if (state === PLAYER_STATES.PLAYING) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Setzt die Lautstärke (0.0 – 1.0). Wird auch im Player-State gespeichert.
   * @param {number} value  0.0 – 1.0
   */
  async setVolume(value) {
    const vol = Math.max(0, Math.min(1, Number(value) || 0));
    this.currentState = { ...this.currentState, volume: vol };

    const provider = this.getActiveProvider();
    if (provider) {
      await this._safeProviderCall(this.activeProviderId, "setVolume", vol);
    }

    this._notifySubscribers(this.currentState);
  }

  // ─────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────

  /**
   * Gibt den aktuellen Player-State zurück (shallow copy).
   * @returns {object}
   */
  getState() {
    return { ...this.currentState };
  }

  /**
   * Abonniert Player-State-Änderungen.
   * Gibt eine Unsubscribe-Funktion zurück.
   *
   * @param {Function} callback  Wird bei jeder State-Änderung aufgerufen
   * @returns {Function}  unsubscribe()
   */
  subscribe(callback) {
    if (typeof callback !== "function") {
      throw new Error("[PlayerManager] subscribe: callback muss eine Funktion sein.");
    }
    this.subscribers.add(callback);

    // Sofort mit aktuellem State aufrufen
    try {
      callback({ ...this.currentState });
    } catch (err) {
      logger.error(`Subscriber-Fehler beim initialen Aufruf: ${err.message}`);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Wird von Providern aufgerufen, um ihren State zu melden.
   * Nur der aktive Provider darf den State überschreiben.
   *
   * @param {string} providerId  ID des meldenden Providers
   * @param {object} partialState  Teilweiser State (state, title, artist, artwork, source)
   */
  updateProviderState(providerId, partialState) {
    if (providerId !== this.activeProviderId) {
      logger.warn(`updateProviderState: Provider "${providerId}" ist nicht aktiv, State ignoriert.`);
      return;
    }

    const next = {
      ...this.currentState,
      ...partialState,
      volume: this.currentState.volume  // Volume bleibt immer unter PlayerManager-Kontrolle
    };

    this._setState(next);
  }

  // ─────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────

  _setState(newState) {
    this.currentState = { ...newState };
    this._notifySubscribers(this.currentState);
  }

  _notifySubscribers(state) {
    const snapshot = { ...state };
    for (const cb of this.subscribers) {
      try {
        cb(snapshot);
      } catch (err) {
        logger.error(`Subscriber-Fehler: ${err.message}`);
      }
    }
  }

  /**
   * Ruft eine Methode auf einem Provider sicher auf.
   * Fehler des Providers propagieren nicht nach außen.
   */
  async _safeProviderCall(id, method, ...args) {
    const provider = this.providers.get(id);
    if (!provider) return;
    if (typeof provider[method] !== "function") return;

    try {
      await provider[method](...args);
    } catch (err) {
      logger.error(`Provider "${id}" – Fehler in ${method}(): ${err.message}`);
    }
  }
}

module.exports = new PlayerManager();
module.exports.PlayerManager = PlayerManager;
module.exports.PLAYER_STATES = PLAYER_STATES;
