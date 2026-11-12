"use strict";

/**
 * LocalizationAPI
 *
 * Eine einzige Implementierung der Übersetzungslogik – aber drei
 * Zugriffsschnittstellen mit unterschiedlichen Rechten:
 *
 *   core   : vollständiger Lesezugriff auf Anwendungs-, Plugin- und
 *            Theme-Texte (für Tray, native Dialoge, Fenstertitel)
 *   plugin : ausschließlich `plugin.<plugin-id>.*`
 *   theme  : ausschließlich `theme.<theme-id>.*`
 *
 * Es gibt bewusst **keine** Schreib-API: Kataloge werden ausschließlich vom
 * Core verwaltet (LocalizationCatalogStore). Ein Plugin oder Theme kann
 * weder globale Texte noch fremde Namensräume verändern oder lesen.
 */

const MAX_KEY_LENGTH = 200;
const MAX_LISTENERS = 100;
const KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;

class LocalizationAccessError extends Error {
  constructor(message, code = "ACCESS_DENIED") {
    super(message);
    this.name = "LocalizationAccessError";
    this.code = code;
  }
}

function isValidKey(key) {
  if (typeof key !== "string" || key.length === 0 || key.length > MAX_KEY_LENGTH) return false;
  const segments = key.split(".");
  return segments.every((segment) => KEY_SEGMENT.test(segment));
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== "object") {
    throw new TypeError("LocalizationAPI benötigt einen Scope");
  }
  if (scope.type === "core") return { type: "core", id: null };
  if (scope.type === "plugin" || scope.type === "theme") {
    if (typeof scope.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(scope.id)) {
      throw new TypeError(`Ungültige ${scope.type}-ID für LocalizationAPI`);
    }
    return { type: scope.type, id: scope.id };
  }
  throw new TypeError(`Unbekannter Localization-Scope: ${String(scope.type)}`);
}

/**
 * @param {Object} options
 * @param {import('./LocalizationManager').LocalizationManager} options.manager
 * @param {{type:'core'|'plugin'|'theme', id?:string}} options.scope
 * @param {(message: string) => void} [options.onWarning]
 * @returns {Object} eingefrorene, gescopte API
 */
function createLocalizationAPI({ manager, scope, onWarning }) {
  if (!manager || typeof manager.t !== "function") {
    throw new TypeError("LocalizationAPI benötigt einen LocalizationManager");
  }

  const normalized = normalizeScope(scope);
  const prefix = normalized.type === "core" ? "" : `${normalized.type}.${normalized.id}.`;
  /** @type {Map<Function, Function>} Listener → Manager-Unsubscribe */
  const listeners = new Map();
  const warn = typeof onWarning === "function" ? onWarning : () => {};

  function qualify(key) {
    if (!isValidKey(key)) {
      throw new LocalizationAccessError(
        `Ungültiger Übersetzungsschlüssel: ${String(key).slice(0, 80)}`,
        "INVALID_KEY"
      );
    }

    if (normalized.type === "core") return key;

    if (key.startsWith("plugin.") || key.startsWith("theme.")) {
      if (key.startsWith(prefix)) return key;
      throw new LocalizationAccessError(
        `${normalized.type} "${normalized.id}" darf nicht auf "${key}" zugreifen.`
      );
    }

    return `${prefix}${key}`;
  }

  const api = {
    scope: Object.freeze({ type: normalized.type, id: normalized.id }),

    t(key, params) {
      return manager.t(qualify(key), params);
    },

    has(key) {
      return manager.has(qualify(key));
    },

    getLocale() {
      return manager.locale;
    },

    getPreferredLocale() {
      return manager.preference;
    },

    getAvailableLocales() {
      if (normalized.type === "core") return manager.supportedLocales;
      const catalogs = normalized.type === "plugin"
        ? manager.getPluginCatalogSet(normalized.id)
        : manager.getThemeCatalogSet(normalized.id);
      if (!catalogs) return [];
      return Object.keys(catalogs).sort();
    },

    /**
     * Registriert einen Sprachwechsel-Listener. Die Rückgabe entfernt ihn
     * wieder; `dispose()` entfernt alle verbliebenen Listener.
     */
    onLocaleChanged(callback) {
      if (typeof callback !== "function") {
        throw new TypeError("onLocaleChanged erwartet eine Funktion");
      }
      if (listeners.size >= MAX_LISTENERS) {
        throw new LocalizationAccessError("Zu viele Sprachwechsel-Listener.", "TOO_MANY_LISTENERS");
      }

      const listener = (state) => {
        try {
          callback(state.locale, { preference: state.preference, systemLocale: state.systemLocale });
        } catch (error) {
          warn(`Sprachwechsel-Listener (${normalized.type}:${normalized.id || "core"}) fehlgeschlagen: ${error.message}`);
        }
      };

      const unsubscribeManager = manager.subscribe(listener);
      listeners.set(listener, unsubscribeManager);

      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        unsubscribeManager();
      };
    },

    formatDate(value, options) {
      return manager.formatDate(value, options);
    },

    formatTime(value, options) {
      return manager.formatTime(value, options);
    },

    formatDateTime(value, options) {
      return manager.formatDateTime(value, options);
    },

    formatNumber(value, options) {
      return manager.formatNumber(value, options);
    },

    formatCurrency(value, currency, options) {
      return manager.formatCurrency(value, currency, options);
    },

    formatRelativeTime(value, unit, options) {
      return manager.formatRelativeTime(value, unit, options);
    },

    /**
     * Anzahl der aktuell registrierten Listener (Diagnose/Leak-Prüfung).
     */
    getListenerCount() {
      return listeners.size;
    },

    /**
     * Entfernt alle Listener dieser API-Instanz. Wird beim Deaktivieren oder
     * Entladen eines Plugins bzw. Themes aufgerufen.
     */
    dispose() {
      for (const [listener, unsubscribe] of [...listeners]) {
        listeners.delete(listener);
        unsubscribe();
      }
    }
  };

  return Object.freeze(api);
}

module.exports = {
  MAX_KEY_LENGTH,
  MAX_LISTENERS,
  LocalizationAccessError,
  isValidKey,
  createLocalizationAPI
};
