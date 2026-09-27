"use strict";

/**
 * IPC Handler für die Unified Player API v1.
 *
 * Channels (zentral definiert, keine beliebigen Strings):
 *   player:getState           → PlayerManager.getState()
 *   player:play               → PlayerManager.play()
 *   player:pause              → PlayerManager.pause()
 *   player:stop               → PlayerManager.stop()
 *   player:toggle             → PlayerManager.toggle()
 *   player:setVolume          → PlayerManager.setVolume(value)
 *   player:getVolume          → PlayerManager.getVolume()
 *   player:setMuted           → PlayerManager.setMuted(muted)
 *   player:toggleMute         → PlayerManager.toggleMute()
 *   player:getCapabilities    → PlayerManager.getCapabilities()
 *   player:setActiveProvider  → PlayerManager.setActiveProvider(id)
 *   player:registerProvider   → PlayerManager.registerProvider(id, provider)
 *   player:unregisterProvider → PlayerManager.unregisterProvider(id)
 *   player:reportProviderState → PlayerManager.updateProviderState(id, state)
 *   player:stateChanged       → Push-Event (Main → Renderer)
 */

const { ipcMain } = require("electron");
const playerManager = require("../player/PlayerManager");
const LogManager    = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PlayerHandlers");

/**
 * IPC-Channel-Konstanten.
 * Nur diese Strings dürfen für Player-IPC verwendet werden.
 */
const PLAYER_CHANNELS = Object.freeze({
  GET_STATE:             "player:getState",
  PLAY:                  "player:play",
  PAUSE:                 "player:pause",
  STOP:                  "player:stop",
  TOGGLE:                "player:toggle",
  SET_VOLUME:            "player:setVolume",
  GET_VOLUME:            "player:getVolume",
  SET_MUTED:             "player:setMuted",
  TOGGLE_MUTE:           "player:toggleMute",
  GET_CAPABILITIES:      "player:getCapabilities",
  SET_ACTIVE_PROVIDER:   "player:setActiveProvider",
  REGISTER_PROVIDER:     "player:registerProvider",
  UNREGISTER_PROVIDER:   "player:unregisterProvider",
  REPORT_PROVIDER_STATE: "player:reportProviderState",
  STATE_CHANGED:         "player:stateChanged"   // Push-Channel (Main → Renderer)
});

