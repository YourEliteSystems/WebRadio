"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

let tmpRoot = null;
let testCounter = 0;

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "electron") return "electron-stub";
  return originalResolve.call(this, request, parent, isMain, options);
};

const fakeApp = {
  getPath: () => tmpRoot,
  getAppPath: () => path.join(tmpRoot, "app"),
  isPackaged: false
};

require.cache["electron-stub"] = {
  id: "electron-stub",
  filename: "electron-stub",
  loaded: true,
  exports: { app: fakeApp }
};

const PACKAGE_TYPES = { plugin: "plugin", theme: "theme" };

function makePluginFolder(id, name, version, options = {}) {
  const dir = path.join(tmpRoot, "packages", "local", "plugin", id);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    id,
    name: name || id,
    version: version || "1.0.0",
    main: "main.js",
    permissions: options.permissions || [],
    capabilities: options.capabilities || []
  };

  if (options.renderer !== undefined) {
    manifest.renderer = options.renderer;
  }

  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), options.mainBody || "module.exports = { init: () => {}, destroy: () => {} };");
  return dir;
}

function makeThemeFolder(id, name, version, options = {}) {
  const dir = path.join(tmpRoot, "packages", "local", "theme", id);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    id,
    name: name || id,
    version: version || "1.0.0",
    css: "style.css",
    author: options.author || "",
    description: options.description || ""
  };

  fs.writeFileSync(path.join(dir, "theme.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "style.css"), options.cssBody || ":root { }");
  return dir;
}

function loadPackageManager() {
  return require("../../electron/core/packages/PackageManager");
}

function loadPackageModel() {
  return require("../../electron/core/packages/PackageModel");
}

function loadPackageValidator() {
  return require("../../electron/core/packages/PackageValidator");
}

function loadPackageRegistry() {
  return require("../../electron/core/packages/PackageRegistry");
}

function loadPackageInstaller() {
  return require("../../electron/core/packages/PackageInstaller");
}

function resetCaches() {
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes(path.join("electron", "core", "packages")) ||
      key.includes(path.join("electron", "core", "plugins")) ||
      key.includes(path.join("electron", "core", "themes")) ||
      key.includes(path.join("electron", "core", "storage")) ||
      key.includes(path.join("electron", "core", "eventBus")) ||
      key.includes(path.join("electron", "core", "navigation")) ||
      key.includes(path.join("electron", "core", "diagnostics")) ||
      key.includes(path.join("electron", "core", "ui")) ||
      key.includes(path.join("electron", "core", "plugins"))
    ) {
      delete require.cache[key];
    }
  }
}

