"use strict";

/**
 * IPC Handler für die Unified Player API.
 *
 * Channels (zentral definiert, keine beliebigen Strings):
 *   player:getState           → PlayerManager.getState()
 *   player:play               → PlayerManager.play()
 *   player:pause              → PlayerManager.pause()
 *   player:stop               → PlayerManager.stop()
 *   player:toggle             → PlayerManager.toggle()
 *   player:setVolume          → PlayerManager.setVolume(value)
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
    await playerManager.play();
  });

  ipcMain.handle(PLAYER_CHANNELS.PAUSE, async () => {
    await playerManager.pause();
  });

  ipcMain.handle(PLAYER_CHANNELS.STOP, async () => {
    await playerManager.stop();
  });

  ipcMain.handle(PLAYER_CHANNELS.TOGGLE, async () => {
    await playerManager.toggle();
  });

  ipcMain.handle(PLAYER_CHANNELS.SET_VOLUME, async (_event, value) => {
    const vol = parseFloat(value);
    if (isNaN(vol)) {
      logger.warn(`setVolume: ungültiger Wert: ${value}`);
      return;
    }
    await playerManager.setVolume(vol);
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
