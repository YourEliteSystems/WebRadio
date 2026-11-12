import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { LocalizationManager } from '../../electron/core/localization/LocalizationManager.js';
import { detect } from '../../electron/core/localization/LanguageDetector.js';
import { LANGUAGE_LABELS, SYSTEM_PREFERENCE } from '../../electron/core/localization/types.js';
import { FALLBACK_LOCALE } from './resources.js';
import { setActiveManager } from './instance.js';
import { installScopedLocalizationAPIs, disposeScopedLocalizationAPIs } from './globals.js';

export const LocalizationContext = createContext(null);

/**
 * Erzeugt den Renderer-Manager mit den Katalogen aus dem Preload-Bootstrap.
 * Diese stammen aus `userData/localization/` – der Renderer bündelt keine
 * eigenen Kataloge mehr. Die Systemsprache dient nur als Startwert.
 */
function createManager() {
  const bootstrap = typeof window !== 'undefined' ? window.localizationAPI?.initial : null;
  const catalogs = bootstrap?.catalogs && typeof bootstrap.catalogs === 'object' ? bootstrap.catalogs : {};
  const state = bootstrap?.state || null;

  const detection = detect(
    typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages : []
  );

  return new LocalizationManager({
    resources: catalogs,
    locale: state?.locale || detection.locale,
    preference: state?.preference || SYSTEM_PREFERENCE,
    systemLocale: state?.systemLocale || detection.systemLocale,
    fallbackLocale: FALLBACK_LOCALE,
    isDevelopment: false,
    onWarning: (message) => console.warn('[i18n]', message)
  });
}

/**
 * LocalizationProvider – stellt Übersetzungen, aktive Sprache und den
 * Sprachwechsel für die gesamte React-Anwendung bereit.
 *
 * Sprachwechsel werden sofort lokal angewendet (kein Neustart, kein Flackern)
 * und anschließend über die bestehende Preload-Schnittstelle persistiert.
 * Scheitert das Speichern, wird der vorherige Zustand wiederhergestellt.
 */
export function LocalizationProvider({ children }) {
  const [manager] = useState(() => {
    const instance = createManager();
    // Imperative DOM-Komponenten (Plugin-Ansichten) nutzen dieselbe Instanz.
    setActiveManager(instance);
    // Gescopte APIs für Plugin-/Theme-Oberflächen ohne React installieren.
    installScopedLocalizationAPIs();
    return instance;
  });
  const [error, setError] = useState(null);

  // Zustand vom Main-Prozess übernehmen (Persistenz + Broadcast).
  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.localizationAPI : null;
    let active = true;

    if (!api) return undefined;

    // Fallback, falls der synchrone Bootstrap nicht verfügbar war.
    if (Object.keys(manager.getResources()).length === 0 && typeof api.getCatalogs === 'function') {
      Promise.resolve(api.getCatalogs())
        .then((result) => {
          if (active && result?.ok && result.catalogs) {
            manager.setResources(result.catalogs);
          }
        })
        .catch((err) => console.warn('[i18n] Kataloge konnten nicht geladen werden:', err));
    }

    // Plugin-Kataloge werden gezielt nachgeladen (reine Daten, kein Code).
    // Die Broadcast-Nachricht enthält nur die IDs, keine Texte.
    const syncPluginCatalogs = async (state) => {
      const ids = Array.isArray(state?.pluginIds) ? state.pluginIds : [];
      if (ids.length === 0 || typeof api.getPluginCatalogs !== 'function') return;

      for (const pluginId of ids) {
        try {
          const result = await api.getPluginCatalogs(pluginId);
          if (active && result?.ok && result.catalogs) {
            manager.registerPluginTranslations(pluginId, result.catalogs);
          }
        } catch (err) {
          console.warn(`[i18n] Plugin-Übersetzungen für ${pluginId} nicht verfügbar:`, err);
        }
      }
    };

    const applyState = (state) => {
      if (!active || !state) return;
      manager.syncState({
        locale: state.locale,
        preference: state.preference,
        systemLocale: state.systemLocale
      });
      syncPluginCatalogs(state);
      syncThemeCatalogs(state);
    };

    // Theme-Metadaten (Name, Beschreibung, Einstellungs-/Hilfetexte) werden
    // ebenfalls als reine Daten nachgeladen, damit Theme-Oberflächen ohne
    // React dieselbe API nutzen können.
    const syncThemeCatalogs = async (state) => {
      const ids = Array.isArray(state?.themeIds) ? state.themeIds : [];
      if (ids.length === 0 || typeof api.getThemeCatalogs !== 'function') return;

      for (const themeId of ids) {
        try {
          const result = await api.getThemeCatalogs(themeId);
          if (active && result?.ok && result.catalogs) {
            manager.registerThemeTranslations(themeId, result.catalogs);
          }
        } catch (err) {
          console.warn(`[i18n] Theme-Übersetzungen für ${themeId} nicht verfügbar:`, err);
        }
      }
    };

    Promise.resolve(api.getState?.())
      .then((state) => {
        if (!state?.ok) return;
        applyState(state);
      })
      .catch((err) => {
        console.warn('[i18n] Sprachzustand konnte nicht geladen werden:', err);
      });

    const unsubscribe = api.onChanged?.(applyState);

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [manager]);

  // Beim Abbau des Providers alle gescopten Listener entfernen.
  useEffect(() => () => disposeScopedLocalizationAPIs(), []);

  // Sprachwechsel: lokal sofort, danach persistieren.
  const setLanguage = useCallback(
    async (preference) => {
      const previous = manager.preference;
      const applied = manager.setPreference(preference);

      if (!applied.ok) {
        return { ok: false, error: applied.reason || 'invalid-preference' };
      }

      const api = typeof window !== 'undefined' ? window.localizationAPI : null;
      if (!api?.setLanguage) {
        setError(null);
        return { ok: true, locale: manager.locale, persisted: false };
      }

      try {
        const result = await api.setLanguage(preference);
        if (result?.ok) {
          manager.syncState({
            locale: result.locale,
            preference: result.preference,
            systemLocale: manager.getState().systemLocale
          });
          setError(null);
          return { ok: true, locale: result.locale, persisted: true };
        }

        manager.setPreference(previous);
        setError(result?.error || 'persist-failed');
        return { ok: false, error: result?.error || 'persist-failed' };
      } catch (err) {
        manager.setPreference(previous);
        setError('ipc-failed');
        console.warn('[i18n] Sprache konnte nicht gespeichert werden:', err);
        return { ok: false, error: 'ipc-failed' };
      }
    },
    [manager]
  );

  const value = useMemo(
    () => ({
      manager,
      setLanguage,
      error,
      languages: manager.supportedLocales.map((id) => ({ id, label: LANGUAGE_LABELS[id] || id }))
    }),
    [manager, setLanguage, error]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export default LocalizationProvider;
