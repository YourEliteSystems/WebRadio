"use strict";

/**
 * localization-api.test.js
 *
 * Prüft die zentrale Localization API (Core/Plugin/Theme), die ausschließliche
 * Laufzeitquelle `userData/localization/`, die Katalogverwaltung bei
 * Installation/Update/Rollback/Deinstallation sowie die Listener- und
 * Namespace-Isolation.
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { LocalizationManager } = require("../../electron/core/localization/LocalizationManager");
const { LocalizationCatalogStore } = require("../../electron/core/localization/LocalizationCatalogStore");
const { LocalizationService } = require("../../electron/core/localization/LocalizationService");
const { createLocalizationAPI, LocalizationAccessError } = require("../../electron/core/localization/LocalizationAPI");
const { validatePluginLocalization } = require("../../electron/core/localization/PluginLocalization");
const PluginPackageInstaller = require("../../electron/core/plugins/update/PluginPackageInstaller");
const ZipArchive = require("../../electron/core/plugins/update/ZipArchive");

console.log("==========================================");
console.log("Localization-API-Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  ❌ ${name}: ${error.message}`);
    failures.push({ name, error });
    failed += 1;
  }
}

// Asynchrone Fälle werden gesammelt und nach den synchronen Tests der Reihe
// nach ausgeführt, damit die Zusammenfassung erst am Ende erscheint.
const asyncCases = [];
function asyncTest(name, fn) {
  asyncCases.push({ name, fn });
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-i18n-api-"));
const bundledDir = path.join(__dirname, "../../electron/core/localization/locales");

function tempDir(name) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createStore(userDataPath) {
  return new LocalizationCatalogStore({ userDataPath, bundledDir });
}

function catalogs() {
  return {
    "de-DE": {
      greeting: "Hallo {name}",
      nested: { deep: "Tief" }
    },
    "en-US": {
      greeting: "Hello {name}",
      nested: { deep: "Deep" }
    }
  };
}

function createManager() {
  return new LocalizationManager({
    resources: catalogs(),
    locale: "de-DE",
    preference: "de-DE",
    fallbackLocale: "en-US"
  });
}

function pluginLocalization() {
  return {
    "de-DE": {
      settings: { title: "Einstellungen" },
      greet: "Hallo {name}"
    },
    "en-US": {
      settings: { title: "Settings" },
      greet: "Hello {name}"
    }
  };
}

function themeLocalization() {
  return {
    "de-DE": { name: "Mitternacht", description: "Dunkles Theme", settings: { accent: "Akzent" } },
    "en-US": { name: "Midnight", description: "Dark theme", settings: { accent: "Accent" } }
  };
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data ?? "");
    const crc = ZipArchive.crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const directory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, directory, eocd]);
}

function hashDir(dir) {
  const hash = crypto.createHash("sha256");
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      hash.update(entry.name);
      if (entry.isDirectory()) walk(full);
      else hash.update(fs.readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest("hex");
}

// ─────────────────────────────────────────────
// userData als einzige Laufzeitquelle
// ─────────────────────────────────────────────

test("Store: initiale Bereitstellung aus mitgelieferten Katalogen", () => {
  const userData = tempDir("seed");
  const store = createStore(userData);
  const result = store.ensureAppCatalogs(["de-DE", "en-US"]);

  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.created.sort(), ["de-DE", "en-US"]);
  assert.ok(fs.existsSync(path.join(store.root, "de-DE.json")));
  assert.ok(fs.existsSync(path.join(store.root, "en-US.json")));
});

test("Store: Laufzeit liest ausschließlich userData", () => {
  const userData = tempDir("runtime");
  const store = createStore(userData);
  store.ensureAppCatalogs(["de-DE", "en-US"]);

  // Änderung in userData muss sichtbar sein – ein gebündelter Katalog darf
  // sie nicht überschreiben.
  const file = path.join(store.root, "de-DE.json");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  catalog.marker = "nur-userData";
  fs.writeFileSync(file, JSON.stringify(catalog));

  const loaded = store.loadAppCatalogs(["de-DE", "en-US"]);
  assert.strictEqual(loaded.resources["de-DE"].marker, "nur-userData");
});

test("Store: neue Katalogschluessel werden ergaenzt, Nutzerwerte bleiben erhalten", () => {
  const userData = tempDir("merge");
  const customBundle = tempDir("merge-bundle");
  const sourceFile = path.join(bundledDir, "de-DE.json");
  const bundledFile = path.join(customBundle, "de-DE.json");
  fs.copyFileSync(sourceFile, bundledFile);

  const store = new LocalizationCatalogStore({ userDataPath: userData, bundledDir: customBundle });
  const first = store.ensureAppCatalogs(["de-DE"]);
  assert.ok(first.created.includes("de-DE"), JSON.stringify(first));

  // Nutzerwert im Laufzeitkatalog setzen.
  const userFile = path.join(store.root, "de-DE.json");
  const userCatalog = JSON.parse(fs.readFileSync(userFile, "utf8"));
  userCatalog.navigation.radio = "Nutzerwert";
  fs.writeFileSync(userFile, JSON.stringify(userCatalog));

  // Neuer Schluessel im mitgelieferten Katalog einer spaeteren Version.
  const bundleCatalog = JSON.parse(fs.readFileSync(bundledFile, "utf8"));
  bundleCatalog.releaseChannelTest = { badge: "RC" };
  bundleCatalog.navigation.radio = "Bundle-Radio";
  fs.writeFileSync(bundledFile, JSON.stringify(bundleCatalog));

  const second = store.ensureAppCatalogs(["de-DE"]);
  assert.ok(second.updated.includes("de-DE"), JSON.stringify(second));

  const merged = JSON.parse(fs.readFileSync(userFile, "utf8"));
  assert.strictEqual(merged.releaseChannelTest.badge, "RC", "neuer Schluessel fehlt");
  assert.strictEqual(merged.navigation.radio, "Nutzerwert", "Nutzerwert wurde ueberschrieben");

  const third = store.ensureAppCatalogs(["de-DE"]);
  assert.deepStrictEqual(third.updated, [], "zweiter Lauf darf nichts mehr aendern");
});

test("Store: fehlende Datei wird nicht aus dem Bundle nachgeladen", () => {
  const userData = tempDir("missing");
  const store = createStore(userData);
  store.ensureAppCatalogs(["de-DE", "en-US"]);
  fs.unlinkSync(path.join(store.root, "en-US.json"));

  const loaded = store.loadAppCatalogs(["de-DE", "en-US"]);
  assert.strictEqual(loaded.resources["en-US"], undefined);
  assert.ok(loaded.errors.some((error) => error.startsWith("en-US")));
});

test("Store: ungültiger Katalog wird gesichert und wiederhergestellt", () => {
  const userData = tempDir("restore");
  const store = createStore(userData);
  store.ensureAppCatalogs(["de-DE", "en-US"]);

  const file = path.join(store.root, "de-DE.json");
  fs.writeFileSync(file, "{ kaputt");

  const result = store.ensureAppCatalogs(["de-DE"]);
  assert.ok(result.restored.includes("de-DE"));
  const backups = fs.readdirSync(store.backupsRoot);
  assert.ok(backups.some((name) => name.startsWith("de-DE")));

  const loaded = store.loadAppCatalogs(["de-DE"]);
  assert.ok(loaded.resources["de-DE"]);
  assert.ok(loaded.resources["de-DE"].navigation);
});

// ─────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────

test("Core-API: t, Locales und Formatierung", () => {
  const manager = createManager();
  const api = createLocalizationAPI({ manager, scope: { type: "core" } });

  assert.strictEqual(api.t("greeting", { name: "Ada" }), "Hallo Ada");
  assert.strictEqual(api.t("nested.deep"), "Tief");
  assert.strictEqual(api.getLocale(), "de-DE");
  assert.strictEqual(api.getPreferredLocale(), "de-DE");
  assert.deepStrictEqual(api.getAvailableLocales(), ["de-DE", "en-US"]);

  const date = new Date(Date.UTC(2026, 10, 12));
  assert.notStrictEqual(api.formatDate(date), "");
  assert.strictEqual(api.formatNumber(1234.5), "1.234,5");
  assert.strictEqual(api.formatCurrency(12.5, "EUR").includes("12,50"), true);
  assert.strictEqual(api.formatRelativeTime(-2, "day").length > 0, true);

  // Relative Angaben folgen der aktiven Sprache.
  const germanRelative = api.formatRelativeTime(-2, "day");
  manager.setPreference("en-US");
  assert.notStrictEqual(api.formatRelativeTime(-2, "day"), germanRelative);
});

test("Core-API: onLocaleChanged, Unsubscribe und dispose", () => {
  const manager = createManager();
  const api = createLocalizationAPI({ manager, scope: { type: "core" } });
  const seen = [];

  const unsubscribe = api.onLocaleChanged((locale) => seen.push(locale));
  assert.strictEqual(api.getListenerCount(), 1);

  manager.setPreference("en-US");
  assert.deepStrictEqual(seen, ["en-US"]);

  unsubscribe();
  assert.strictEqual(api.getListenerCount(), 0);
  manager.setPreference("de-DE");
  assert.deepStrictEqual(seen, ["en-US"]);

  const second = api.onLocaleChanged(() => {});
  assert.strictEqual(api.getListenerCount(), 1);
  api.dispose();
  assert.strictEqual(api.getListenerCount(), 0);

  // Ein weiterer Wechsel darf keinen Fehler auslösen.
  manager.setPreference("en-US");
  assert.ok(second);
});

test("Core-API: ungültige Schlüssel werden abgelehnt", () => {
  const manager = createManager();
  const api = createLocalizationAPI({ manager, scope: { type: "core" } });
  assert.throws(() => api.t(""), LocalizationAccessError);
  assert.throws(() => api.t("bad key"), LocalizationAccessError);
  assert.throws(() => api.t("a..b"), LocalizationAccessError);
  assert.throws(() => api.t(42), LocalizationAccessError);
});

// ─────────────────────────────────────────────
// Plugin-API
// ─────────────────────────────────────────────

test("Plugin-API: eigene Übersetzungen (relativ und qualifiziert)", () => {
  const manager = createManager();
  const localization = validatePluginLocalization("mediahub", pluginLocalization());
  assert.strictEqual(localization.valid, true, localization.errors.join("; "));
  manager.registerPluginTranslations("mediahub", localization.catalogs);

  const api = createLocalizationAPI({ manager, scope: { type: "plugin", id: "mediahub" } });
  assert.strictEqual(api.t("settings.title"), "Einstellungen");
  assert.strictEqual(api.t("plugin.mediahub.settings.title"), "Einstellungen");
  assert.strictEqual(api.t("greet", { name: "Ada" }), "Hallo Ada");
  assert.deepStrictEqual(api.getAvailableLocales(), ["de-DE", "en-US"]);
});

test("Plugin-API: fremder Namensraum wird blockiert", () => {
  const manager = createManager();
  manager.registerPluginTranslations("mediahub", validatePluginLocalization("mediahub", pluginLocalization()).catalogs);
  manager.registerPluginTranslations("other", validatePluginLocalization("other", {
    "de-DE": { secret: "Geheim" },
    "en-US": { secret: "Secret" }
  }).catalogs);

  const api = createLocalizationAPI({ manager, scope: { type: "plugin", id: "mediahub" } });
  assert.throws(() => api.t("plugin.other.secret"), /darf nicht auf/);
  assert.throws(() => api.has("plugin.other.secret"), /darf nicht auf/);

  // Relativer Schlüssel landet immer im eigenen Namensraum.
  assert.notStrictEqual(api.t("secret"), "Geheim");
});

test("Plugin-API: keine globalen Texte und keine Schreibfunktionen", () => {
  const manager = createManager();
  const api = createLocalizationAPI({ manager, scope: { type: "plugin", id: "mediahub" } });

  // Anwendungstext ist nicht erreichbar (wird qualifiziert und bleibt leer).
  assert.notStrictEqual(api.t("greeting"), "Hallo {name}");

  assert.strictEqual(api.registerPluginTranslations, undefined);
  assert.strictEqual(api.setCatalog, undefined);
  assert.strictEqual(api.setResources, undefined);
  assert.ok(Object.isFrozen(api));
});

test("Plugin-API: ungültige Plugin-ID wird abgelehnt", () => {
  assert.throws(() => createLocalizationAPI({ manager: createManager(), scope: { type: "plugin", id: "Bad ID" } }), TypeError);
});

test("Plugin-API: Sprachwechsel erreicht aktive Plugins", () => {
  const manager = createManager();
  manager.registerPluginTranslations("mediahub", validatePluginLocalization("mediahub", pluginLocalization()).catalogs);
  const api = createLocalizationAPI({ manager, scope: { type: "plugin", id: "mediahub" } });

  const seen = [];
  api.onLocaleChanged((locale) => seen.push(locale));
  manager.setPreference("en-US");

  assert.deepStrictEqual(seen, ["en-US"]);
  assert.strictEqual(api.t("settings.title"), "Settings");

  // Deaktivieren/Entladen entfernt Listener restlos.
  api.dispose();
  assert.strictEqual(api.getListenerCount(), 0);
});

// ─────────────────────────────────────────────
// Theme-API (nur Metadaten)
// ─────────────────────────────────────────────

test("Theme-API: lokalisierte Metadaten", () => {
  const manager = createManager();
  manager.registerThemeTranslations("midnight", validatePluginLocalization("midnight", themeLocalization()).catalogs);

  const meta = manager.getThemeMetadata("midnight", { name: "Fallback", description: "Fallback" });
  assert.strictEqual(meta.name, "Mitternacht");
  assert.strictEqual(meta.description, "Dunkles Theme");
  assert.strictEqual(meta.settings.accent, "Akzent");

  manager.setPreference("en-US");
  const english = manager.getThemeMetadata("midnight", { name: "Fallback", description: "Fallback" });
  assert.strictEqual(english.name, "Midnight");

  // Unbekanntes Theme: Manifest-Werte bleiben sichtbar.
  const fallback = manager.getThemeMetadata("unknown", { name: "Original", description: "Beschreibung" });
  assert.deepStrictEqual(fallback, { name: "Original", description: "Beschreibung", settings: null });
});

test("Theme-API: fremde Themes und globale Texte blockiert", () => {
  const manager = createManager();
  manager.registerThemeTranslations("midnight", validatePluginLocalization("midnight", themeLocalization()).catalogs);

  const api = createLocalizationAPI({ manager, scope: { type: "theme", id: "midnight" } });
  assert.strictEqual(api.t("name"), "Mitternacht");
  assert.throws(() => api.t("theme.other.name"), /darf nicht auf/);
  assert.notStrictEqual(api.t("greeting"), "Hallo {name}");
});

// ─────────────────────────────────────────────
// Katalogverwaltung / Service
// ─────────────────────────────────────────────

function createService(userData) {
  const service = new LocalizationService();
  service.getUserDataPath = () => userData;
  service.initialize();
  return service;
}

test("Service: initialisiert aus userData und provisioniert Plugin-Kataloge", () => {
  const userData = tempDir("service");
  const service = createService(userData);

  assert.strictEqual(service.getState().ok, true);
  assert.equal(service.t("navigation.radio"), "Radio");

  const result = service.provisionPluginCatalogs("mediahub", pluginLocalization());
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(fs.existsSync(path.join(userData, "localization", "plugins", "mediahub", "de-DE.json")));

  const api = service.createPluginAPI("mediahub");
  assert.strictEqual(api.t("settings.title"), "Einstellungen");

  service.reset();
});

test("Service: unbekannte Plugin-Kataloge werden abgelehnt", () => {
  const userData = tempDir("service-invalid");
  const service = createService(userData);

  const result = service.provisionPluginCatalogs("mediahub", { "de-DE": { bad: "" } });
  assert.strictEqual(result.ok, false);

  service.reset();
});

test("Service: Update eines Plugins verändert keine anderen Kataloge", () => {
  const userData = tempDir("service-isolate");
  const service = createService(userData);

  service.provisionPluginCatalogs("alpha", { "de-DE": { title: "Alpha" }, "en-US": { title: "Alpha" } });
  service.provisionPluginCatalogs("beta", { "de-DE": { title: "Beta" }, "en-US": { title: "Beta" } });

  const betaBefore = hashDir(path.join(userData, "localization", "plugins", "beta"));

  service.provisionPluginCatalogs("alpha", { "de-DE": { title: "Alpha 2" }, "en-US": { title: "Alpha 2" } });

  const betaAfter = hashDir(path.join(userData, "localization", "plugins", "beta"));
  assert.strictEqual(betaBefore, betaAfter);
  assert.throws(() => service.createPluginAPI("alpha").t("plugin.beta.title"), /darf nicht auf/);

  service.reset();
});

test("Service: Rollback stellt vorherige Kataloge wieder her", () => {
  const userData = tempDir("service-rollback");
  const service = createService(userData);

  const first = service.provisionPluginCatalogs("mediahub", pluginLocalization());
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.backupPath, null);

  const second = service.provisionPluginCatalogs("mediahub", {
    "de-DE": { settings: { title: "Neu" } },
    "en-US": { settings: { title: "New" } }
  });
  assert.strictEqual(second.ok, true);
  assert.ok(second.backupPath);
  assert.strictEqual(service.t("plugin.mediahub.settings.title"), "Neu");

  const restored = service.restorePluginCatalogs("mediahub", second.backupPath);
  assert.strictEqual(restored.ok, true);
  assert.strictEqual(service.t("plugin.mediahub.settings.title"), "Einstellungen");

  service.reset();
});

test("Service: Deinstallation entfernt nur die eigenen Kataloge", () => {
  const userData = tempDir("service-remove");
  const service = createService(userData);

  service.provisionPluginCatalogs("alpha", { "de-DE": { title: "Alpha" }, "en-US": { title: "Alpha" } });
  service.provisionPluginCatalogs("beta", { "de-DE": { title: "Beta" }, "en-US": { title: "Beta" } });

  const removed = service.removePluginCatalogs("alpha");
  assert.strictEqual(removed.ok, true);
  assert.strictEqual(fs.existsSync(path.join(userData, "localization", "plugins", "alpha")), false);
  assert.ok(fs.existsSync(path.join(userData, "localization", "plugins", "beta")));
  assert.strictEqual(service.manager.getPluginCatalogSet("alpha"), null);

  service.reset();
});

test("Service: Theme-Kataloge und Metadaten aus userData", () => {
  const userData = tempDir("service-theme");
  const service = createService(userData);

  const result = service.provisionThemeCatalogs("midnight", themeLocalization());
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(fs.existsSync(path.join(userData, "localization", "themes", "midnight", "en-US.json")));

  const meta = service.getThemeMetadata("midnight", { name: "Fallback", description: "" });
  assert.strictEqual(meta.name, "Mitternacht");

  service.setLanguage("en-US");
  assert.strictEqual(service.getThemeMetadata("midnight", { name: "Fallback" }).name, "Midnight");

  service.setLanguage("system");
  service.reset();
});

test("Service: Sprachwechsel benachrichtigt Plugin-Listener und entfernt sie beim Dispose", () => {
  const userData = tempDir("service-listeners");
  const service = createService(userData);
  service.provisionPluginCatalogs("mediahub", pluginLocalization());

  const api = service.createPluginAPI("mediahub");
  const seen = [];
  api.onLocaleChanged((locale) => seen.push(locale));
  assert.strictEqual(api.getListenerCount(), 1);

  service.setLanguage("en-US");
  assert.deepStrictEqual(seen, ["en-US"]);

  service.disposePluginAPI("mediahub");
  service.setLanguage("de-DE");
  assert.deepStrictEqual(seen, ["en-US"]);

  service.reset();
});

// ─────────────────────────────────────────────
// Zusammenarbeit mit dem Update-System
// ─────────────────────────────────────────────

function createPluginDir(root, id, version) {
  const dir = path.join(root, "plugins", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ id, name: id, version, main: "main.js" }));
  fs.writeFileSync(path.join(dir, "main.js"), "module.exports = {};");
  return dir;
}

function packageZip(id, version, localization) {
  return makeZip([
    { name: "plugin.json", data: JSON.stringify({ id, name: id, version, main: "main.js", localization }) },
    { name: "main.js", data: "module.exports = {};" }
  ]);
}

asyncTest("Update: Kataloge werden mitinstalliert und bei Rollback zurückgesetzt", async () => {
  const root = tempDir("update-l10n");
  const userData = path.join(root, "userData");
  const service = new LocalizationService();
  service.getUserDataPath = () => userData;
  service.initialize();

  service.provisionPluginCatalogs("mediahub", {
    "de-DE": { settings: { title: "Alt" } },
    "en-US": { settings: { title: "Old" } }
  });

  const pluginDir = createPluginDir(root, "mediahub", "1.0.0");
  const installer = new PluginPackageInstaller({
    pluginsRoot: path.join(root, "plugins"),
    updatesRoot: path.join(root, "updates"),
    appVersion: "1.0.7",
    logger: { info() {}, warn() {}, error() {} }
  });

  const zipPath = path.join(root, "pkg.zip");
  fs.writeFileSync(zipPath, packageZip("mediahub", "1.1.0", pluginLocalization()));

  const result = await installer.install({
    installedManifest: { id: "mediahub", version: "1.0.0", permissions: [] },
    pluginDirectory: pluginDir,
    manifest: {
      pluginId: "mediahub",
      version: "1.1.0",
      engines: { webradio: ">=1.0.7" },
      permissions: [],
      capabilities: [],
      webSessionOrigins: []
    },
    packagePath: zipPath,
    reload: async () => ({ ok: true }),
    localization: {
      provision: (id, manifest) => service.provisionPluginCatalogs(id, manifest.localization),
      clear: (id) => service.clearPluginCatalogs(id),
      restore: (id, backupPath) => service.restorePluginCatalogs(id, backupPath)
    }
  });

  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(service.t("plugin.mediahub.settings.title"), "Einstellungen");

  // Rollback-Szenario: neue Version startet nicht.
  fs.writeFileSync(zipPath, packageZip("mediahub", "1.2.0", {
    "de-DE": { settings: { title: "Kaputt" } },
    "en-US": { settings: { title: "Broken" } }
  }));

  const failed = await installer.install({
    installedManifest: { id: "mediahub", version: "1.1.0", permissions: [] },
    pluginDirectory: pluginDir,
    manifest: {
      pluginId: "mediahub",
      version: "1.2.0",
      engines: { webradio: ">=1.0.7" },
      permissions: [],
      capabilities: [],
      webSessionOrigins: []
    },
    packagePath: zipPath,
    reload: async () => ({ ok: false, message: "Start fehlgeschlagen" }),
    localization: {
      provision: (id, manifest) => service.provisionPluginCatalogs(id, manifest.localization),
      clear: (id) => service.clearPluginCatalogs(id),
      restore: (id, backupPath) => service.restorePluginCatalogs(id, backupPath)
    }
  });

  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.code, "install_failed_rolled_back");
  assert.strictEqual(service.t("plugin.mediahub.settings.title"), "Einstellungen");

  service.reset();
});

asyncTest("Update: Version ohne Übersetzungen entfernt Kataloge mit Backup", async () => {
  const root = tempDir("update-l10n-clear");
  const userData = path.join(root, "userData");
  const service = new LocalizationService();
  service.getUserDataPath = () => userData;
  service.initialize();

  service.provisionPluginCatalogs("mediahub", {
    "de-DE": { settings: { title: "Alt" } },
    "en-US": { settings: { title: "Old" } }
  });

  const pluginDir = createPluginDir(root, "mediahub", "1.0.0");
  const zipPath = path.join(root, "pkg.zip");
  fs.writeFileSync(zipPath, packageZip("mediahub", "1.1.0", undefined));

  const installer = new PluginPackageInstaller({
    pluginsRoot: path.join(root, "plugins"),
    updatesRoot: path.join(root, "updates"),
    appVersion: "1.0.7",
    logger: { info() {}, warn() {}, error() {} }
  });

  const result = await installer.install({
    installedManifest: { id: "mediahub", version: "1.0.0", permissions: [] },
    pluginDirectory: pluginDir,
    manifest: {
      pluginId: "mediahub",
      version: "1.1.0",
      engines: { webradio: ">=1.0.7" },
      permissions: [],
      capabilities: [],
      webSessionOrigins: []
    },
    packagePath: zipPath,
    reload: async () => ({ ok: true }),
    localization: {
      provision: (id, manifest) => (manifest.localization
        ? service.provisionPluginCatalogs(id, manifest.localization)
        : service.clearPluginCatalogs(id)),
      clear: (id) => service.clearPluginCatalogs(id),
      restore: (id, backupPath) => service.restorePluginCatalogs(id, backupPath)
    }
  });

  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(service.manager.getPluginCatalogSet("mediahub"), null);
  assert.strictEqual(fs.existsSync(path.join(userData, "localization", "plugins", "mediahub")), false);

  service.reset();
});

test("Isolation: createPluginAPI validiert IDs, keine Pfadübernahme", () => {
  const userData = tempDir("isolation");
  const service = createService(userData);
  assert.throws(() => service.createPluginAPI("../../evil"), TypeError);
  assert.throws(() => service.createPluginAPI("a/b"), TypeError);
  assert.throws(() => service.createThemeAPI("Böse"), TypeError);
  service.reset();
});

// ─────────────────────────────────────────────

(async () => {
  for (const { name, fn } of asyncCases) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed += 1;
    } catch (error) {
      console.error(`  ❌ ${name}: ${error.message}`);
      failures.push({ name, error });
      failed += 1;
    }
  }

  console.log("==========================================");
  console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
  if (failures.length > 0) {
    console.log("Fehlgeschlagen:");
    failures.forEach(({ name, error }) => console.log(`  - ${name}: ${error.message}`));
  }
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch { /* best effort */ }
  process.exit(failed > 0 ? 1 : 0);
})();