console.log("==========================================");
console.log("🧪 Starte Package-System Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testCounter++;
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `webradio-package-test-${testCounter}-`));
  resetCaches();

  try {
    fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(err.stack.split("\n").slice(0, 5).join("\n"));
    testsFailed++;
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (e) {
      // noop
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 1. PackageModel
// ─────────────────────────────────────────────────────────────
console.log("\n[1] PackageModel");

test("Plugin-Manifest wird normalisiert", () => {
  const model = loadPackageModel();
  const dir = makePluginFolder("my-plugin", "My Plugin", "2.0.0", {
    permissions: ["storage", "invalid-permission"],
    capabilities: ["player", "unknown-cap"],
    renderer: "plugin.js"
  });

  const normalized = model.normalizeManifestFromDirectory(dir, PACKAGE_TYPES.plugin);
  assert.ok(normalized);
  assert.strictEqual(normalized.manifest.id, "my-plugin");
  assert.strictEqual(normalized.manifest.name, "My Plugin");
  assert.strictEqual(normalized.manifest.version, "2.0.0");
  assert.strictEqual(normalized.manifest.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(normalized.manifest.main, "main.js");
  assert.strictEqual(normalized.manifest.renderer, "plugin.js");
  assert.ok(Array.isArray(normalized.manifest.permissions));
  assert.ok(normalized.manifest.permissions.includes("storage"));
  assert.ok(!normalized.manifest.permissions.includes("invalid-permission"));
});

test("Theme-Manifest wird normalisiert", () => {
  const model = loadPackageModel();
  const dir = makeThemeFolder("my-theme", "My Theme", "1.2.3", {
    author: "Test",
    description: "Test theme"
  });

  const normalized = model.normalizeManifestFromDirectory(dir, PACKAGE_TYPES.theme);
  assert.ok(normalized);
  assert.strictEqual(normalized.manifest.id, "my-theme");
  assert.strictEqual(normalized.manifest.type, PACKAGE_TYPES.theme);
  assert.strictEqual(normalized.manifest.css, "style.css");
});

test("Ungültige ID wird abgelehnt", () => {
  const model = loadPackageModel();
  assert.strictEqual(model.isValidId("Invalid ID!"), false);
  assert.strictEqual(model.isValidId(""), false);
  assert.strictEqual(model.isValidId(" ok "), true);
});

test("Ungültige Version wird abgelehnt", () => {
  const model = loadPackageModel();
  assert.strictEqual(model.normalizeVersion("1.0.0"), "1.0.0");
  assert.strictEqual(model.normalizeVersion("v1.0"), null);
  assert.strictEqual(model.normalizeVersion("01.0.0"), null);
});

// ─────────────────────────────────────────────────────────────
// 2. PackageValidator
// ─────────────────────────────────────────────────────────────
console.log("\n[2] PackageValidator");

test("Plugin-Validierung akzeptiert gültiges Manifest", () => {
  const validator = loadPackageValidator();
  const data = {
    id: "ok-plugin",
    name: "OK Plugin",
    version: "1.0.0",
    type: PACKAGE_TYPES.plugin,
    main: "main.js",
    permissions: [],
    capabilities: [],
    manifestSource: "manifest.json"
  };

  const result = validator.validate(data, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("Plugin-Validierung lehnt fehlenden main ab", () => {
  const validator = loadPackageValidator();
  const data = {
    id: "bad-plugin",
    name: "Bad Plugin",
    version: "1.0.0",
    type: PACKAGE_TYPES.plugin,
    main: "",
    permissions: [],
    capabilities: []
  };

  const result = validator.validate(data, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("main")));
});

test("Theme-Validierung lehnt ungültige css ab", () => {
  const validator = loadPackageValidator();
  const data = {
    id: "bad-theme",
    name: "Bad Theme",
    version: "1.0.0",
    type: PACKAGE_TYPES.theme,
    css: "nope",
    manifestSource: "theme.json"
  };

  const result = validator.validate(data, PACKAGE_TYPES.theme);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("css")));
});

test("Path-Traversal wird erkannt", () => {
  const validator = loadPackageValidator();
  assert.strictEqual(validator.containsPathTraversal("../etc/passwd"), true);
  assert.strictEqual(validator.containsPathTraversal("dir/../../etc/passwd"), true);
  assert.strictEqual(validator.containsPathTraversal("safe.css"), false);
});

test("Ungültige Capabilities werden abgelehnt", () => {
  const validator = loadPackageValidator();
  const data = {
    id: "cap-bad",
    name: "Cap Bad",
    version: "1.0.0",
    type: PACKAGE_TYPES.plugin,
    main: "main.js",
    permissions: [],
    capabilities: ["player", "does-not-exist"],
    manifestSource: "manifest.json"
  };

  const result = validator.validate(data, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("does-not-exist") || e.includes("unacceptable")));
});

// ─────────────────────────────────────────────────────────────
// 3. PackageRegistry
// ─────────────────────────────────────────────────────────────
console.log("\n[3] PackageRegistry");

test("Registry kann Einträge speichern und lesen", () => {
  const { PackageRegistry } = loadPackageRegistry();
  const registry = new PackageRegistry();
  registry.packageDataPath = path.join(tmpRoot, "package-data");
  registry.registryFile = path.join(registry.packageDataPath, "registry.json");

  fs.mkdirSync(registry.packageDataPath, { recursive: true });
  registry.ensureInitialized();

  registry.addOrUpdate("pkg-a", PACKAGE_TYPES.plugin, "1.0.0", {
    path: "plugins/pkg-a",
    source: "local",
    enabled: true
  });

  const entry = registry.get("pkg-a");
  assert.ok(entry);
  assert.strictEqual(entry.id, "pkg-a");
  assert.strictEqual(entry.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(entry.enabled, true);

  registry.setEnabled("pkg-a", false);
  assert.strictEqual(registry.get("pkg-a").enabled, false);

  registry.remove("pkg-a");
  assert.strictEqual(registry.get("pkg-a"), null);
});

test("User-Pakete haben Vorrang vor App-Paketen (Konzepttest)", () => {
  const { FilesPolicy } = loadPackageRegistry();
  const appBase = path.join(tmpRoot, "app");
  const userBase = path.join(tmpRoot, "package-data");

  const appPath = path.join(appBase, "plugins", "pkg-a");
  const userPath = path.join(userBase, "plugins", "pkg-a");

  assert.strictEqual(FilesPolicy.isAppPackagePath(appPath), true);
  assert.strictEqual(FilesPolicy.isAppPackagePath(userPath), false);
});

// ─────────────────────────────────────────────────────────────
// 4. LocalSource
// ─────────────────────────────────────────────────────────────
console.log("\n[4] LocalSource");

test("LocalSource erkennt lokale Kandidaten", async () => {
  const { LocalSource } = require("../../electron/core/packages/LocalSource");
  const source = new LocalSource({ allowedBaseDirs: [path.join(tmpRoot, "packages")] });

  const pluginDir = makePluginFolder("source-test-plugin", "Source Test Plugin", "1.0.0");
  const candidates = await source.resolvePackageCandidates(
    {
      paths: [path.join(tmpRoot, "packages", "local", "plugin", "source-test-plugin")],
      type: PACKAGE_TYPES.plugin
    },
    {}
  );

  assert.ok(candidates.length >= 1);
  assert.strictEqual(candidates[0].source, "local");
  assert.strictEqual(candidates[0].type, "directory");
});

test("LocalSource ignoriert nicht erlaubte Pfade", async () => {
  const { LocalSource } = require("../../electron/core/packages/LocalSource");
  const source = new LocalSource({ allowedBaseDirs: [path.join(tmpRoot, "allowed")] });
  fs.mkdirSync(path.join(tmpRoot, "allowed"), { recursive: true });

  const blocked = path.join(tmpRoot, "blocked");
  fs.mkdirSync(blocked, { recursive: true });

  const candidates = await source.resolvePackageCandidates(
    { paths: [blocked], type: PACKAGE_TYPES.plugin },
    {}
  );

  assert.strictEqual(candidates.length, 0);
});

// ─────────────────────────────────────────────────────────────
// 5. PackageInstaller
// ─────────────────────────────────────────────────────────────
console.log("\n[5] PackageInstaller");

test("Paket-Installation erstellt Registry-Eintrag", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const installerInstance = new installer({
    registry: loadPackageRegistry().PackageRegistry,
    validator: loadPackageValidator()
  });

  const installBase = path.join(tmpRoot, "install-base");
  installerInstance.setInstallBaseDir(installBase);
  const pkgDir = makePluginFolder("installed-plugin", "Installed Plugin", "1.0.0");

  const result = installerInstance.install(pkgDir, PACKAGE_TYPES.plugin, { enabled: true });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.package.id, "installed-plugin");
  assert.strictEqual(result.package.enabled, true);
  assert.ok(fs.existsSync(path.join(installBase, PACKAGE_TYPES.plugin, "installed-plugin")));
});

test("Aktualisierung aktualisiert Version und feuert Event", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const installerInstance = new installer({
    registry: loadPackageRegistry().PackageRegistry,
    validator: loadPackageValidator()
  });

  const installBase = path.join(tmpRoot, "install-base");
  installerInstance.setInstallBaseDir(installBase);
  const pkgDir = makePluginFolder("update-plugin", "Update Plugin", "1.0.0");

  const installResult = installerInstance.install(pkgDir, PACKAGE_TYPES.plugin, { enabled: true });
  assert.strictEqual(installResult.success, true);

  const updatedDir = makePluginFolder("update-plugin", "Update Plugin", "2.0.0");
  const updateResult = installerInstance.update("update-plugin", updatedDir, PACKAGE_TYPES.plugin);
  assert.strictEqual(updateResult.success, true);
  assert.strictEqual(updateResult.package.version, "2.0.0");
});

