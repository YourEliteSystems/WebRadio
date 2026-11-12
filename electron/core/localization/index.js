"use strict";

/**
 * Öffentliche Schnittstelle der Localization Engine.
 *
 * Main-Prozess: `LocalizationService` (Dateien, Persistenz, IPC-Broadcast).
 * Renderer: `LocalizationManager` mit gebündelten Katalogen.
 * Gemeinsam genutzt: Detector, Resolver, Formatter, Katalogvalidierung.
 */

const types = require("./types");
const LanguageDetector = require("./LanguageDetector");
const { TranslationResolver, lookup, interpolate } = require("./TranslationResolver");
const { LocaleFormatter } = require("./LocaleFormatter");
const { LocalizationManager } = require("./LocalizationManager");
const { TranslationLoader } = require("./TranslationLoader");
const CatalogValidator = require("./CatalogValidator");
const PluginLocalization = require("./PluginLocalization");
const LocalizationService = require("./LocalizationService");

module.exports = {
    ...types,
    LanguageDetector,
    TranslationResolver,
    lookup,
    interpolate,
    LocaleFormatter,
    LocalizationManager,
    TranslationLoader,
    CatalogValidator,
    PluginLocalization,
    LocalizationService
};
