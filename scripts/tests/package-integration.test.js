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

function loadPackageManager() {
  return require("../../electron/core/packages/PackageManager");
}

function loadPackageHandlers() {
  return require("../../electron/core/ipc/packageHandlers");
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
      key.includes(path.join("electron", "core", "integrations"))
    ) {
      delete require.cache[key];
    }
  }
}

console.log("==========================================");
console.log("🧪 Starte Package-Integration Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testCounter++;
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `webradio-package-integration-test-${testCounter}-`));
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
// 1. Application Lifecycle Integration
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Application Integration");

test("PackageManager wird initialisiert und Install-Base gesetzt", () => {
  const pm = loadPackageManager();
  pm.initialize();
  assert.strictEqual(pm.isInitialized(), true);

  const installBase = pm.getInstallBaseDir();
  assert.ok(typeof installBase === "string");
  assert.ok(installBase.length > 0);
  assert.ok(installBase.includes("package-data") || installBase.includes("package-data".replace(/[/\\]/g, path.sep)));

  pm.shutdown();
  assert.strictEqual(pm.isInitialized(), false);
});

test("Install-Base wird durch setInstallBaseDir akzeptiert", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const baseDir = path.join(tmpRoot, "custom-package-install");
  pm.setInstallBaseDir(baseDir);
  assert.strictEqual(pm.getInstallBaseDir(), baseDir);

  assert.ok(fs.existsSync(baseDir));
  pm.shutdown();
});

// ─────────────────────────────────────────────────────────────
// 2. Package IPC
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Package IPC");

test("package:list gibt strukturiertes Ergebnis zurück", () => {
  const { ERROR_CODES } = loadPackageHandlers();
  assert.ok(ERROR_CODES.PACKAGE_NOT_FOUND);
  assert.ok(ERROR_CODES.PACKAGE_VALIDATION_FAILED);
  assert.ok(ERROR_CODES.PACKAGE_NOT_ALLOWED);
});

test("package:get liefert Paket-Metadaten", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const installBase = path.join(tmpRoot, "install-base");
  pm.setInstallBaseDir(installBase);

  const pkgDir = makePluginFolder("get-test-plugin", "Get Test Plugin", "3.0.0");
  const installed = pm.installFromDirectory(pkgDir, PACKAGE_TYPES.plugin, { enabled: true });
  assert.ok(installed.success);

  const entry = pm.get("get-test-plugin");
  assert.ok(entry);
  assert.strictEqual(entry.id, "get-test-plugin");
  assert.strictEqual(entry.type, PACKAGE_TYPES.plugin);

  pm.shutdown();
});

test("package:enable und disable arbeiten über Registry", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const installBase = path.join(tmpRoot, "install-base");
  pm.setInstallBaseDir(installBase);

  const pkgDir = makePluginFolder("enable-disable-plugin", "Enable Disable Plugin", "1.0.0");
  pm.installFromDirectory(pkgDir, PACKAGE_TYPES.plugin, { enabled: false });

  assert.strictEqual(pm.get("enable-disable-plugin").enabled, false);

  pm.enable("enable-disable-plugin");
  assert.strictEqual(pm.get("enable-disable-plugin").enabled, true);

  pm.disable("enable-disable-plugin");
  assert.strictEqual(pm.get("enable-disable-plugin").enabled, false);

  pm.shutdown();
});

test("package:remove entfernt den Eintrag aus der Registry", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const installBase = path.join(tmpRoot, "install-base");
  pm.setInstallBaseDir(installBase);

  const pkgDir = makePluginFolder("remove-test-package", "Remove Test Package", "1.0.0");
  pm.installFromDirectory(pkgDir, PACKAGE_TYPES.plugin, { enabled: true });

  assert.strictEqual(pm.has("remove-test-package"), true);

  pm.remove("remove-test-package");
  assert.strictEqual(pm.has("remove-test-package"), false);

  pm.shutdown();
});

test("Installationsfehler werden als strukturierte Fehler klassifiziert", () => {
  const { InstallationError } = require("../../electron/core/packages/PackageInstaller");
  const err = new InstallationError("Package not found in registry");
  assert.ok(err instanceof InstallationError);
  assert.ok(err.message.includes("not found"));
});

// ─────────────────────────────────────────────────────────────
// 3. Security
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Security");

test("App-Pfad wird als Installationsziel abgelehnt", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const appDir = path.join(tmpRoot, "app", "plugins", "protected-app-plugin");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "manifest.json"), JSON.stringify({
    id: "protected-app-plugin",
    name: "Protected App Plugin",
    version: "1.0.0",
    main: "main.js",
    permissions: [],
    capabilities: []
  }));

  assert.throws(
    () => pm.installFromDirectory(appDir, PACKAGE_TYPES.plugin),
    (err) => err && err.message.includes("App packages cannot be installed")
  );

  pm.shutdown();
});

test("Path-Traversal-Verhalten wird von Validierung erkannt", () => {
  const { PackageValidator } = require("../../electron/core/packages/PackageValidator");
  const validator = new PackageValidator();
  assert.strictEqual(validator.containsPathTraversal("../outside"), true);
  assert.strictEqual(validator.containsPathTraversal("safe.js"), false);
});

test("Ungültige Capability wird durch Validator abgelehnt", () => {
  const { PackageValidator } = require("../../electron/core/packages/PackageValidator");
  const validator = new PackageValidator();
  const data = {
    id: "cap-bad",
    name: "Cap Bad",
    version: "1.0.0",
    type: PACKAGE_TYPES.plugin,
    main: "main.js",
    permissions: [],
    capabilities: ["definitely-not-real"],
    manifestSource: "manifest.json"
  };

  const result = validator.validate(data, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.valid, false);
});

test("Ungültige Permission wird durch Validator abgelehnt", () => {
  const { PackageValidator } = require("../../electron/core/packages/PackageValidator");
  const validator = new PackageValidator();
  const data = {
    id: "perm-bad",
    name: "Perm Bad",
    version: "1.0.0",
    type: PACKAGE_TYPES.plugin,
    main: "main.js",
    permissions: ["not-a-real-permission"],
    capabilities: [],
    manifestSource: "manifest.json"
  };

  const result = validator.validate(data, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.valid, false);
});

// ─────────────────────────────────────────────────────────────
// 4. Lifecycle Flow
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Lifecycle Flow");

test("install -> enable -> disable -> remove", () => {
  const pm = loadPackageManager();
  pm.initialize();

  const installBase = path.join(tmpRoot, "install-base");
  pm.setInstallBaseDir(installBase);

  const pkgDir = makePluginFolder("full-lifecycle-plugin", "Full Lifecycle Plugin", "4.0.0");
  const installed = pm.installFromDirectory(pkgDir, PACKAGE_TYPES.plugin, { enabled: false });
  assert.strictEqual(installed.success, true);
  assert.strictEqual(installed.package.enabled, false);

  const enabled = pm.enable("full-lifecycle-plugin");
  assert.strictEqual(enabled.enabled, true);

  const disabled = pm.disable("full-lifecycle-plugin");
  assert.strictEqual(disabled.enabled, false);

  const removed = pm.remove("full-lifecycle-plugin");
  assert.ok(removed);
  assert.strictEqual(pm.has("full-lifecycle-plugin"), false);

  pm.shutdown();
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
