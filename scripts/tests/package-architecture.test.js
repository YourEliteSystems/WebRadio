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
  const dir = path.join(tmpRoot, "plugins", id);
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

  const manifestFile = options.manifestFile || "plugin.json";
  fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), options.mainBody || "module.exports = { init: () => {}, destroy: () => {} };");
  return dir;
}

function makeThemeFolder(id, name, version, options = {}) {
  const dir = path.join(tmpRoot, "themes", id);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    id,
    name: name || id,
    version: version || "1.0.0",
    css: "style.css",
    author: options.author || "",
    description: options.description || ""
  };

  const manifestFile = options.manifestFile || "theme.json";
  fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "style.css"), options.cssBody || ":root { }");
  return dir;
}

function makePluginWithInstallJson(id, name, version, options = {}) {
  const dir = path.join(tmpRoot, "plugins", id);
  fs.mkdirSync(dir, { recursive: true });

  const installJson = {
    schemaVersion: 1,
    package: {
      id,
      type: "plugin"
    },
    manifest: options.manifestFile || "plugin.json",
    installation: {
      mode: "managed"
    }
  };

  fs.writeFileSync(path.join(dir, "install.json"), JSON.stringify(installJson, null, 2));

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

  const manifestFile = options.manifestFile || "plugin.json";
  fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), options.mainBody || "module.exports = { init: () => {}, destroy: () => {} };");
  return dir;
}

function makeThemeWithInstallJson(id, name, version, options = {}) {
  const dir = path.join(tmpRoot, "themes", id);
  fs.mkdirSync(dir, { recursive: true });

  const installJson = {
    schemaVersion: 1,
    package: {
      id,
      type: "theme"
    },
    manifest: options.manifestFile || "theme.json",
    installation: {
      mode: "managed"
    }
  };

  fs.writeFileSync(path.join(dir, "install.json"), JSON.stringify(installJson, null, 2));

  const manifest = {
    id,
    name: name || id,
    version: version || "1.0.0",
    css: "style.css",
    author: options.author || "",
    description: options.description || ""
  };

  const manifestFile = options.manifestFile || "theme.json";
  fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "style.css"), options.cssBody || ":root { }");
  return dir;
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

function loadPluginLoader() {
  return require("../../electron/core/plugins/PluginLoader");
}

function loadThemeLoader() {
  return require("../../electron/core/themes/ThemeLoader");
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
      key.includes(path.join("electron", "core", "ui"))
    ) {
      delete require.cache[key];
    }
  }
}

console.log("==========================================");
console.log("🧪 Starte Package-Architektur Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  testCounter++;
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `webradio-arch-test-${testCounter}-`));
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
// 1. Manuelle Installation (ohne Package System)
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Manuelle Installation");

test("Plugin im User-Plugin-Verzeichnis wird erkannt (PluginLoader)", () => {
  const pluginDir = makePluginFolder("manual-plugin", "Manual Plugin", "1.0.0");
  const loader = loadPluginLoader();
  const plugins = loader.discoverPlugins();

  assert.ok(plugins.length >= 1);
  const plugin = plugins.find(p => p.id === "manual-plugin");
  assert.ok(plugin);
  assert.strictEqual(plugin.name, "Manual Plugin");
  assert.strictEqual(plugin.version, "1.0.0");
});

test("Theme im User-Theme-Verzeichnis wird erkannt (ThemeLoader)", () => {
  const themeDir = makeThemeFolder("manual-theme", "Manual Theme", "1.0.0");
  const loader = loadThemeLoader();
  const themes = loader.discoverThemes();

  assert.ok(themes.length >= 1);
  const theme = themes.find(t => t.id === "manual-theme");
  assert.ok(theme);
  assert.strictEqual(theme.name, "Manual Theme");
  assert.strictEqual(theme.version, "1.0.0");
});

test("Plugin benötigt keine Registry für Funktionalität", () => {
  const pluginDir = makePluginFolder("no-registry-plugin", "No Registry Plugin", "1.0.0");
  const loader = loadPluginLoader();
  const plugins = loader.discoverPlugins();

  assert.ok(plugins.length >= 1);
  const plugin = plugins.find(p => p.id === "no-registry-plugin");
  assert.ok(plugin);
  assert.strictEqual(plugin.name, "No Registry Plugin");
});

