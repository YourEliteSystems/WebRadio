/**
 * Rendererweite Referenz auf den aktiven LocalizationManager.
 *
 * React-Komponenten verwenden `useTranslation()`. Imperativ erzeugte
 * DOM-Knoten (Plugin-Ansichten, Slots) können keinen Hook verwenden und
 * greifen deshalb über diese Referenz auf dieselbe Manager-Instanz zu –
 * damit gibt es genau einen Sprachzustand pro Fenster.
 */

/** @type {import('../../electron/core/localization/LocalizationManager').LocalizationManager|null} */
let activeManager = null;

/**
 * @param {import('../../electron/core/localization/LocalizationManager').LocalizationManager|null} manager
 */
export function setActiveManager(manager) {
  activeManager = manager;
}

/**
 * @returns {import('../../electron/core/localization/LocalizationManager').LocalizationManager|null}
 */
export function getActiveManager() {
  return activeManager;
}

/**
 * Übersetzung außerhalb von React. Ohne initialisierten Manager wird der
 * Schlüssel selbst zurückgegeben – nie ein leerer Text.
 *
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params) {
  if (!activeManager) return key;
  return activeManager.t(key, params);
}