test("Gegenexplizite Aktivierung/Deaktivierung funktioniert", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const registry = loadPackageRegistry().PackageRegistry;
  const installerInstance = new installer({
    registry: registry,
    validator: loadPackageValidator()
  });

  const installBase = path.join(tmpRoot, "install-base");
  installerInstance.setInstallBaseDir(installBase);
  const pkgDir = makePluginFolder("enable-test-plugin", "Enable Test Plugin", "1.0.0");

  installerInstance.install(pkgDir, PACKAGE_TYPES.plugin, { enabled: false });
  const enabled = installerInstance.enable("enable-test-plugin");
  assert.strictEqual(enabled.enabled, true);

  const disabled = installerInstance.disable("enable-test-plugin");
  assert.strictEqual(disabled.enabled, false);
});

test("Entfernen löscht Registry-Eintrag", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const registry = loadPackageRegistry().PackageRegistry;
  const installerInstance = new installer({
    registry: registry,
    validator: loadPackageValidator()
  });

  const installBase = path.join(tmpRoot, "install-base");
  installerInstance.setInstallBaseDir(installBase);
  const pkgDir = makeThemeFolder("remove-test-theme", "Remove Theme", "1.0.0");

  installerInstance.install(pkgDir, PACKAGE_TYPES.theme, { enabled: true });
  assert.strictEqual(installerInstance.registry().has("remove-test-theme"), true);

  const removed = installerInstance.remove("remove-test-theme");
  assert.ok(removed);
  assert.strictEqual(installerInstance.registry().has("remove-test-theme"), false);
});

