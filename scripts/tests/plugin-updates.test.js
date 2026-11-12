"use strict";

/**
 * plugin-updates.test.js
 *
 * Deckt Manifest-Validierung, Signatur, URL-Policy, ZIP-Sicherheit, Download,
 * Installation, Backup/Rollback, Berechtigungsänderungen, Abhängigkeiten und
 * die Katalog-Anbindung ab. Die Tests laufen ohne Electron: alle Pfade,
 * Katalogantworten und Transporte werden injiziert.
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const semver = require("../../electron/core/plugins/update/PluginSemver");
const UpdateManifest = require("../../electron/core/plugins/update/UpdateManifest");
const UpdateSourcePolicy = require("../../electron/core/plugins/update/UpdateSourcePolicy");
const SignatureVerifier = require("../../electron/core/plugins/update/SignatureVerifier");
const ZipArchive = require("../../electron/core/plugins/update/ZipArchive");
const HttpDownloader = require("../../electron/core/plugins/update/HttpDownloader");
const PluginUpdateStore = require("../../electron/core/plugins/update/PluginUpdateStore");
const PluginPackageInstaller = require("../../electron/core/plugins/update/PluginPackageInstaller");
const PluginUpdateService = require("../../electron/core/plugins/update/PluginUpdateService");

console.log("==========================================");
console.log("Plugin-Update-Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
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

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-plugin-updates-"));

function tempDir(name) {
  const dir = path.join(tmpRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─────────────────────────────────────────────
// Helfer
// ─────────────────────────────────────────────

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
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
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
    central.writeUInt32LE(((entry.mode || 0o100644) << 16) >>> 0, 38);
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

function packageFor(id, version, overrides = {}) {
  const manifest = {
    id,
    name: id,
    version,
    main: "main.js",
    permissions: [],
    ...overrides
  };
  return makeZip([
    { name: "plugin.json", data: JSON.stringify(manifest, null, 2) },
    { name: "main.js", data: "module.exports = {};" }
  ]);
}

const keyPair = crypto.generateKeyPairSync("ed25519");
const trustedKeys = [{
  keyId: "test-key",
  algorithm: "ed25519",
  publicKey: keyPair.publicKey.export({ format: "der", type: "spki" }).toString("base64")
}];

function sign(manifest) {
  const payload = SignatureVerifier.buildPayload(manifest);
  const value = crypto.sign(null, payload, keyPair.privateKey).toString("base64");
  return { ...manifest, signature: { algorithm: "ed25519", keyId: "test-key", value } };
}

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    pluginId: "mediahub",
    version: "1.1.0",
    channel: "stable",
    engines: { webradio: ">=1.0.0" },
    release: {
      downloadUrl: "https://example.com/mediahub-1.1.0.zip",
      sha256: "a".repeat(64),
      size: 2048,
      releasedAt: "2026-11-01T10:00:00.000Z"
    },
    changelog: "- Neues Feature",
    ...overrides
  };
}

const installedManifest = {
  id: "mediahub",
  name: "MediaHub",
  version: "1.0.0",
  main: "main.js",
  permissions: [],
  engines: { webradio: ">=1.0.0" }
};

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function createPluginDir(root, id, manifest) {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, "main.js"), "module.exports = {};");
  return dir;
}

function createService({ root, installed, catalog, allowInsecure, trustedKeysOverride, reload }) {
  const pluginsRoot = path.join(root, "plugins");
  const updatesRoot = path.join(root, "plugin-updates");
  fs.mkdirSync(pluginsRoot, { recursive: true });
  fs.mkdirSync(updatesRoot, { recursive: true });
  const store = new PluginUpdateStore({ filePath: path.join(updatesRoot, "state.json") });
  const installer = new PluginPackageInstaller({
    pluginsRoot,
    updatesRoot,
    appVersion: "1.0.7",
    logger: { info() {}, warn() {}, error() {} }
  });
  const service = new PluginUpdateService({
    appVersion: "1.0.7",
    pluginsRoot,
    updatesRoot,
    store,
    installer,
    // Der lokale Testserver läuft über HTTP/Loopback.
    allowInsecure: allowInsecure !== false,
    trustedKeys: trustedKeysOverride || trustedKeys,
    catalogClient: { find: async () => catalog() },
    getInstalledPlugins: () => installed(),
    reloadPlugins: reload || (async () => ({ success: true })),
    logger: { info() {}, warn() {}, error() {} }
  });
  return { service, pluginsRoot, updatesRoot, store, installer };
}

async function run() {
  // ── Semver ──
  await test("Semver: Vergleich und Bereiche", () => {
    assert.strictEqual(semver.compare("1.2.0", "1.10.0") < 0, true);
    assert.strictEqual(semver.compare("1.0.0-beta.2", "1.0.0") < 0, true);
    assert.strictEqual(semver.satisfies("1.0.7", ">=1.0.7-alpha.5"), true);
    assert.strictEqual(semver.satisfies("2.0.0", "^1.2.0"), false);
    assert.strictEqual(semver.satisfies("1.2.9", "~1.2.3"), true);
    assert.strictEqual(semver.isValidRange(">=1.0.0 <2.0.0"), true);
    assert.strictEqual(semver.isValidRange("1.x"), false);
  });

  // ── Manifest ──
  await test("Manifest: gültiges Manifest", () => {
    const result = UpdateManifest.validate(baseManifest(), { installedManifest });
    assert.strictEqual(result.valid, true, JSON.stringify(result.errors));
  });

  await test("Manifest: ungültige Plugin-ID", () => {
    const result = UpdateManifest.validate(baseManifest({ pluginId: "Media Hub!" }), { installedManifest });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "invalid_plugin_id"));
  });

  await test("Manifest: Plugin-ID darf nicht wechseln", () => {
    const result = UpdateManifest.validate(baseManifest({ pluginId: "other" }), { installedManifest });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "plugin_id_mismatch"));
  });

  await test("Manifest: ungültige Version", () => {
    const result = UpdateManifest.validate(baseManifest({ version: "1.0" }), { installedManifest });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "invalid_version"));
  });

  await test("Manifest: unbekannter Update-Kanal", () => {
    const result = UpdateManifest.validate(baseManifest({ channel: "nightly" }), { installedManifest });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "unknown_channel"));
  });

  await test("Manifest: unbekanntes Feld wird abgelehnt", () => {
    const result = UpdateManifest.validate(baseManifest({ installScript: "rm -rf /" }), { installedManifest });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === "unknown_field"));
  });

  await test("Manifest: ungültige Prüfsumme und Größe", () => {
    const result = UpdateManifest.validate(baseManifest({
      release: { ...baseManifest().release, sha256: "xyz", size: 10 * 1024 * 1024 * 1024 }
    }), { installedManifest });
    assert.ok(result.errors.some((error) => error.code === "invalid_sha256"));
    assert.ok(result.errors.some((error) => error.code === "invalid_size"));
  });

  await test("Manifest: Berechtigungsdifferenz", () => {
    const diff = UpdateManifest.diffPermissions(
      { permissions: ["events", "storage"] },
      { permissions: ["events", "network"] }
    );
    assert.deepStrictEqual(diff.added, ["network"]);
    assert.deepStrictEqual(diff.removed, ["storage"]);
    assert.strictEqual(diff.changed, true);
  });

  // ── URL-Policy ──
  await test("URL-Policy: HTTPS erzwungen", () => {
    assert.strictEqual(UpdateSourcePolicy.validateUrl("http://example.com/a.zip").ok, false);
    assert.strictEqual(UpdateSourcePolicy.validateUrl("http://example.com/a.zip").code, "insecure_protocol");
  });

  await test("URL-Policy: private und lokale Ziele blockiert", () => {
    assert.strictEqual(UpdateSourcePolicy.validateUrl("https://127.0.0.1/a.zip").code, "ip_literal");
    assert.strictEqual(UpdateSourcePolicy.validateUrl("https://localhost/a.zip").code, "blocked_host");
    assert.strictEqual(UpdateSourcePolicy.validateUrl("https://10.0.0.2/a.zip").code, "ip_literal");
    assert.strictEqual(UpdateSourcePolicy.validateUrl("https://example.com:8443/a.zip").code, "invalid_port");
    assert.strictEqual(UpdateSourcePolicy.validateUrl("https://user:pass@example.com/a.zip").code, "credentials_in_url");
  });

  await test("URL-Policy: DNS auf interne Adresse wird erkannt", async () => {
    const result = await UpdateSourcePolicy.assertPublicHost("plugins.example.com", {
      lookup: async () => [{ address: "192.168.1.10", family: 4 }]
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "private_address");
  });

  // ── Signatur ──
  await test("Signatur: gültige Ed25519-Signatur", () => {
    const manifest = sign(baseManifest());
    const result = SignatureVerifier.verifyManifest(manifest, { keys: trustedKeys });
    assert.strictEqual(result.status, "valid");
  });

  await test("Signatur: manipulierte Nutzlast wird erkannt", () => {
    const manifest = sign(baseManifest());
    manifest.version = "9.9.9";
    const result = SignatureVerifier.verifyManifest(manifest, { keys: trustedKeys });
    assert.strictEqual(result.status, "invalid");
  });

  await test("Signatur: unbekannter Schlüssel", () => {
    const foreign = crypto.generateKeyPairSync("ed25519");
    const manifest = baseManifest();
    const value = crypto.sign(null, SignatureVerifier.buildPayload(manifest), foreign.privateKey).toString("base64");
    const result = SignatureVerifier.verifyManifest(
      { ...manifest, signature: { algorithm: "ed25519", keyId: "unknown", value } },
      { keys: trustedKeys }
    );
    assert.strictEqual(result.status, "unknown_key");
  });

  await test("Signatur: unsigniert wird gemeldet", () => {
    const result = SignatureVerifier.verifyManifest(baseManifest(), { keys: trustedKeys });
    assert.strictEqual(result.status, "unsigned");
  });

  // ── ZIP ──
  await test("ZIP: gültiges Paket wird entpackt", () => {
    const buffer = packageFor("mediahub", "1.1.0");
    const target = tempDir("zip-ok");
    const result = ZipArchive.extract(buffer, target);
    assert.strictEqual(result.files, 2);
    assert.ok(fs.existsSync(path.join(target, "plugin.json")));
  });

  await test("ZIP: ZIP-Slip wird abgelehnt", () => {
    const buffer = makeZip([{ name: "../escape.txt", data: "x" }]);
    const target = tempDir("zip-slip");
    assert.throws(() => ZipArchive.extract(buffer, target), /Unsicherer Pfad|Zielpfad/);
    assert.strictEqual(fs.existsSync(path.join(target, "..", "escape.txt")), false);
  });

  await test("ZIP: absolute Pfade werden abgelehnt", () => {
    const buffer = makeZip([{ name: "/etc/passwd", data: "x" }]);
    assert.throws(() => ZipArchive.extract(buffer, tempDir("zip-abs")), /Unsicherer Pfad/);
  });

  await test("ZIP: Symlinks werden abgelehnt", () => {
    const buffer = makeZip([{ name: "link", data: "x", mode: 0o120777 }]);
    assert.throws(() => ZipArchive.extract(buffer, tempDir("zip-link")), /Symlink/);
  });

  await test("ZIP: manipulierte Daten werden über CRC erkannt", () => {
    const buffer = packageFor("mediahub", "1.1.0");
    const dataOffset = buffer.indexOf("module.exports");
    buffer[dataOffset] = "M".charCodeAt(0);
    assert.throws(() => ZipArchive.extract(buffer, tempDir("zip-crc")), /CRC32|Entpackte Größe/);
  });

  await test("ZIP: Größenlimit pro Eintrag", () => {
    const buffer = packageFor("mediahub", "1.1.0");
    const entries = ZipArchive.readEntries(buffer);
    const verdict = ZipArchive.validateEntries(entries, { ...ZipArchive.DEFAULT_LIMITS, maxEntrySize: 4 });
    assert.strictEqual(verdict.valid, false);
    assert.ok(verdict.errors.some((error) => error.code === "entry_too_large"));
  });

  // ── Download ──
  const payload = packageFor("mediahub", "1.1.0");
  let manifestPayload = JSON.stringify(baseManifest());
  const server = await startServer((request, response) => {
    if (request.url === "/manifest.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(manifestPayload);
      return;
    }
    if (request.url === "/package.zip") {
      response.writeHead(200, { "Content-Type": "application/zip" });
      response.end(payload);
      return;
    }
    if (request.url === "/redirect-private") {
      response.writeHead(302, { Location: "http://10.0.0.5/package.zip" });
      response.end();
      return;
    }
    if (request.url === "/redirect-loop") {
      response.writeHead(302, { Location: "/redirect-loop" });
      response.end();
      return;
    }
    response.writeHead(404);
    response.end("not found");
  });

  await test("Download: Datei mit Prüfsumme", async () => {
    const target = path.join(tempDir("download"), "package.zip");
    const result = await HttpDownloader.download(`${server.origin}/package.zip`, target, {
      allowInsecure: true,
      maxBytes: 1024 * 1024
    });
    assert.strictEqual(result.ok, true, result.message);
    assert.strictEqual(result.sha256, crypto.createHash("sha256").update(payload).digest("hex"));
  });

  await test("Download: Größenlimit greift", async () => {
    const target = path.join(tempDir("download-limit"), "package.zip");
    const result = await HttpDownloader.download(`${server.origin}/package.zip`, target, {
      allowInsecure: true,
      maxBytes: 10
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "too_large");
    assert.strictEqual(fs.existsSync(target), false);
  });

  await test("Download: HTTP-Fehler wird gemeldet", async () => {
    const target = path.join(tempDir("download-404"), "package.zip");
    const result = await HttpDownloader.download(`${server.origin}/missing.zip`, target, {
      allowInsecure: true
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "http_error");
  });

  await test("Download: Redirect auf privaten Host wird blockiert", async () => {
    const target = path.join(tempDir("download-redirect"), "package.zip");
    const result = await HttpDownloader.download(`${server.origin}/redirect-private`, target, {
      allowInsecure: true
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "ip_literal");
  });

  await test("Download: Redirect-Schleife wird begrenzt", async () => {
    const target = path.join(tempDir("download-loop"), "package.zip");
    const result = await HttpDownloader.download(`${server.origin}/redirect-loop`, target, {
      allowInsecure: true
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "too_many_redirects");
  });

  // ── Service: Prüfung ──
  const serviceRoot = tempDir("service");
  let installedPlugins = [];
  let catalogState = { ok: true, entry: { slug: "mediahub", name: "MediaHub", developerName: "Snip3r", latestVersion: "1.1.0" } };
  let updateConfig = { manifestUrl: `${server.origin}/manifest.json` };

  const pluginDir = createPluginDir(path.join(serviceRoot, "plugins"), "mediahub", {
    ...installedManifest,
    update: updateConfig
  });
  installedPlugins = [{
    id: "mediahub",
    name: "MediaHub",
    version: "1.0.0",
    path: pluginDir,
    manifest: { ...installedManifest, update: updateConfig }
  }];

  const { service } = createService({
    root: serviceRoot,
    installed: () => installedPlugins,
    catalog: () => (catalogState.ok
      ? { entry: catalogState.entry, catalog: { ok: true, entries: [catalogState.entry], fetchedAt: Date.now() } }
      : { entry: null, catalog: { ok: false, entries: [], error: { code: "catalog_unavailable", message: "offline" } } })
  });

  function updateManifestPayload(manifest) {
    manifestPayload = JSON.stringify(manifest);
  }

  const packageHash = crypto.createHash("sha256").update(payload).digest("hex");
  function workingManifest(overrides = {}) {
    return sign(baseManifest({
      release: {
        downloadUrl: `${server.origin}/package.zip`,
        sha256: packageHash,
        size: payload.length,
        releasedAt: "2026-11-01T10:00:00.000Z"
      },
      ...overrides
    }));
  }

  await test("Prüfung: Update verfügbar", async () => {
    updateManifestPayload(workingManifest());
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "update_available", JSON.stringify(result));
    assert.strictEqual(result.availableVersion, "1.1.0");
    assert.strictEqual(result.signature.status, "valid");
  });

  await test("Prüfung: kein Update verfügbar", async () => {
    updateManifestPayload(workingManifest({ version: "1.0.0" }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "up_to_date");
  });

  await test("Prüfung: inkompatible WebRadio-Version", async () => {
    updateManifestPayload(workingManifest({ engines: { webradio: ">=2.0.0" } }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "incompatible");
  });

  await test("Prüfung: unbekannter Kanal im Manifest", async () => {
    updateManifestPayload(workingManifest({ channel: "nightly" }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "error");
    assert.strictEqual(result.error.code, "manifest_invalid");
  });

  await test("Prüfung: Manifest gehört zu anderem Kanal", async () => {
    updateManifestPayload(workingManifest({ channel: "beta" }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "channel_mismatch");
  });

  await test("Prüfung: ungültige Signatur blockiert das Update", async () => {
    updateManifestPayload({ ...workingManifest(), version: "1.2.0" });
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "error");
    assert.strictEqual(result.error.code, "signature_invalid");
  });

  await test("Prüfung: nicht freigegebenes Plugin", async () => {
    updateManifestPayload(workingManifest());
    catalogState = { ok: true, entry: null };
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "not_published");
  });

  await test("Prüfung: Website-API nicht erreichbar", async () => {
    catalogState = { ok: false, entry: null };
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "error");
    assert.strictEqual(result.error.code, "catalog_unavailable");
  });

  await test("Prüfung: fehlende Abhängigkeit", async () => {
    catalogState = { ok: true, entry: { slug: "mediahub", name: "MediaHub", developerName: "Snip3r", latestVersion: "1.1.0" } };
    updateManifestPayload(workingManifest({ dependencies: [{ id: "audio-tools", range: ">=1.0.0" }] }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "error");
    assert.strictEqual(result.error.code, "missing_dependencies");
  });

  await test("Prüfung: keine Update-Quelle", async () => {
    installedPlugins = [{
      id: "mediahub",
      name: "MediaHub",
      version: "1.0.0",
      path: pluginDir,
      manifest: { ...installedManifest }
    }];
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "no_source");
    installedPlugins = [{
      id: "mediahub",
      name: "MediaHub",
      version: "1.0.0",
      path: pluginDir,
      manifest: { ...installedManifest, update: updateConfig }
    }];
  });

  await test("Prüfung: Entwickler-Server nicht erreichbar", async () => {
    const closed = await startServer((_request, response) => { response.writeHead(200); response.end(); });
    const closedOrigin = closed.origin;
    await closed.close();
    installedPlugins = [{
      id: "mediahub",
      name: "MediaHub",
      version: "1.0.0",
      path: pluginDir,
      manifest: { ...installedManifest, update: { manifestUrl: `${closedOrigin}/manifest.json` } }
    }];
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "error");
    assert.ok(["network_error", "dns_failed"].includes(result.error.code), result.error.code);
    installedPlugins = [{
      id: "mediahub",
      name: "MediaHub",
      version: "1.0.0",
      path: pluginDir,
      manifest: { ...installedManifest, update: updateConfig }
    }];
  });

  await test("Prüfung: zusätzliche Berechtigungen werden angezeigt", async () => {
    updateManifestPayload(workingManifest({ permissions: ["network"] }));
    const result = await service.checkPlugin("mediahub");
    assert.strictEqual(result.status, "update_available");
    assert.strictEqual(result.requiresPermissionApproval, true);
    assert.deepStrictEqual(result.permissions.added, ["network"]);
  });

  // ── Installation ──
  await test("Installation: Update wird atomar installiert", async () => {
    updateManifestPayload(workingManifest());
    await service.checkPlugin("mediahub");
    const result = await service.applyUpdate("mediahub", {});
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "plugin.json"), "utf8"));
    assert.strictEqual(manifest.version, "1.1.0");
    assert.ok(fs.existsSync(path.join(pluginDir, "main.js")));
  });

  await test("Installation: Berechtigungen ohne Bestätigung blockiert", async () => {
    const root = tempDir("install-permissions");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest, update: updateConfig });
    const installed = [{
      id: "mediahub", name: "MediaHub", version: "1.0.0", path: dir,
      manifest: { ...installedManifest, update: updateConfig }
    }];
    const { service: local } = createService({
      root,
      installed: () => installed,
      catalog: () => ({ entry: { slug: "mediahub", developerName: "Dev", latestVersion: "1.1.0" }, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    updateManifestPayload(workingManifest({ permissions: ["network"] }));
    await local.checkPlugin("mediahub");
    const denied = await local.applyUpdate("mediahub", {});
    assert.strictEqual(denied.ok, false);
    assert.strictEqual(denied.code, "permissions_not_approved");
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
    assert.strictEqual(manifest.version, "1.0.0");
  });

  await test("Installation: bestätigte Berechtigungen werden installiert", async () => {
    const root = tempDir("install-permissions-ok");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest, update: updateConfig });
    const installed = [{
      id: "mediahub", name: "MediaHub", version: "1.0.0", path: dir,
      manifest: { ...installedManifest, update: updateConfig }
    }];
    const { service: local } = createService({
      root,
      installed: () => installed,
      catalog: () => ({ entry: { slug: "mediahub", developerName: "Dev", latestVersion: "1.1.0" }, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    const permissionPackage = packageFor("mediahub", "1.1.0", { permissions: ["network"] });
    const permissionHash = crypto.createHash("sha256").update(permissionPackage).digest("hex");
    fs.writeFileSync(path.join(root, "package.zip"), permissionPackage);
    const permissionServer = await startServer((request, response) => {
      response.writeHead(200, { "Content-Type": "application/zip" });
      response.end(permissionPackage);
    });
    const manifestWithPermission = sign(baseManifest({
      permissions: ["network"],
      release: {
        downloadUrl: `${permissionServer.origin}/package.zip`,
        sha256: permissionHash,
        size: permissionPackage.length,
        releasedAt: "2026-11-01T10:00:00.000Z"
      }
    }));
    updateManifestPayload(manifestWithPermission);
    await local.checkPlugin("mediahub");
    const result = await local.applyUpdate("mediahub", { approvedPermissions: ["network"] });
    await permissionServer.close();
    assert.strictEqual(result.ok, true, JSON.stringify(result));
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
    assert.strictEqual(manifest.version, "1.1.0");
    assert.deepStrictEqual(manifest.permissions, ["network"]);
  });

  await test("Installation: entfernte Berechtigungen erfordern keine Bestätigung", async () => {
    const diff = UpdateManifest.diffPermissions({ permissions: ["network"] }, { permissions: [] });
    assert.deepStrictEqual(diff.removed, ["network"]);
    assert.strictEqual(diff.added.length, 0);
  });

  await test("Installation: falsche Prüfsumme blockiert", async () => {
    const root = tempDir("install-sha");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest, update: updateConfig });
    const installed = [{
      id: "mediahub", name: "MediaHub", version: "1.0.0", path: dir,
      manifest: { ...installedManifest, update: updateConfig }
    }];
    const { service: local } = createService({
      root,
      installed: () => installed,
      catalog: () => ({ entry: { slug: "mediahub", developerName: "Dev", latestVersion: "1.1.0" }, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    updateManifestPayload(workingManifest({
      release: {
        downloadUrl: `${server.origin}/package.zip`,
        sha256: "b".repeat(64),
        size: payload.length,
        releasedAt: "2026-11-01T10:00:00.000Z"
      }
    }));
    await local.checkPlugin("mediahub");
    const result = await local.applyUpdate("mediahub", {});
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "integrity_mismatch");
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
    assert.strictEqual(manifest.version, "1.0.0");
  });

  await test("Installation: unsicherer Download-Link wird abgelehnt", async () => {
    const policy = UpdateSourcePolicy.validateUrl("http://insecure.example.com/package.zip");
    assert.strictEqual(policy.ok, false);
    assert.strictEqual(policy.code, "insecure_protocol");
  });

  await test("Installation: fehlerhaftes Paket wird abgelehnt", async () => {
    const root = tempDir("install-bad-package");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest });
    const { installer } = createService({
      root,
      installed: () => [],
      catalog: () => ({ entry: null, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    const badZip = makeZip([{ name: "plugin.json", data: JSON.stringify({ id: "mediahub", version: "9.9.9", main: "main.js" }) }]);
    const badPath = path.join(root, "bad.zip");
    fs.writeFileSync(badPath, badZip);
    const result = await installer.install({
      installedManifest,
      pluginDirectory: dir,
      manifest: workingManifest(),
      packagePath: badPath,
      reload: async () => ({ ok: true })
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "package_version_mismatch");
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8")).version, "1.0.0");
  });

  await test("Installation: ZIP-Slip im Paket wird abgelehnt", async () => {
    const root = tempDir("install-slip");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest });
    const { installer } = createService({
      root,
      installed: () => [],
      catalog: () => ({ entry: null, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    const malicious = makeZip([
      { name: "plugin.json", data: JSON.stringify({ id: "mediahub", version: "1.1.0", main: "main.js" }) },
      { name: "../../evil.txt", data: "x" }
    ]);
    const maliciousPath = path.join(root, "evil.zip");
    fs.writeFileSync(maliciousPath, malicious);
    const result = await installer.install({
      installedManifest,
      pluginDirectory: dir,
      manifest: workingManifest(),
      packagePath: maliciousPath,
      reload: async () => ({ ok: true })
    });
    assert.strictEqual(result.ok, false);
    assert.ok(["install_failed", "invalid_archive"].includes(result.code), result.code);
    assert.strictEqual(fs.existsSync(path.join(root, "evil.txt")), false);
  });

  await test("Installation: Rollback stellt vorherige Version wieder her", async () => {
    const root = tempDir("install-rollback");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest });
    const { installer, updatesRoot } = createService({
      root,
      installed: () => [],
      catalog: () => ({ entry: null, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    const goodZip = packageFor("mediahub", "1.1.0");
    const goodPath = path.join(root, "good.zip");
    fs.writeFileSync(goodPath, goodZip);
    const result = await installer.install({
      installedManifest,
      pluginDirectory: dir,
      manifest: workingManifest(),
      packagePath: goodPath,
      reload: async () => ({ ok: false, message: "Plugin startet nicht" })
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "install_failed_rolled_back");
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
    assert.strictEqual(manifest.version, "1.0.0");
    assert.ok(fs.existsSync(path.join(updatesRoot, "backups", "mediahub")));
  });

  await test("Installation: fehlgeschlagener Rollback bleibt nachvollziehbar", async () => {
    const root = tempDir("install-rollback-fail");
    const dir = createPluginDir(path.join(root, "plugins"), "mediahub", { ...installedManifest });
    const { installer } = createService({
      root,
      installed: () => [],
      catalog: () => ({ entry: null, catalog: { ok: true, entries: [], fetchedAt: Date.now() } })
    });
    const goodZip = packageFor("mediahub", "1.1.0");
    const goodPath = path.join(root, "good.zip");
    fs.writeFileSync(goodPath, goodZip);

    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (String(from).includes(`${path.sep}backups${path.sep}`) && to === dir) {
        const error = new Error("Zugriff verweigert");
        error.code = "EACCES";
        throw error;
      }
      return originalRename(from, to);
    };
    let result;
    try {
      result = await installer.install({
        installedManifest,
        pluginDirectory: dir,
        manifest: workingManifest(),
        packagePath: goodPath,
        reload: async () => ({ ok: false, message: "Plugin startet nicht" })
      });
    } finally {
      fs.renameSync = originalRename;
    }
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, "rollback_failed");
  });

  await test("Bestehende Plugin-Funktionen bleiben unberührt", async () => {
    const PluginLoader = require("../../electron/core/plugins/PluginLoader");
    const discoveryRoot = tempDir("discovery");
    createPluginDir(discoveryRoot, "mediahub", installedManifest);
    const StorageManager = require("../../electron/core/storage/StorageManager");
    const original = StorageManager.getPluginPath;
    StorageManager.getPluginPath = () => discoveryRoot;
    try {
      const discovered = PluginLoader.discoverPlugins();
      assert.strictEqual(discovered.length, 1);
      assert.strictEqual(discovered[0].id, "mediahub");
      assert.ok(discovered[0].fingerprint);
    } finally {
      StorageManager.getPluginPath = original;
    }
  });

  await test("Store: Einstellungen und Grenzen", () => {
    const filePath = path.join(tempDir("store"), "state.json");
    const store = new PluginUpdateStore({ filePath });
    assert.strictEqual(store.getSettings().autoCheck, true);
    store.updateSettings({ autoCheck: false, intervalHours: 999, defaultChannel: "beta" });
    const settings = store.getSettings();
    assert.strictEqual(settings.autoCheck, false);
    assert.strictEqual(settings.intervalHours, 168);
    assert.strictEqual(settings.defaultChannel, "beta");
    store.updatePluginState("mediahub", { channel: "alpha" });
    assert.strictEqual(store.getPluginState("mediahub").channel, "alpha");
  });

  await server.close();
}

run()
  .catch((error) => {
    console.error("Testlauf abgebrochen:", error);
    failed += 1;
  })
  .finally(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch { /* best effort */ }
    console.log("==========================================");
    console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failures.length > 0) {
      console.log("Fehlgeschlagen:");
      failures.forEach(({ name, error }) => console.log(`  - ${name}: ${error.message}`));
    }
    process.exit(failed > 0 ? 1 : 0);
  });
