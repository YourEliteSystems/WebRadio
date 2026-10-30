"use strict";

const eventBus = require("../eventBus");
const fs = require("fs");
const PluginStorage = require("./PluginStorage");
const UIManager = require("../ui/UIManager");
const NavigationManager = require("../navigation/NavigationManager");
const PluginPermissions = require("./PluginPermissions");
const LogManager = require("../diagnostics/logging/LogManager");
const SettingsManager = require("../storage/SettingsManager");
const playerManager = require("../player/PlayerManager");
const PluginHttpServer = require("./PluginHttpServer");
const PluginWebSessionManager = require("./PluginWebSessionManager");
const { app } = require("electron");

const PLUGIN_API_VERSION = "1.3.0";

function create(meta = {}) {
  const pluginId = meta.id || "anonymous";
  const permissions = Array.isArray(meta.permissions) ? meta.permissions : [];
  const capabilityValidation = PluginPermissions.validateCapabilities(meta.capabilities || [], permissions);
  const grantedCapabilities = new Set(capabilityValidation.granted);
  const playerSubscriptions = new Set();
  const webSessionSubscriptions = new Set();
  const webSessionSessions = new Set();

  function checkNavPermission() {
    if (!PluginPermissions.hasPermission(permissions, "navigation")) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die Berechtigung "navigation", um auf die Navigation Extension API zuzugreifen.`;
      const logger = LogManager.getLogger(`Plugin:${pluginId}`);
      logger.error(msg);
      throw new Error(msg);
    }
  }

  function checkPlayerPermission() {
    if (!PluginPermissions.hasPermission(permissions, "player")) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die Berechtigung "player", um auf die Player API zuzugreifen.`;
      const logger = LogManager.getLogger(`Plugin:${pluginId}`);
      logger.error(msg);
      throw new Error(msg);
    }
  }

  function getPublicMediaState() {
    const state = playerManager.getState();
    return {
      ...state,
      source: state.source ? { id: state.source.id, type: state.source.type, name: state.source.name || null } : null
    };
  }

  function hasGrantedCapability(capabilityId) {
    return grantedCapabilities.has(capabilityId);
  }

  function checkWebSessionPermission(capabilityId = "web-session") {
    if (!hasGrantedCapability(capabilityId)) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die erforderlichen Permissions und die Capability "${capabilityId}".`;
      LogManager.getLogger(`Plugin:${pluginId}`).warn(msg);
      const error = new Error(msg);
      error.code = "CAPABILITY_DENIED";
      throw error;
    }
    if (!Array.isArray(meta.webSessionOrigins) || meta.webSessionOrigins.length === 0) {
      const error = new Error(`[PluginAPI] Plugin "${pluginId}" benötigt deklarierte webSessionOrigins.`);
      error.code = "ORIGINS_REQUIRED";
      throw error;
    }
  }

  function checkMediaControlsPermission() {
    if (!PluginPermissions.hasPermission(permissions, "media-control") || !hasGrantedCapability("media-controls")) {
      const msg = `[PluginAPI] Plugin "${pluginId}" benötigt die Berechtigung "media-control" und die Capability "media-controls", um System-Mediensteuerungen zu verwenden.`;
      LogManager.getLogger(`Plugin:${pluginId}`).warn(msg);
      throw new Error(msg);
    }
  }

  const api = {
    plugin: meta,
    version: {
      pluginAPI: PLUGIN_API_VERSION,
      application: (app && typeof app.getVersion === "function") ? app.getVersion() : "1.0.5"
    },

    logger: (context) => {
      return LogManager.getLogger(`Plugin:${meta.name || pluginId}:${context}`);
    },

    events: {
      on(event, callback) {
        eventBus.on(event, callback);
      },

      once(event, callback) {
        eventBus.once(event, callback);
      },

      off(event, callback) {
        eventBus.off(event, callback);
      },

      emit(event, payload) {
        eventBus.emit(event, payload);
      }
    },

    navigation: {
      registerSection(section) {
        checkNavPermission();
        return NavigationManager.registerSection(section, pluginId);
      },

      registerItem(item) {
        checkNavPermission();
        return NavigationManager.registerItem(item, pluginId);
      },

      updateItem(id, updates) {
        checkNavPermission();
        return NavigationManager.updateItem(id, updates, pluginId);
      },

      removeItem(id) {
        checkNavPermission();
        return NavigationManager.removeItem(id, pluginId);
      },

      removeSection(id) {
        checkNavPermission();
        return NavigationManager.removeSection(id, pluginId);
      },

      getTree() {
        return NavigationManager.getTree();
      },

      getSections() {
        return NavigationManager.getSections();
      },

      getItems(sectionId) {
        return NavigationManager.getItems(sectionId);
      }
    },

    storage: {
      exists() {
        return fs.existsSync(PluginStorage.getPluginFile(meta.id));
      },

      read() {
        return PluginStorage.read(meta.id);
      },

      write(data) {
        PluginStorage.write(meta.id, data);
      },

      delete() {
        const file = PluginStorage.getPluginFile(meta.id);
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      },

      get(key) {
        const data = PluginStorage.read(meta.id);
        return data[key];
      },

      set(key, value) {
        const data = PluginStorage.read(meta.id);
        data[key] = value;
        PluginStorage.write(meta.id, data);
      },

      remove(key) {
        const data = PluginStorage.read(meta.id);
        delete data[key];
        PluginStorage.write(meta.id, data);
      },

      has(key) {
        const data = PluginStorage.read(meta.id);
        return key in data;
      }
    },

    httpOrigin: {
      getUrl() {
        return PluginHttpServer.getUrl();
      },
      getPort() {
        return PluginHttpServer.getPort();
      },
      getPluginUrl(pluginId, relativePath) {
        return PluginHttpServer.getPluginUrl(pluginId, relativePath);
      }
    },

    settings: {
      get(key) {
        const settings = SettingsManager.get();
        return settings[key];
      },

      set(key, value) {
        const settings = SettingsManager.get();
        settings[key] = value;
        SettingsManager.update(settings);
      },

      has(key) {
        const settings = SettingsManager.get();
        return key in settings;
      },

      delete(key) {
        const settings = SettingsManager.get();
        delete settings[key];
        SettingsManager.update(settings);
      }
    },

    ui: {
      register(item) {
        UIManager.register(item, {
          pluginId: meta.id,
          version: meta.version,
          source: "plugin"
        });
      },
      unregister(id) {
        UIManager.unregister(id);
      }
    },

    /**
     * Player API – erlaubt Plugins, Provider zu registrieren und den
     * Player-State zu abonnieren.
     * Erfordert die Permission "player" im Plugin-Manifest.
     */
    player: {
      /**
       * Registriert einen Player-Provider.
       * @param {object} spec  { id, name, play, pause, stop, setVolume, getState }
       * @returns {{ unregister: Function }}
       */
      registerProvider(spec) {
        checkPlayerPermission();
        if (!spec || !spec.id) {
          throw new Error(`[PluginAPI:${pluginId}] registerProvider: spec.id ist erforderlich.`);
        }
        return playerManager.registerProvider(spec.id, spec);
      },

      /**
       * Entfernt einen zuvor registrierten Provider.
       * @param {string} id  Provider-ID
       */
      unregisterProvider(id) {
        checkPlayerPermission();
        playerManager.unregisterProvider(id);
      },

      /**
       * Aktiviert einen registrierten Provider als aktiven Player.
       * @param {string} id  Provider-ID
       */
      setActiveProvider(id) {
        checkPlayerPermission();
        playerManager.setActiveProvider(id);
      },

      /**
       * Gibt den aktuellen Player-State zurück.
       * @returns {object}
       */
      getState() {
        return playerManager.getState();
      },

      /**
       * Abonniert Player-State-Änderungen.
       * @param {Function} callback
       * @returns {Function}  unsubscribe()
       */
      subscribe(callback) {
        return playerManager.subscribe(callback);
      },

      /**
       * Meldet einen Provider-State an den PlayerManager.
       * Nur der aktive Provider darf den globalen State überschreiben.
       * @param {string} providerId
       * @param {object} state
       */
      updateProviderState(providerId, state) {
        checkPlayerPermission();
        playerManager.updateProviderState(providerId, state);
      }
    },

    webSession: {
      create(options) {
        checkWebSessionPermission();
        if (!options || typeof options !== "object" || Array.isArray(options)) {
          throw new TypeError("webSession.create erwartet ein Objekt.");
        }
        if (options.pluginId !== pluginId) {
          const error = new Error("pluginId muss der Plugin-ID des aktuellen Kontexts entsprechen.");
          error.code = "INVALID_ARGUMENT";
          throw error;
        }
        const sessionId = options.sessionId;
        if (typeof sessionId === "string" && webSessionSessions.has(sessionId)) {
          const error = new Error("Diese Web-Sitzung ist in diesem Plugin-Kontext bereits verwaltet.");
          error.code = "SESSION_EXISTS";
          throw error;
        }
        const state = PluginWebSessionManager.create(pluginId, meta.webSessionOrigins, options);
        if (typeof sessionId === "string") webSessionSessions.add(sessionId);
        // Ohne `web-session-media` bleibt die Antwort auf die grobe
        // Sitzungsidentität beschränkt; Metadaten und Aktionen erfordern
        // getState()/onState()/command() mit der zusätzlichen Capability.
        return { sessionId, state: state.state };
      },
      /**
       * Meldet die tatsächlich verfügbaren Funktionen dieser Core-Version.
       * Plugins, die eine nicht verfügbare Fähigkeit (z. B. DRM) benötigen,
       * müssen ihren Provider verständlich deaktivieren.
       */
      getCapabilities() {
        checkWebSessionPermission();
        return {
          commands: { ...PluginWebSessionManager.SUPPORTED_COMMANDS },
          capabilities: ["web-session", "web-session-media", "encrypted-media"]
            .filter((capabilityId) => hasGrantedCapability(capabilityId)),
          encryptedMedia: hasGrantedCapability("encrypted-media"),
          origins: [...meta.webSessionOrigins]
        };
      },
      openLogin(sessionId) {
        checkWebSessionPermission();
        return PluginWebSessionManager.openLogin(pluginId, sessionId);
      },
      load(sessionId, targetUrl) {
        checkWebSessionPermission();
        return PluginWebSessionManager.load(pluginId, sessionId, targetUrl);
      },
      getState(sessionId) {
        checkWebSessionPermission("web-session-media");
        return PluginWebSessionManager.getState(pluginId, sessionId);
      },
      command(sessionId, command) {
        checkWebSessionPermission("web-session-media");
        return PluginWebSessionManager.command(pluginId, sessionId, command);
      },
      show(sessionId, bounds) {
        checkWebSessionPermission();
        return PluginWebSessionManager.show(pluginId, sessionId, bounds);
      },
      hide(sessionId) {
        checkWebSessionPermission();
        return PluginWebSessionManager.hide(pluginId, sessionId);
      },
      reload(sessionId) {
        checkWebSessionPermission();
        return PluginWebSessionManager.reload(pluginId, sessionId);
      },
      destroy(sessionId) {
        checkWebSessionPermission();
        const result = PluginWebSessionManager.destroy(pluginId, sessionId);
        webSessionSessions.delete(sessionId);
        return result;
      },
      onState(sessionId, callback) {
        checkWebSessionPermission("web-session-media");
        const unsubscribe = PluginWebSessionManager.onState(pluginId, sessionId, callback);
        webSessionSubscriptions.add(unsubscribe);
        return () => {
          unsubscribe();
          webSessionSubscriptions.delete(unsubscribe);
        };
      },
      onNavigationRequired(sessionId, callback) {
        checkWebSessionPermission();
        const unsubscribe = PluginWebSessionManager.onNavigationRequired(pluginId, sessionId, callback);
        webSessionSubscriptions.add(unsubscribe);
        return () => {
          unsubscribe();
          webSessionSubscriptions.delete(unsubscribe);
        };
      },
      onError(sessionId, callback) {
        checkWebSessionPermission();
        const unsubscribe = PluginWebSessionManager.onError(pluginId, sessionId, callback);
        webSessionSubscriptions.add(unsubscribe);
        return () => {
          unsubscribe();
          webSessionSubscriptions.delete(unsubscribe);
        };
      }
    },

    mediaControls: {
      getState() {
        checkMediaControlsPermission();
        return getPublicMediaState();
      },
      getCapabilities() {
        checkMediaControlsPermission();
        return playerManager.getMediaCapabilities();
      },
      subscribe(callback) {
        checkMediaControlsPermission();
        if (typeof callback !== "function") throw new TypeError("mediaControls.subscribe erwartet eine Funktion");
        const unsubscribe = playerManager.subscribe(() => callback(getPublicMediaState()));
        playerSubscriptions.add(unsubscribe);
        return () => {
          unsubscribe();
          playerSubscriptions.delete(unsubscribe);
        };
      },
      requestAction(action) {
        checkMediaControlsPermission();
        if (typeof action !== "string" || !["play", "pause", "next", "previous"].includes(action)) {
          return Promise.resolve({ success: false, error: { code: "INVALID_ACTION", message: "Ungültige Medienaktion." } });
        }
        return playerManager.requestMediaAction(action);
      }
    },

    dispose() {
      for (const unsubscribe of playerSubscriptions) unsubscribe();
      playerSubscriptions.clear();
      for (const unsubscribe of webSessionSubscriptions) unsubscribe();
      webSessionSubscriptions.clear();
      PluginWebSessionManager.hidePlugin(pluginId);
      webSessionSessions.clear();
    }

  };

  return api;
}

module.exports = {
  create
};