// ─────────────────────────────────────────────────────────────
// 2. install.json-basierte Installation
// ─────────────────────────────────────────────────────────────
console.log("\n[2] install.json-basierte Installation");

test("install.json wird validiert (gültiges Plugin)", () => {
  const model = loadPackageModel();
  const installJson = {
    schemaVersion: 1,
    package: {
      id: "test-plugin",
      type: "plugin"
    },
    manifest: "plugin.json",
    installation: {
      mode: "managed"
    }
  };

  const result = model.validateInstallManifest(installJson);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("install.json wird validiert (gültiges Theme)", () => {
  const model = loadPackageModel();
  const installJson = {
    schemaVersion: 1,
    package: {
      id: "test-theme",
      type: "theme"
    },
    manifest: "theme.json",
    installation: {
      mode: "managed"
    }
  };

  const result = model.validateInstallManifest(installJson);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test("install.json mit ungültiger schemaVersion wird abgelehnt", () => {
  const model = loadPackageModel();
  const installJson = {
    schemaVersion: 999,
    package: {
      id: "test-plugin",
      type: "plugin"
    },
    manifest: "plugin.json"
  };

  const result = model.validateInstallManifest(installJson);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("schemaVersion")));
});

test("install.json mit ungültigem type wird abgelehnt", () => {
  const model = loadPackageModel();
  const installJson = {
    schemaVersion: 1,
    package: {
      id: "test-plugin",
      type: "invalid-type"
    },
    manifest: "plugin.json"
  };

  const result = model.validateInstallManifest(installJson);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("type")));
});

test("install.json ohne package-Objekt wird abgelehnt", () => {
  const model = loadPackageModel();
  const installJson = {
    schemaVersion: 1,
    manifest: "plugin.json"
  };

  const result = model.validateInstallManifest(installJson);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("package")));
});

