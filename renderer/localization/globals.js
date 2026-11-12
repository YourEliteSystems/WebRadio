import { createLocalizationAPI } from '../../electron/core/localization/LocalizationAPI.js';
import { getActiveManager } from './instance.js';

/**
 * Gescopte Localization-APIs für Renderer-Code, der nicht über React läuft
 * (Plugin-Ansichten, imperative Theme-Oberflächen).
 *
 * Jede Scope-Instanz ist auf `plugin.<id>.*` bzw. `theme.<id>.*` beschränkt:
 * relative Schlüssel werden automatisch qualifiziert, fremde Namensräume und
 * Anwendungstexte werden abgelehnt. Schreibzugriffe existieren nicht.
 *
 * Hinweis zur Isolation: Plugin-Renderer-Skripte laufen – wie in der
 * bestehenden Architektur – im gemeinsamen Renderer-Kontext. Die Isolation
 * ist daher auf API-Ebene durchgesetzt (Scope + Schlüsselprüfung). Der
 * Main-Prozess und die Plugin-Kontexte sind streng pro Plugin getrennt.
 */

const instances = new Map();

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function scoped(type, id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;

  const manager = getActiveManager();
  if (!manager) return null;

  const key = `${type}:${id}`;
  if (!instances.has(key)) {
    instances.set(
      key,
      createLocalizationAPI({
        manager,
        scope: { type, id },
        onWarning: (message) => console.warn(`[i18n:${key}]`, message)
      })
    );
  }
  return instances.get(key);
}

/**
 * Installiert die globalen, gescopten APIs. Wird einmalig vom
 * LocalizationProvider aufgerufen.
 */
export function installScopedLocalizationAPIs() {
  if (typeof window === 'undefined') return;

  window.pluginLocalization = Object.freeze({
    forPlugin: (pluginId) => scoped('plugin', pluginId)
  });

  window.themeLocalization = Object.freeze({
    forTheme: (themeId) => scoped('theme', themeId)
  });
}

/**
 * Entfernt alle zwischengespeicherten Scopes und ihre Listener.
 * Wird beim Abbau des Providers verwendet (keine Speicherlecks).
 */
export function disposeScopedLocalizationAPIs() {
  for (const api of instances.values()) {
    try {
      api.dispose();
    } catch {
      /* bereits freigegeben */
    }
  }
  instances.clear();
}