function registerPlayerHandlers(windowManager) {
  const getWindow = () => {
    try {
      return windowManager?.getMainWindow?.() || null;
    } catch {
      return null;
    }
  };

  // ─── Query ──────────────────────────────────
  ipcMain.handle(PLAYER_CHANNELS.GET_STATE, () => {
    return playerManager.getState();
  });

  // ─── Controls ───────────────────────────────
  ipcMain.handle(PLAYER_CHANNELS.PLAY, async () => {
    const result = await playerManager.play();
    return result || { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.PAUSE, async () => {
    const result = await playerManager.pause();
    return result || { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.STOP, async () => {
    const result = await playerManager.stop();
    return result || { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.TOGGLE, async () => {
    const result = await playerManager.toggle();
    return result || { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.SET_VOLUME, async (_event, value) => {
    const vol = parseFloat(value);
    if (isNaN(vol)) {
      logger.warn(`setVolume: ungültiger Wert: ${value}`);
      return { success: false, error: { code: "INVALID_VOLUME", message: "Volume muss eine Zahl zwischen 0 und 1 sein" } };
    }
    if (vol < 0 || vol > 1) {
      logger.warn(`setVolume: Wert außerhalb des Bereichs: ${vol}`);
      return { success: false, error: { code: "INVALID_VOLUME", message: "Volume muss zwischen 0 und 1 liegen" } };
    }
    await playerManager.setVolume(vol);
    return { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.GET_VOLUME, () => {
    return playerManager.getVolume();
  });

  ipcMain.handle(PLAYER_CHANNELS.SET_MUTED, async (_event, muted) => {
    await playerManager.setMuted(Boolean(muted));
    return { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.TOGGLE_MUTE, async () => {
    await playerManager.toggleMute();
    return { success: true };
  });

  ipcMain.handle(PLAYER_CHANNELS.GET_CAPABILITIES, () => {
    return playerManager.getCapabilities();
  });

  // ─── Provider Registration ──────────────────
  // Registriert einen neuen Provider (nur für autorisierte Plugin-/Core-Kontexte)
  ipcMain.handle(PLAYER_CHANNELS.REGISTER_PROVIDER, (_event, id, provider) => {
    if (!id || typeof id !== "string") {
      logger.warn(`registerProvider: ungültige ID: ${JSON.stringify(id)}`);
      return { success: false, error: { code: "INVALID_ARGUMENT", message: "Provider-ID muss eine Zeichenkette sein" } };
    }
    if (!provider || typeof provider !== "object") {
      logger.warn(`registerProvider(${id}): provider muss ein Objekt sein`);
      return { success: false, error: { code: "INVALID_ARGUMENT", message: "Provider muss ein Objekt sein" } };
    }
    try {
      playerManager.registerProvider(id, provider);
      return { success: true, providerId: id };
    } catch (err) {
      logger.error(`registerProvider(${id}): ${err.message}`);
      return { success: false, error: { code: "PROVIDER_ERROR", message: err.message } };
    }
  });

  ipcMain.handle(PLAYER_CHANNELS.UNREGISTER_PROVIDER, (_event, id) => {
    if (!id || typeof id !== "string") {
      logger.warn(`unregisterProvider: ungültige ID: ${JSON.stringify(id)}`);
      return { success: false, error: { code: "INVALID_ARGUMENT", message: "Provider-ID muss eine Zeichenkette sein" } };
    }
    try {
      playerManager.unregisterProvider(id);
      return { success: true, providerId: id };
    } catch (err) {
      logger.error(`unregisterProvider(${id}): ${err.message}`);
      return { success: false, error: { code: "PROVIDER_ERROR", message: err.message } };
    }
  });

  // ─── Provider Activation ────────────────────
  // Aktiviert einen registrierten Provider als aktiven Player.
  // Nur vorhandene Provider-ID sind erlaubt (Validation im Main).
  ipcMain.handle(PLAYER_CHANNELS.SET_ACTIVE_PROVIDER, async (_event, id) => {
    if (!id || typeof id !== "string") {
      logger.warn(`setActiveProvider: ungültige ID: ${JSON.stringify(id)}`);
      return { ok: false, error: { code: "INVALID_PROVIDER_ID", message: "Provider-ID muss eine Zeichenkette sein" } };
    }

    try {
      playerManager.setActiveProvider(id);
      return { ok: true, activeProviderId: playerManager.activeProviderId };
    } catch (err) {
      logger.error(`setActiveProvider(${id}): ${err.message}`);
      return { ok: false, error: { code: "PROVIDER_NOT_FOUND", message: err.message } };
    }
  });

  // ─── Provider State Reporting ────────────────
  // Renderer-seitige Provider (z.B. MediaHub YouTube IFrame) melden
  // ihren State über diesen Channel an den Main-Prozess.
  ipcMain.handle(PLAYER_CHANNELS.REPORT_PROVIDER_STATE, (_event, providerId, state) => {
    if (!providerId || typeof providerId !== "string") {
      logger.warn("reportProviderState: ungültige providerId");
      return;
    }
    if (!state || typeof state !== "object") {
      logger.warn(`reportProviderState(${providerId}): state muss ein Objekt sein`);
      return;
    }
    playerManager.updateProviderState(providerId, state);
  });

  // ─── State Push (Main → Renderer) ───────────
  // Abonniert den PlayerManager und pusht State-Änderungen an den Renderer.
  // Sauberes Unsubscribe beim windowManager-Shutdown wäre ideal,
  // hier aber für App-Lifecycle nicht notwendig (App lebt solange Renderer).
  const unsubscribe = playerManager.subscribe((state) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;

    try {
      win.webContents.send(PLAYER_CHANNELS.STATE_CHANGED, state);
    } catch (err) {
      logger.warn(`State-Push fehlgeschlagen: ${err.message}`);
    }
  });

  logger.info("Player IPC Handler registriert");

  // Unsubscribe-Referenz für sauberen Shutdown zurückgeben
  return { unsubscribe };
}

module.exports = registerPlayerHandlers;
module.exports.PLAYER_CHANNELS = PLAYER_CHANNELS;