test("install.json Plugin wird korrekt erkannt", () => {
  const model = loadPackageModel();
  const pluginDir = makePluginWithInstallJson("install-plugin", "Install Plugin", "1.0.0");

  const detected = model.detectPackageType(pluginDir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(detected.source, "install.json");
  assert.ok(detected.installManifest);
});

test("install.json Theme wird korrekt erkannt", () => {
  const model = loadPackageModel();
  const themeDir = makeThemeWithInstallJson("install-theme", "Install Theme", "1.0.0");

  const detected = model.detectPackageType(themeDir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.theme);
  assert.strictEqual(detected.source, "install.json");
  assert.ok(detected.installManifest);
});

test("install.json mit custom manifest filename wird korrekt gelesen", () => {
  const model = loadPackageModel();
  const pluginDir = makePluginWithInstallJson("custom-manifest-plugin", "Custom Manifest Plugin", "1.0.0", {
    manifestFile: "my-manifest.json"
  });

  const read = model.readManifestWithInstall(pluginDir);
  assert.ok(read);
  assert.strictEqual(read.source, "my-manifest.json");
  assert.ok(read.installManifest);
  assert.strictEqual(read.manifest.id, "custom-manifest-plugin");
});

// ─────────────────────────────────────────────────────────────
// 3. Manifest-Konsistenz-Validierung
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Manifest-Konsistenz-Validierung");

test("install.json type passt zu plugin.json", () => {
  const model = loadPackageModel();
  const pluginDir = makePluginWithInstallJson("consistent-plugin", "Consistent Plugin", "1.0.0");

  const result = model.createPackageFromDirectory(pluginDir, PACKAGE_TYPES.plugin);
  assert.ok(result);
  assert.strictEqual(result.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(result.manifest.id, "consistent-plugin");
});

test("install.json type passt zu theme.json", () => {
  const model = loadPackageModel();
  const themeDir = makeThemeWithInstallJson("consistent-theme", "Consistent Theme", "1.0.0");

  const result = model.createPackageFromDirectory(themeDir, PACKAGE_TYPES.theme);
  assert.ok(result);
  assert.strictEqual(result.type, PACKAGE_TYPES.theme);
  assert.strictEqual(result.manifest.id, "consistent-theme");
});

test("widersprüchliche Typangaben werden abgelehnt", () => {
  const model = loadPackageModel();
  const dir = path.join(tmpRoot, "plugins", "inconsistent");
  fs.mkdirSync(dir, { recursive: true });

  const installJson = {
    schemaVersion: 1,
    package: {
      id: "inconsistent",
      type: "theme"
    },
    manifest: "plugin.json",
    installation: {
      mode: "managed"
    }
  };
  fs.writeFileSync(path.join(dir, "install.json"), JSON.stringify(installJson, null, 2));

  const pluginJson = {
    id: "inconsistent",
    name: "Inconsistent",
    version: "1.0.0",
    main: "main.js",
    permissions: [],
    capabilities: []
  };
  fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(pluginJson, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), "module.exports = { init: () => {}, destroy: () => {} };");

  const result = model.createPackageFromDirectory(dir, PACKAGE_TYPES.plugin);
  assert.strictEqual(result, null);
});

// ─────────────────────────────────────────────────────────────
// 4. Legacy Manifest Fallback
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Legacy Manifest Fallback");

test("plugin.json wird erkannt (Legacy)", () => {
  const model = loadPackageModel();
  const pluginDir = makePluginFolder("legacy-plugin", "Legacy Plugin", "1.0.0", {
    manifestFile: "plugin.json"
  });

  const detected = model.detectPackageType(pluginDir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(detected.source, "plugin.json");
});

test("manifest.json wird erkannt (Legacy)", () => {
  const model = loadPackageModel();
  const pluginDir = makePluginFolder("manifest-plugin", "Manifest Plugin", "1.0.0", {
    manifestFile: "manifest.json"
  });

  const detected = model.detectPackageType(pluginDir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(detected.source, "manifest.json");
});

test("theme.json wird erkannt (Legacy)", () => {
  const model = loadPackageModel();
  const themeDir = makeThemeFolder("legacy-theme", "Legacy Theme", "1.0.0", {
    manifestFile: "theme.json"
  });

  const detected = model.detectPackageType(themeDir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.theme);
  assert.strictEqual(detected.source, "theme.json");
});

test("webradio.json mit type=plugin wird erkannt", () => {
  const model = loadPackageModel();
  const dir = path.join(tmpRoot, "plugins", "webradio-plugin");
  fs.mkdirSync(dir, { recursive: true });

  const webradioJson = {
    id: "webradio-plugin",
    name: "Webradio Plugin",
    version: "1.0.0",
    type: "plugin",
    main: "main.js",
    permissions: [],
    capabilities: []
  };
  fs.writeFileSync(path.join(dir, "webradio.json"), JSON.stringify(webradioJson, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), "module.exports = { init: () => {}, destroy: () => {} };");

  const detected = model.detectPackageType(dir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(detected.source, "webradio.json");
});

test("webradio.json mit type=theme wird erkannt", () => {
  const model = loadPackageModel();
  const dir = path.join(tmpRoot, "themes", "webradio-theme");
  fs.mkdirSync(dir, { recursive: true });

  const webradioJson = {
    id: "webradio-theme",
    name: "Webradio Theme",
    version: "1.0.0",
    type: "theme",
    css: "style.css"
  };
  fs.writeFileSync(path.join(dir, "webradio.json"), JSON.stringify(webradioJson, null, 2));
  fs.writeFileSync(path.join(dir, "style.css"), ":root { }");

  const detected = model.detectPackageType(dir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.theme);
  assert.strictEqual(detected.source, "webradio.json");
});

test("webradio.json ohne type wird durch main-Feld als Plugin erkannt", () => {
  const model = loadPackageModel();
  const dir = path.join(tmpRoot, "plugins", "webradio-inferred");
  fs.mkdirSync(dir, { recursive: true });

  const webradioJson = {
    id: "webradio-inferred",
    name: "Webradio Inferred",
    version: "1.0.0",
    main: "main.js",
    permissions: [],
    capabilities: []
  };
  fs.writeFileSync(path.join(dir, "webradio.json"), JSON.stringify(webradioJson, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), "module.exports = { init: () => {}, destroy: () => {} };");

  const detected = model.detectPackageType(dir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.plugin);
  assert.strictEqual(detected.source, "webradio.json");
});

test("webradio.json ohne type wird durch css-Feld als Theme erkannt", () => {
  const model = loadPackageModel();
  const dir = path.join(tmpRoot, "themes", "webradio-css-inferred");
  fs.mkdirSync(dir, { recursive: true });

  const webradioJson = {
    id: "webradio-css-inferred",
    name: "Webradio CSS Inferred",
    version: "1.0.0",
    css: "style.css"
  };
  fs.writeFileSync(path.join(dir, "webradio.json"), JSON.stringify(webradioJson, null, 2));
  fs.writeFileSync(path.join(dir, "style.css"), ":root { }");

  const detected = model.detectPackageType(dir);
  assert.ok(detected);
  assert.strictEqual(detected.type, PACKAGE_TYPES.theme);
  assert.strictEqual(detected.source, "webradio.json");
});

// ─────────────────────────────────────────────────────────────
// 5. Sicherheit
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Sicherheit");

test("Path Traversal wird erkannt", () => {
  const validator = loadPackageValidator();
  assert.strictEqual(validator.containsPathTraversal("../etc/passwd"), true);
  assert.strictEqual(validator.containsPathTraversal("dir/../../etc/passwd"), true);
  assert.strictEqual(validator.containsPathTraversal("safe.css"), false);
});

test("getTargetDirectoryForType gibt korrekte Ziele zurück", () => {
  const model = loadPackageModel();
  assert.strictEqual(model.getTargetDirectoryForType("plugin"), "plugins");
  assert.strictEqual(model.getTargetDirectoryForType("theme"), "themes");
  assert.strictEqual(model.getTargetDirectoryForType("invalid"), null);
});

test("PACKAGE_TARGETS ist definiert und korrekt", () => {
  const model = loadPackageModel();
  assert.ok(model.PACKAGE_TARGETS);
  assert.strictEqual(model.PACKAGE_TARGETS.plugin, "plugins");
  assert.strictEqual(model.PACKAGE_TARGETS.theme, "themes");
});

// ─────────────────────────────────────────────────────────────
// 6. PluginLoader und ThemeLoader Unabhängigkeit
// ─────────────────────────────────────────────────────────────
console.log("\n[6] PluginLoader und ThemeLoader Unabhängigkeit");

test("PluginLoader liest install.json wenn vorhanden", () => {
  const pluginDir = makePluginWithInstallJson("loader-install-plugin", "Loader Install Plugin", "1.0.0", {
    manifestFile: "custom.json"
  });

  const loader = loadPluginLoader();
  const manifest = loader.loadManifest(pluginDir);

  assert.ok(manifest);
  assert.strictEqual(manifest.id, "loader-install-plugin");
});

test("ThemeLoader liest install.json wenn vorhanden", () => {
  const themeDir = makeThemeWithInstallJson("loader-install-theme", "Loader Install Theme", "1.0.0", {
    manifestFile: "custom.json"
  });

  const loader = loadThemeLoader();
  const themes = loader.scanDirectory(path.join(tmpRoot, "themes"), "user");

  assert.ok(themes.length >= 1);
  const theme = themes.find(t => t.id === "loader-install-theme");
  assert.ok(theme);
  assert.strictEqual(theme.name, "Loader Install Theme");
});

test("PluginLoader funktioniert ohne install.json", () => {
  const pluginDir = makePluginFolder("loader-no-install-plugin", "Loader No Install Plugin", "1.0.0");

  const loader = loadPluginLoader();
  const manifest = loader.loadManifest(pluginDir);

  assert.ok(manifest);
  assert.strictEqual(manifest.id, "loader-no-install-plugin");
});

test("ThemeLoader funktioniert ohne install.json", () => {
  const themeDir = makeThemeFolder("loader-no-install-theme", "Loader No Install Theme", "1.0.0");

  const loader = loadThemeLoader();
  const themes = loader.scanDirectory(path.join(tmpRoot, "themes"), "user");

  assert.ok(themes.length >= 1);
  const theme = themes.find(t => t.id === "loader-no-install-theme");
  assert.ok(theme);
  assert.strictEqual(theme.name, "Loader No Install Theme");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${testsPassed} ✅, ${testsFailed} ❌`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
