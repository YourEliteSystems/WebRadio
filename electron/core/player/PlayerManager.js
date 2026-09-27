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
 * Default-Capabilities – werden verwendet, wenn kein Provider aktiv ist.
 */
const DEFAULT_CAPABILITIES = Object.freeze({
  play:     true,
  pause:    true,
  stop:     true,
  volume:   true,
  mute:     true,
  seek:     false,
  next:     false,
  previous: false
});

/**
 * Default-State – wird beim Start und nach einem Stop zurückgesetzt.
 * Entspricht dem vollständigen Unified Player State Schema (§5).
 */
function createDefaultState() {
  return {
    state:    PLAYER_STATES.IDLE,
    title:    null,
    artist:   null,
    artwork:  null,
    volume:   1.0,
    muted:    false,

    provider: null,   // { id, name, type } – aktiver Provider (§5)

    source:   null,   // { id, type, url } – aktive Quelle

    capabilities: { ...DEFAULT_CAPABILITIES },

    position: null,   // Wiedergabeposition in Sekunden (§29 optional)
    duration: null,   // Gesamtdauer in Sekunden (§29 optional)
    error:    null    // { code, message } bei state === 'error'
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

    // Provider-Metadaten für den State ermitteln (§19)
    const provider = this.providers.get(id);
    const providerMeta = {
      id,
      name: provider?.name || id,
      type: provider?.type || "unknown"
    };

    // Capabilities des neuen Providers übernehmen
    const capabilities = this._getProviderCapabilities(id);

    // Sauberer State-Reset beim Provider-Wechsel mit neuem provider-Objekt
    const nextState = {
      ...createDefaultState(),
      provider:     providerMeta,
      capabilities
    };
    this._setState(nextState);

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
   * @returns {{ success: boolean, error?: { code: string, message: string } }}
   */
  async play(...args) {
    if (!this.getActiveProvider()) {
      logger.warn("play() aufgerufen, aber kein aktiver Provider.");
      return { success: false, error: { code: "NO_ACTIVE_PROVIDER", message: "Kein aktiver Provider." } };
    }
    try {
      await this._safeProviderCall(this.activeProviderId, "play", ...args);
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: "PROVIDER_ERROR", message: err.message } };
    }
  }

  /**
   * @returns {{ success: boolean, error?: { code: string, message: string } }}
   */
  async pause() {
    if (!this.getActiveProvider()) {
      return { success: false, error: { code: "NO_ACTIVE_PROVIDER", message: "Kein aktiver Provider." } };
    }
    try {
      await this._safeProviderCall(this.activeProviderId, "pause");
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: "PROVIDER_ERROR", message: err.message } };
    }
  }

  /**
   * @returns {{ success: boolean, error?: { code: string, message: string } }}
   */
  async stop() {
    if (!this.getActiveProvider()) {
      return { success: false, error: { code: "NO_ACTIVE_PROVIDER", message: "Kein aktiver Provider." } };
    }
    try {
      await this._safeProviderCall(this.activeProviderId, "stop");
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: "PROVIDER_ERROR", message: err.message } };
    }
  }

  /**
   * Wechselt zwischen Wiedergabe und Pause.
   * Bei loading wird kein zweiter Start ausgelöst (§3.4).
   * @returns {{ success: boolean, error?: object }}
   */
  async toggle() {
    const state = this.currentState.state;
    if (state === PLAYER_STATES.LOADING) {
      logger.info("toggle() bei loading – kein zweiter Start.");
      return { success: true };
    }
    if (state === PLAYER_STATES.PLAYING) {
      return this.pause();
    }
    return this.play();
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

  /**
   * Gibt die aktuelle Lautstärke zurück (0.0 – 1.0).
   * @returns {number}
   */
  getVolume() {
    return this.currentState.volume;
  }

  /**
   * Setzt den Mute-Status.
   * @param {boolean} muted
   */
  async setMuted(muted) {
    this.currentState = { ...this.currentState, muted: Boolean(muted) };

    const provider = this.getActiveProvider();
    if (provider && typeof provider.setMuted === "function") {
      await this._safeProviderCall(this.activeProviderId, "setMuted", Boolean(muted));
    }

    this._notifySubscribers(this.currentState);
  }

  /**
   * Wechselt den Mute-Status.
   */
  async toggleMute() {
    await this.setMuted(!this.currentState.muted);
  }

  /**
   * Gibt die Capabilities des aktiven Providers zurück.
   * @returns {object}
   */
  getCapabilities() {
    const provider = this.getActiveProvider();
    if (provider && typeof provider.getCapabilities === "function") {
      try {
        return provider.getCapabilities();
      } catch (err) {
        logger.error(`getCapabilities failed: ${err.message}`);
        return createDefaultState().capabilities;
      }
    }
    return createDefaultState().capabilities;
  }

  // ─────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────

  /**
   * Gibt den vollständigen Unified Player State zurück (§5).
   * Capabilities werden immer frisch vom aktiven Provider gelesen.
   * @returns {object}
   */
  getState() {
    const capabilities = this._getProviderCapabilities(this.activeProviderId);
    return { ...this.currentState, capabilities };
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
      // Diese Felder bleiben immer unter PlayerManager-Kontrolle:
      volume:   this.currentState.volume,
      muted:    partialState.muted !== undefined ? partialState.muted : this.currentState.muted,
      provider: this.currentState.provider  // provider-Objekt nicht überschreibbar
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
   * Liest die Capabilities des angegebenen Providers.
   * Fällt auf DEFAULT_CAPABILITIES zurück wenn nicht vorhanden.
   * @param {string|null} providerId
   * @returns {object}
   */
  _getProviderCapabilities(providerId) {
    if (!providerId) return { ...DEFAULT_CAPABILITIES };
    const provider = this.providers.get(providerId);
    if (!provider) return { ...DEFAULT_CAPABILITIES };
    if (typeof provider.getCapabilities === "function") {
      try {
        return { ...DEFAULT_CAPABILITIES, ...provider.getCapabilities() };
      } catch (err) {
        logger.error(`getCapabilities(${providerId}) fehlgeschlagen: ${err.message}`);
      }
    }
    // Fallback: capabilities-Objekt direkt auf dem Provider
    if (provider.capabilities && typeof provider.capabilities === "object") {
      return { ...DEFAULT_CAPABILITIES, ...provider.capabilities };
    }
    return { ...DEFAULT_CAPABILITIES };
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
module.exports.DEFAULT_CAPABILITIES = DEFAULT_CAPABILITIES;
