import { useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { LocalizationContext } from './LocalizationProvider.jsx';

/**
 * Reaktive Sprachinformationen des Providers.
 *
 * `useSyncExternalStore` abonniert ausschließlich den LocalizationManager.
 * Nur Komponenten, die diesen Hook verwenden, rendern bei einem
 * Sprachwechsel neu – die übrige Anwendung bleibt unberührt.
 */
function useLocalizationState(manager) {
  const subscribe = useCallback((listener) => manager.subscribe(listener), [manager]);
  const getSnapshot = useCallback(() => manager.getSnapshot(), [manager]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Zugriff auf Übersetzungen und Formatierung.
 *
 * @returns {{
 *   t: (key: string, params?: Record<string, unknown>) => string,
 *   locale: string,
 *   preference: string,
 *   systemLocale: string | null,
 *   supportedLocales: string[],
 *   languages: Array<{id: string, label: string}>,
 *   setLanguage: (preference: string) => Promise<{ok: boolean, error?: string}>,
 *   error: string | null,
 *   formatDate: Function,
 *   formatTime: Function,
 *   formatDateTime: Function,
 *   formatNumber: Function,
 *   formatPercent: Function,
 *   formatCurrency: Function,
 *   formatRelativeFromNow: Function
 * }}
 */
export function useTranslation() {
  const context = useContext(LocalizationContext);

  if (!context) {
    throw new Error('useTranslation() muss innerhalb von <LocalizationProvider> verwendet werden.');
  }

  const { manager, setLanguage, error, languages } = context;
  const state = useLocalizationState(manager);

  // `t` bleibt über Sprachwechsel hinweg stabil: Der Manager liest die aktive
  // Sprache selbst, das Re-Render kommt aus dem Store-Abonnement.
  const t = useCallback((key, params) => manager.t(key, params), [manager]);

  // Dokumenttitel und -sprache an die aktive Sprache anpassen.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  return {
    t,
    locale: state.locale,
    preference: state.preference,
    systemLocale: state.systemLocale,
    supportedLocales: state.supported,
    languages,
    setLanguage,
    error,
    formatDate: manager.formatDate.bind(manager),
    formatTime: manager.formatTime.bind(manager),
    formatDateTime: manager.formatDateTime.bind(manager),
    formatNumber: manager.formatNumber.bind(manager),
    formatPercent: manager.formatPercent.bind(manager),
    formatCurrency: manager.formatCurrency.bind(manager),
    formatRelativeFromNow: manager.formatRelativeFromNow.bind(manager)
  };
}

export default useTranslation;