test("App-Paket-Pfad wird blockiert", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const registry = loadPackageRegistry().PackageRegistry;
  const validator = loadPackageValidator();
  const installerInstance = new installer({
    registry: registry,
    validator: validator
  });

  const appDir = path.join(tmpRoot, "app", "plugins", "app-protected");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "manifest.json"), JSON.stringify({
    id: "app-protected",
    name: "App Protected",
    version: "1.0.0",
    main: "main.js",
    permissions: [],
    capabilities: []
  }));

  assert.throws(
    () => installerInstance.install(appDir, PACKAGE_TYPES.plugin),
    (err) => err && err.message.includes("App packages cannot be installed")
  );
});

// ─────────────────────────────────────────────────────────────
// 6. Lifecycle-Flow
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Lifecycle-Flow");

test("install -> enable -> disable -> remove", () => {
  const installer = loadPackageInstaller().PackageInstaller;
  const registry = loadPackageRegistry().PackageRegistry;
  const validator = loadPackageValidator();
  const installerInstance = new installer({
    registry: registry,
    validator: validator
  });

  const installBase = path.join(tmpRoot, "install-base");
  installerInstance.setInstallBaseDir(installBase);
  const pkgDir = makePluginFolder("lifecycle-plugin", "Lifecycle Plugin", "1.0.0");

  const installed = installerInstance.install(pkgDir, PACKAGE_TYPES.plugin, { enabled: false });
  assert.strictEqual(installed.success, true);
  assert.strictEqual(installed.package.enabled, false);

  const enabled = installerInstance.enable("lifecycle-plugin");
  assert.strictEqual(enabled.enabled, true);

  const disabled = installerInstance.disable("lifecycle-plugin");
  assert.strictEqual(disabled.enabled, false);

  const removed = installerInstance.remove("lifecycle-plugin");
  assert.ok(removed);
  assert.strictEqual(registry.has("lifecycle-plugin"), false);
});

// ─────────────────────────────────────────────────────────────
// 7. Events
// ─────────────────────────────────────────────────────────────
console.log("\n[7] Events");

test("Package-Events werden über EventBus emittiert", () => {
  const { PACKAGE_EVENTS } = require("../../electron/core/packages/events");
  assert.ok(PACKAGE_EVENTS.installed);
  assert.ok(PACKAGE_EVENTS.updated);
  assert.ok(PACKAGE_EVENTS.enabled);
  assert.ok(PACKAGE_EVENTS.disabled);
  assert.ok(PACKAGE_EVENTS.removed);
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
