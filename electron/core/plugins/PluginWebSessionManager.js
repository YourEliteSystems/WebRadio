"use strict";

const crypto = require("crypto");
const { session: electronSession, WebContentsView } = require("electron");

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const COMMANDS = new Set(["play", "pause", "stop", "seek", "setVolume"]);
const IMPLEMENTED_COMMANDS = new Set(["play", "pause", "stop"]);
const SUPPORTED_COMMANDS = Object.freeze({ play: true, pause: true, stop: true, seek: false, setVolume: false });
const MAX_TEXT_LENGTH = 512;
// Nur diese Schemata dürfen aus einer Web-Sitzung heraus geladen werden.
// Subressourcen bleiben der normalen Web-Security überlassen; Navigation und
// Popups werden separat auf die deklarierten Origins begrenzt.
const ALLOWED_REQUEST_PROTOCOLS = new Set(["https:", "wss:", "data:", "blob:"]);

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim() !== value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    // Der WHATWG-URL-Parser akzeptiert `*` und `_` im Hostnamen. Wildcards
    // und nicht-standardkonforme Hosts werden für Origins ausdrücklich
    // abgelehnt, damit keine Origin-Familie freigegeben wird.
    if (!parsed.hostname || parsed.hostname.includes("*") || parsed.hostname.includes("_")) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function sanitizeText(value) {
  if (typeof value !== "string") return null;
  let text = "";
  for (const character of value) {
    const code = character.codePointAt(0);
    text += (code < 0x20 || code === 0x7f) ? " " : character;
  }
  return text.trim().slice(0, MAX_TEXT_LENGTH) || null;
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeArtwork(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href.slice(0, 2048) : null;
  } catch {
    return null;
  }
}

function sessionKey(pluginId, sessionId) {
  return `${pluginId}\u0000${sessionId}`;
}

function partitionFor(pluginId, sessionId) {
  // Die Partition wird ausschließlich vom Core abgeleitet. Der Hash macht
  // Kollisionen zwischen verschiedenen Plugin-/Session-Paaren praktisch
  // unmöglich (z. B. Plugin `a-b` + Session `c` vs. Plugin `a` + Session `b-c`)
  // und verhindert so eine Session-Verwechslung.
  const digest = crypto.createHash("sha256")
    .update(`${pluginId}\u0000${sessionId}`)
    .digest("hex")
    .slice(0, 24);
  return `persist:plugin-${pluginId}-${sessionId}-${digest}`;
}

class PluginWebSessionManager {
  constructor(options = {}) {
    this.sessionModule = options.session || electronSession;
    this.WebContentsViewClass = options.WebContentsView || WebContentsView;
    this.windowManager = null;
    this.sessions = new Map();
    this.configuredSessions = new WeakSet();
    this.visibleKey = null;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager || null;
  }

  create(pluginId, manifestOrigins, options = {}) {
    const allowedKeys = ["pluginId", "sessionId", "origin", "partition"];
    if (Object.keys(options).some((key) => !allowedKeys.includes(key)) || options.pluginId !== pluginId) {
      throw this._error("INVALID_ARGUMENT", "Die Session muss zu genau diesem Plugin gehören und darf nur dokumentierte Felder enthalten.");
    }
    const { sessionId, origin, partition } = options;
    if (typeof pluginId !== "string" || !SESSION_ID_PATTERN.test(pluginId) ||
        typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
      throw this._error("INVALID_ARGUMENT", "Plugin- und Session-ID sind ungültig.");
    }

    const allowedOrigins = this._normalizeAllowedOrigins(manifestOrigins);
    if (!allowedOrigins.length) {
      throw this._error("ORIGINS_REQUIRED", "Das Manifest muss mindestens eine HTTPS-Origin deklarieren.");
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin)) {
      throw this._error("ORIGIN_NOT_ALLOWED", "Die angeforderte Origin ist nicht im Plugin-Manifest freigegeben.");
    }

    const expectedPartition = partitionFor(pluginId, sessionId);
    if (partition !== undefined && partition !== expectedPartition) {
      throw this._error("INVALID_PARTITION", "Die Partition wird vom Core verwaltet und stimmt nicht überein.");
    }

