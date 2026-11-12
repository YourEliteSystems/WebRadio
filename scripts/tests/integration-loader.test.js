"use strict";

/**
 * integration-loader.test.js
 *
 * Prüft die Einstiegspunkt-Auflösung der Integrationen: Manifeste dürfen
 * `entry` (dokumentiertes Feld) oder `main` (Feld der Plugin-Runtime)
 * verwenden. Vor der Korrektur wurde `entry` ignoriert, wodurch die Runtime
 * mit einem undefinierten Pfad startete.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const IntegrationLoader = require("../../electron/core/integrations/IntegrationLoader");

console.log("==========================================");
console.log("Integration-Loader-Tests");
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

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-integration-"));

function makeIntegration(name, manifest, files = {}) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

test("entry wird auf main abgebildet (dokumentiertes Feld)", () => {
  const dir = makeIntegration("entry-only", {
    id: "entry-only",
    type: "integration",
    entry: "index.js"
  }, { "index.js": "module.exports = {};" });

  const manifest = IntegrationLoader.loadManifest(dir);
  const resolved = IntegrationLoader.resolveEntry(manifest, dir);

  assert.strictEqual(resolved.main, "index.js");
  assert.strictEqual(resolved.mainPath, path.join(dir, "index.js"));
});

test("main hat Vorrang vor entry", () => {
  const dir = makeIntegration("both", {
    id: "both",
    type: "integration",
    entry: "legacy.js",
    main: "index.js"
  }, { "index.js": "module.exports = {};", "legacy.js": "module.exports = {};" });

  const resolved = IntegrationLoader.resolveEntry(IntegrationLoader.loadManifest(dir), dir);
  assert.strictEqual(resolved.main, "index.js");
});

test("Manifest ohne main und entry wird abgelehnt", () => {
  const dir = makeIntegration("missing-entry", { id: "missing-entry", type: "integration" });
  assert.throws(
    () => IntegrationLoader.resolveEntry(IntegrationLoader.loadManifest(dir), dir),
    /weder "main" noch "entry"/
  );
});

test("fehlender Einstiegspunkt wird abgelehnt", () => {
  const dir = makeIntegration("missing-file", { id: "missing-file", type: "integration", entry: "index.js" });
  assert.throws(
    () => IntegrationLoader.resolveEntry(IntegrationLoader.loadManifest(dir), dir),
    /Einstiegspunkt fehlt/
  );
});

test("Pfad außerhalb des Integrationsverzeichnisses wird abgelehnt", () => {
  const dir = makeIntegration("traversal", { id: "traversal", type: "integration", entry: "../evil.js" });
  assert.throws(
    () => IntegrationLoader.resolveEntry(IntegrationLoader.loadManifest(dir), dir),
    /außerhalb des Integrationsverzeichnisses/
  );
});

test("Repository-Integration YouTube wird mit Einstiegspunkt gefunden", () => {
  const discovered = IntegrationLoader.discoverIntegrations();
  const youtube = discovered.find((integration) => integration.id === "youtube");

  assert.ok(youtube, "YouTube-Integration muss gefunden werden");
  assert.strictEqual(youtube.main, "index.js");
  assert.ok(fs.existsSync(path.join(youtube.path, youtube.main)));
  // Jede gefundene Integration muss einen auflösbaren Einstiegspunkt besitzen.
  for (const integration of discovered) {
    assert.strictEqual(typeof integration.main, "string", `${integration.id} ohne main`);
    assert.ok(fs.existsSync(path.join(integration.path, integration.main)), `${integration.id}: Datei fehlt`);
  }
});

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