    const key = sessionKey(pluginId, sessionId);
    const existing = this.sessions.get(key);
    if (existing) {
      if (!existing.allowedOrigins.includes(normalizedOrigin)) {
        throw this._error("ORIGIN_NOT_ALLOWED", "Die Origin ist für diese bestehende Sitzung nicht freigegeben.");
      }
      const sameOriginPolicy = existing.allowedOrigins.length === allowedOrigins.length &&
        existing.allowedOrigins.every((item) => allowedOrigins.includes(item));
      if (!sameOriginPolicy) {
        throw this._error("ORIGIN_POLICY_CHANGED", "Die freigegebenen Origins haben sich geändert. Zerstöre die alte Sitzung und erstelle sie erneut.");
      }
      return this.getState(pluginId, sessionId);
    }

    let persistentSession;
    let view;
    try {
      persistentSession = this.sessionModule.fromPartition(expectedPartition);
      view = new this.WebContentsViewClass({
        webPreferences: {
          partition: expectedPartition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webviewTag: false,
          webSecurity: true,
          allowRunningInsecureContent: false
        }
      });
      if (!view?.webContents) throw new Error("Electron WebContentsView is unavailable");
    } catch (error) {
      throw this._error("SESSION_CREATE_FAILED", "Die isolierte Web-Sitzung konnte nicht erstellt werden.", error);
    }

    const entry = {
      key,
      pluginId,
      sessionId,
      partition: expectedPartition,
      allowedOrigins,
      origin: normalizedOrigin,
      view,
      webSession: persistentSession,
      state: "idle",
      audible: false,
      title: null,
      artist: null,
      album: null,
      artwork: null,
      duration: null,
      position: null,
      volume: null,
      onState: new Set(),
      onNavigationRequired: new Set(),
      onError: new Set(),
      pollTimer: null,
      refreshSequence: 0,
      lastEmittedState: null,
      destroyed: false
    };

    this.sessions.set(key, entry);
    try {
      this._configureSession(entry);
      this._configureContents(entry);
      this._startPolling(entry);
      this._emitState(entry);
      return this.getState(pluginId, sessionId);
    } catch (error) {
      this.sessions.delete(key);
      this._disposeEntry(entry);
      throw this._error("SESSION_CREATE_FAILED", "Die isolierte Web-Sitzung konnte nicht initialisiert werden.", error);
    }
  }

  openLogin(pluginId, sessionId) {
    const entry = this._requireSession(pluginId, sessionId);
    return this.load(pluginId, sessionId, `${entry.origin}/`);
  }

  async load(pluginId, sessionId, targetUrl) {
    const entry = this._requireSession(pluginId, sessionId);
    const url = this._validateUrl(entry, targetUrl);
    try {
      entry.state = "loading";
      this._emitState(entry);
      await entry.view.webContents.loadURL(url.href);
      return { success: true };
    } catch {
      this._emitError(entry, "LOAD_FAILED", "Die Web-Sitzung konnte die angeforderte Seite nicht laden.");
      return { success: false, error: { code: "LOAD_FAILED", message: "Die Web-Sitzung konnte die angeforderte Seite nicht laden." } };
    }
  }

  async command(pluginId, sessionId, command) {
    const entry = this._requireSession(pluginId, sessionId);
    this._validateCommand(command);

    if (!IMPLEMENTED_COMMANDS.has(command.type)) {
      return {
        success: false,
        error: {
          code: "COMMAND_ARGUMENTS_UNSPECIFIED",
          message: `Die Referenz definiert keine Parameter für '${command.type}'.`
        }
      };
    }

    try {
      const result = await entry.view.webContents.executeJavaScript(`(() => {
        const media = Array.from(document.querySelectorAll('audio,video'));
        const active = media.find((item) => !item.paused && !item.ended) || media[0];
        if (!active) return { success: false, code: 'NO_MEDIA' };
        if (${JSON.stringify(command.type)} === 'play') {
          return active.play().then(() => ({ success: true })).catch(() => ({ success: false, code: 'PLAY_REJECTED' }));
        }
        active.pause();
        if (${JSON.stringify(command.type)} === 'stop') {
          try { active.currentTime = 0; } catch { /* live streams may not be seekable */ }
        }
        return { success: true };
      })()`, true);
      if (result?.success === false) {
        return { success: false, error: { code: result.code || "NO_MEDIA", message: result.code === "PLAY_REJECTED" ? "Der Browser hat das Starten der Medien abgelehnt." : "Die Sitzung enthält kein steuerbares Medien-Element." } };
      }
      return { success: true };
    } catch {
      return { success: false, error: { code: "COMMAND_FAILED", message: "Der Medienbefehl konnte nicht ausgeführt werden." } };
    }
  }

  getState(pluginId, sessionId) {
    const entry = this._requireSession(pluginId, sessionId);
    return this._stateSnapshot(entry);
  }

  async show(pluginId, sessionId, bounds) {
    const entry = this._requireSession(pluginId, sessionId);
    const window = this.windowManager?.getMainWindow?.();
    if (!window || window.isDestroyed?.()) {
      throw this._error("WINDOW_UNAVAILABLE", "Das WebRadio-Hauptfenster ist nicht verfügbar.");
    }
    const rect = this._validateBounds(window, bounds);
    if (this.visibleKey === entry.key) {
      entry.view.setBounds(rect);
      return { success: true };
    }
    if (this.visibleKey && this.visibleKey !== entry.key) {
      const previous = this.sessions.get(this.visibleKey);
      if (previous) {
        this._hideEntry(previous);
        await this.command(previous.pluginId, previous.sessionId, { type: "pause" });
      }
    }
    const contentView = window.contentView;
    if (!contentView) throw this._error("WINDOW_UNAVAILABLE", "Das Hauptfenster unterstützt keine eingebetteten Web-Sitzungen.");
    try {
      contentView.addChildView(entry.view);
      entry.view.setBounds(rect);
      this.visibleKey = entry.key;
      this._startPolling(entry);
      return { success: true };
    } catch (error) {
      throw this._error("SESSION_SHOW_FAILED", "Die Web-Sitzung konnte nicht angezeigt werden.", error);
    }
  }

  hide(pluginId, sessionId) {
    const entry = this._requireSession(pluginId, sessionId);
    this._hideEntry(entry);
    return { success: true };
  }

  reload(pluginId, sessionId) {
    const entry = this._requireSession(pluginId, sessionId);
    if (!entry.view.webContents.getURL()) {
      return { success: false, error: { code: "NO_PAGE", message: "Für diese Sitzung ist keine Seite geladen." } };
    }
    entry.view.webContents.reload();
    return { success: true };
  }

  destroy(pluginId, sessionId) {
    const entry = this._requireSession(pluginId, sessionId);
    this._disposeEntry(entry);
    this.sessions.delete(entry.key);
    return { success: true };
  }

  onState(pluginId, sessionId, listener) {
    return this._subscribe(pluginId, sessionId, "onState", listener, (entry) => this._stateSnapshot(entry));
  }

  onNavigationRequired(pluginId, sessionId, listener) {
    return this._subscribe(pluginId, sessionId, "onNavigationRequired", listener);
  }

  onError(pluginId, sessionId, listener) {
    return this._subscribe(pluginId, sessionId, "onError", listener);
  }

  hidePlugin(pluginId) {
    for (const entry of this.sessions.values()) {
      if (entry.pluginId !== pluginId) continue;
      this._hideEntry(entry);
      if (!entry.destroyed) {
        try {
          // Pausieren verhindert hörbare Wiedergabe, wenn ein Plugin deaktiviert
          // oder neu geladen wird. Ein nicht mehr nutzbares WebContents wird
          // dabei nicht als Fehler nach außen gereicht.
          Promise.resolve(this.command(pluginId, entry.sessionId, { type: "pause" })).catch(() => {});
        } catch { /* session already destroyed */ }
      }
      entry.onState.clear();
      entry.onNavigationRequired.clear();
      entry.onError.clear();
      // Die Sitzung bleibt persistent erhalten und wird beim Deaktivieren pausiert.
    }
  }

  shutdown() {
    for (const entry of this.sessions.values()) this._disposeEntry(entry);
    this.sessions.clear();
    this.visibleKey = null;
  }

  _configureSession(entry) {
    const ses = entry.webSession;
    if (this.configuredSessions.has(ses)) return;
    this.configuredSessions.add(ses);
    ses.setPermissionRequestHandler?.((_contents, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler?.(() => false);
    ses.on?.("will-download", (event) => event.preventDefault());
    ses.webRequest?.onBeforeRequest?.({ urls: ["<all_urls>"] }, (details, callback) => {
      const activeEntry = this.sessions.get(entry.key);
      let allowed = false;
      try {
        const requestUrl = new URL(details.url);
        // Datei-, FTP- und beliebige Custom-Protokolle bleiben gesperrt.
        // Innerhalb der Sitzungsseite gelten für Subressourcen die normalen
        // Web-Security-Regeln; eine zusätzliche Origin-Allowlist würde reale
        // Login- und Medien-CDNs blockieren. Top-Level-Navigation, Frames,
        // Popups und Downloads werden separat kontrolliert.
        allowed = Boolean(activeEntry) && !activeEntry.destroyed &&
          ALLOWED_REQUEST_PROTOCOLS.has(requestUrl.protocol);
      } catch { /* malformed and unknown schemes are blocked */ }
      callback({ cancel: !allowed });
    });
  }

  _configureContents(entry) {
    const contents = entry.view.webContents;
    contents.setWindowOpenHandler?.(() => ({ action: "deny" }));
    contents.on("will-attach-webview", (event) => event.preventDefault());

    const checkNavigation = (event, details) => {
      const url = details?.url || details;
      const parsed = this._validateUrl(entry, url, false, true);
      if (!parsed) {
        event.preventDefault();
        this._emitError(entry, "NAVIGATION_BLOCKED", "Die Navigation wurde durch die Origin-Regel blockiert.");
        return;
      }
      if (parsed.origin !== entry.origin) {
        const safeUrl = `${parsed.origin}${parsed.pathname}`;
        for (const callback of entry.onNavigationRequired) {
          try { callback(safeUrl); } catch { /* plugin callback isolation */ }
        }
        entry.origin = parsed.origin;
      }
    };

    contents.on("will-navigate", checkNavigation);
    contents.on("will-redirect", checkNavigation);
    contents.on("will-frame-navigate", (event, details) => {
      const url = details?.url || details;
      if (!this._validateUrl(entry, url, false, true)) {
        event.preventDefault();
        this._emitError(entry, "NAVIGATION_BLOCKED", "Die Frame-Navigation wurde durch die Origin-Regel blockiert.");
      }
    });
    contents.on("did-navigate", (_event, url) => {
      const parsed = this._validateUrl(entry, url, false);
      if (parsed) entry.origin = parsed.origin;
      entry.state = "paused";
      entry.audible = false;
      this._clearMediaState(entry);
      this._emitState(entry);
    });
    contents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
      if (isMainFrame) this._refreshMediaState(entry);
    });
    contents.on("page-title-updated", () => this._refreshMediaState(entry));
    contents.on("media-started-playing", () => {
      entry.state = "playing";
      entry.audible = true;
      this._emitState(entry);
    });
    contents.on("media-paused", () => {
      entry.state = "paused";
      this._emitState(entry);
    });
    contents.on("audio-state-changed", (_event, audible) => {
      entry.audible = Boolean(audible);
      this._emitState(entry);
    });
    contents.on("did-fail-load", (_event, code, _description, _validatedUrl, isMainFrame) => {
      if (code === -3 || !isMainFrame) return;
      entry.state = "error";
      entry.audible = false;
      this._clearMediaState(entry);
      this._emitError(entry, "LOAD_FAILED", "Die Web-Sitzung konnte die Seite nicht laden.");
      this._emitState(entry);
    });
    contents.on("destroyed", () => {
      clearInterval(entry.pollTimer);
      entry.pollTimer = null;
      entry.onState.clear();
      entry.onNavigationRequired.clear();
      entry.onError.clear();
      entry.destroyed = true;
      // Ein unerwartet zerstörtes WebContents darf keine veralteten
      // Listener/Timer zurücklassen. Die persistente Cookies-Partition bleibt
      // erhalten; ein erneutes `create` baut die Ansicht neu auf.
      if (this.sessions.get(entry.key) === entry) this.sessions.delete(entry.key);
      if (this.visibleKey === entry.key) this.visibleKey = null;
    });
  }

  _validateCommand(command) {
    if (!command || typeof command !== "object" || Array.isArray(command) || !COMMANDS.has(command.type)) {
      throw this._error("INVALID_COMMAND", "Ungültiger Medienbefehl.");
    }
    if (Object.keys(command).length !== 1 || Object.keys(command)[0] !== "type") {
      throw this._error("INVALID_COMMAND", "Die Referenz definiert keine zusätzlichen Felder für Medienbefehle.");
    }
  }

  _validateUrl(entry, value, throwOnError = true, allowDeclaredOrigin = false) {
    let parsed = null;
    try {
      if (typeof value === "string") parsed = new URL(value);
    } catch { /* invalid URL */ }
    const valid = parsed && parsed.protocol === "https:" && !parsed.username && !parsed.password && entry.allowedOrigins.includes(parsed.origin) &&
      (throwOnError || allowDeclaredOrigin || parsed.origin === entry.origin);
    if (valid) return parsed;
    if (!throwOnError) return null;
    throw this._error("ORIGIN_NOT_ALLOWED", "Die URL ist keine freigegebene HTTPS-Origin.");
  }

  _normalizeAllowedOrigins(origins) {
    if (!Array.isArray(origins)) return [];
    const normalized = [];
    for (const item of origins) {
      const origin = normalizeOrigin(item);
      if (!origin || origin !== item) {
        throw this._error("INVALID_ORIGIN", "webSessionOrigins dürfen nur exakte HTTPS-Origins ohne Pfade oder Wildcards enthalten.");
      }
      if (!normalized.includes(origin)) normalized.push(origin);
    }
    return normalized;
  }

  _validateBounds(window, bounds) {
    const fields = ["x", "y", "width", "height"];
    if (!bounds || typeof bounds !== "object" || Array.isArray(bounds) ||
        Object.keys(bounds).some((key) => !fields.includes(key))) {
      throw this._error("INVALID_BOUNDS", "Die Session-Ansicht benötigt ausschließlich x/y/width/height-Werte.");
    }
    const values = fields.map((key) => bounds[key]);
    if (!values.every((value) => Number.isFinite(value)) || bounds.width <= 0 || bounds.height <= 0) {
      throw this._error("INVALID_BOUNDS", "Die Session-Ansicht benötigt gültige x/y/width/height-Werte.");
    }
    const [windowWidth, windowHeight] = window.getContentSize();
    const x = Math.max(0, Math.min(Math.floor(bounds.x), windowWidth));
    const y = Math.max(0, Math.min(Math.floor(bounds.y), windowHeight));
    const width = Math.min(Math.floor(bounds.width), windowWidth - x);
    const height = Math.min(Math.floor(bounds.height), windowHeight - y);
    if (width <= 0 || height <= 0) throw this._error("INVALID_BOUNDS", "Die Session-Ansicht liegt außerhalb des Hauptfensters.");
    return { x, y, width, height };
  }

  _startPolling(entry) {
    if (entry.pollTimer || entry.destroyed) return;
    this._refreshMediaState(entry);
    entry.pollTimer = setInterval(() => this._refreshMediaState(entry), 1000);
    entry.pollTimer.unref?.();
  }

  async _refreshMediaState(entry) {
    if (entry.destroyed || !entry.view.webContents || entry.view.webContents.isDestroyed?.()) return;
    const sequence = ++entry.refreshSequence;
    try {
      const sample = await entry.view.webContents.executeJavaScript(`(() => {
        const metadata = navigator.mediaSession?.metadata;
        const media = Array.from(document.querySelectorAll('audio,video'));
        const active = media.find((item) => !item.paused && !item.ended) || media[0] || null;
        const artwork = metadata?.artwork?.find((item) => typeof item.src === 'string')?.src || null;
        return {
          title: metadata?.title || document.title || null,
          artist: metadata?.artist || null,
          album: metadata?.album || null,
          artwork,
          duration: active && Number.isFinite(active.duration) ? active.duration : null,
          position: active && Number.isFinite(active.currentTime) ? active.currentTime : null,
          volume: active && Number.isFinite(active.volume) ? active.volume : null,
          playing: Boolean(active && !active.paused && !active.ended)
        };
      })()`, true);
      if (!sample || typeof sample !== "object" || entry.destroyed || sequence !== entry.refreshSequence) return;
      entry.title = sanitizeText(sample.title);
      entry.artist = sanitizeText(sample.artist);
      entry.album = sanitizeText(sample.album);
      entry.artwork = safeArtwork(sample.artwork);
      entry.duration = finiteOrNull(sample.duration);
      entry.position = finiteOrNull(sample.position);
      entry.volume = typeof sample.volume === "number" && Number.isFinite(sample.volume)
        ? Math.max(0, Math.min(1, sample.volume))
        : null;
      if (sample.playing) {
        entry.state = "playing";
      } else if (entry.state === "playing") {
        entry.state = "paused";
      }
      this._emitState(entry);
    } catch {
      // The page may navigate or close while the core queries standard media metadata.
    }
  }

  _subscribe(pluginId, sessionId, field, listener, initialValue) {
    const entry = this._requireSession(pluginId, sessionId);
    if (typeof listener !== "function") throw new TypeError(`${field} erwartet eine Funktion.`);
    entry[field].add(listener);
    if (initialValue) {
      try { listener(initialValue(entry)); } catch { /* plugin callback isolation */ }
    }
    return () => entry[field].delete(listener);
  }

  _clearMediaState(entry) {
    entry.title = null;
    entry.artist = null;
    entry.album = null;
    entry.artwork = null;
    entry.duration = null;
    entry.position = null;
    entry.volume = null;
  }

  _stateSnapshot(entry) {
    return {
      state: entry.state,
      title: entry.title,
      artist: entry.artist,
      album: entry.album,
      artwork: entry.artwork,
      duration: entry.duration,
      position: entry.position,
      volume: entry.volume,
      audible: entry.audible
    };
  }

  _emitState(entry) {
    const snapshot = this._stateSnapshot(entry);
    const serialized = JSON.stringify(snapshot);
    if (serialized === entry.lastEmittedState) return;
    entry.lastEmittedState = serialized;
    for (const listener of entry.onState) {
      try { listener({ ...snapshot }); } catch { /* plugin callback isolation */ }
    }
  }

  _emitError(entry, code, message) {
    const error = { code, message };
    for (const listener of entry.onError) {
      try { listener({ ...error }); } catch { /* plugin callback isolation */ }
    }
  }

  _hideEntry(entry) {
    if (!entry) return;
    const window = this.windowManager?.getMainWindow?.();
    try { window?.contentView?.removeChildView(entry.view); } catch { /* already hidden/detached */ }
    if (this.visibleKey === entry.key) this.visibleKey = null;
  }

  _disposeEntry(entry) {
    if (!entry) return;
    this._hideEntry(entry);
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
    entry.refreshSequence++;
    entry.onState.clear();
    entry.onNavigationRequired.clear();
    entry.onError.clear();
    try {
      if (!entry.view.webContents.isDestroyed?.()) entry.view.webContents.close();
    } catch { /* shutdown cleanup */ }
    entry.destroyed = true;
  }

  _requireSession(pluginId, sessionId) {
    const entry = this.sessions.get(sessionKey(pluginId, sessionId));
    if (!entry || entry.destroyed) throw this._error("SESSION_NOT_FOUND", "Die Web-Sitzung existiert nicht.");
    return entry;
  }

  _error(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }
}

module.exports = new PluginWebSessionManager();
module.exports.PluginWebSessionManager = PluginWebSessionManager;
module.exports.normalizeOrigin = normalizeOrigin;
module.exports.partitionFor = partitionFor;
module.exports.SUPPORTED_COMMANDS = SUPPORTED_COMMANDS;
module.exports.validateManifest = function validateManifest(manifest) {
  const errors = [];
  const capabilities = Array.isArray(manifest?.capabilities) ? manifest.capabilities : [];
  const usesWebSession = capabilities.some((id) => ["web-session", "web-session-media", "encrypted-media"].includes(id));
  if (!usesWebSession) return { valid: true, errors };
  if (!Array.isArray(manifest.webSessionOrigins) || manifest.webSessionOrigins.length === 0) {
    return { valid: false, errors: ["webSessionOrigins muss für Web-Session-Capabilities mindestens eine HTTPS-Origin enthalten."] };
  }
  for (const origin of manifest.webSessionOrigins) {
    if (typeof origin !== "string" || normalizeOrigin(origin) !== origin) {
      errors.push(`Ungültige webSessionOrigin: ${String(origin)}`);
    }
  }
  return { valid: errors.length === 0, errors };
};
