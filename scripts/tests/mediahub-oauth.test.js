"use strict";
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-mh";
    return origResolve.call(this, r, p, m, o);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wbrb-mh-test-"));
const logsDir = path.join(tmpRoot, "logs");
const tempDir = path.join(tmpRoot, "temp");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

const fakeApp = {
    isPackaged: true,
    getVersion: () => "1.0.6-beta.4",
    getPath: (k) => {
        if (k === "userData") return tmpRoot;
        if (k === "temp") return tempDir;
        return tmpRoot;
    }
};

require.cache["el-mh"] = { id: "el-mh", filename: "el-mh", loaded: true, exports: { app: fakeApp } };

require("../../electron/core/storage/StorageManager").initialize();
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: ["console"] });

let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

function cleanup() {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {
        // Ignore cleanup errors
    }
}

console.log("=== MediaHub OAuth Tests ===");

// Test 1: status() gibt false zurück, wenn nicht angemeldet
test("status() gibt false zurück, wenn nicht angemeldet", () => {
    const oauth = require("../../electron/core/services/MediaHubOAuth");
    const result = oauth.status();
    assert.strictEqual(result.connected, false, "Nicht verbunden");
    
    delete require.cache[require.resolve("../../electron/core/services/MediaHubOAuth.js")];
});

// Test 2: signOut() löscht Token-Datei
test("signOut() löscht Token-Datei", () => {
    const oauth = require("../../electron/core/services/MediaHubOAuth");
    
    const tokenFile = path.join(tmpRoot, "plugin-data", "mediahub-oauth.json");
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify({ accessToken: "test", refreshToken: "test", expiresAt: Date.now() + 3600000 }));
    
    assert.ok(fs.existsSync(tokenFile), "Token-Datei existiert");
    
    oauth.signOut();
    
    assert.ok(!fs.existsSync(tokenFile), "Token-Datei nach signOut gelöscht");
    
    delete require.cache[require.resolve("../../electron/core/services/MediaHubOAuth.js")];
});

// Test 3: status() gibt true zurück, wenn Token-Datei existiert
test("status() gibt true zurück, wenn Token-Datei existiert", () => {
    const oauth = require("../../electron/core/services/MediaHubOAuth");
    
    const tokenFile = path.join(tmpRoot, "plugin-data", "mediahub-oauth.json");
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify({ accessToken: "test", refreshToken: "test", expiresAt: Date.now() + 3600000 }));
    
    const result = oauth.status();
    assert.strictEqual(result.connected, true, "Verbunden bei existierender Token-Datei");
    
    delete require.cache[require.resolve("../../electron/core/services/MediaHubOAuth.js")];
});

// Test 4: Preload API ist exponiert
test("Preload API ist exponiert", () => {
    const preloadPath = path.join(__dirname, "../../electron/preload.js");
    const preloadContent = fs.readFileSync(preloadPath, "utf8");
    
    assert.ok(preloadContent.includes("mediaHubAuth"), "mediaHubAuth in preload.js");
    assert.ok(preloadContent.includes("auth-status"), "auth-status in preload.js");
    assert.ok(preloadContent.includes("auth-sign-in"), "auth-sign-in in preload.js");
    assert.ok(preloadContent.includes("auth-sign-out"), "auth-sign-out in preload.js");
    assert.ok(preloadContent.includes("search"), "search in preload.js");
});

// Test 5: registerIpcHandlers importiert mediaHubHandlers
test("registerIpcHandlers importiert mediaHubHandlers", () => {
    const registerIpcHandlersPath = path.join(__dirname, "../../electron/core/ipc/registerIpcHandlers.js");
    const content = fs.readFileSync(registerIpcHandlersPath, "utf8");
    
    assert.ok(content.includes("registerMediaHubHandlers"), "registerMediaHubHandlers importiert");
    assert.ok(content.includes("registerMediaHubHandlers()"), "registerMediaHubHandlers() aufgerufen");
});

// Test 6: Kein Client Secret im Code
test("Kein Client Secret im Code", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");
    
    assert.ok(content.includes("CLIENT_ID"), "CLIENT_ID definiert");
    assert.ok(content.includes("CLIENT_SECRET"), "CLIENT_SECRET Variable vorhanden");
    assert.ok(content.includes("process.env.MEDIAHUB_GOOGLE_CLIENT_SECRET"), "Client Secret wird aus Umgebungsvariable gelesen");
    assert.ok(content.includes("client_id"), "client_id in OAuth-Request");
    assert.ok(content.includes("client_secret"), "client_secret in OAuth-Request");
});

// Test 7: PKCE wird verwendet
test("PKCE wird verwendet", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");
    
    assert.ok(content.includes("code_challenge"), "code_challenge verwendet");
    assert.ok(content.includes("code_verifier"), "code_verifier verwendet");
    assert.ok(content.includes("S256"), "S256 Methode verwendet");
});

// Test 8: 127.0.0.1 Callback
test("127.0.0.1 Callback", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");
    
    assert.ok(content.includes("127.0.0.1"), "127.0.0.1 Callback");
});

// Test 9: Token-Datei-Pfad ist korrekt
test("Token-Datei-Pfad ist korrekt", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");
    
    assert.ok(content.includes("plugin-data"), "plugin-data Ordner");
    assert.ok(content.includes("mediahub-oauth.json"), "mediahub-oauth.json Dateiname");
});

// Test 10: IPC Handlers definieren alle Kanäle
test("IPC Handlers definieren alle Kanäle", () => {
    const handlersPath = path.join(__dirname, "../../electron/core/ipc/mediaHubHandlers.js");
    const content = fs.readFileSync(handlersPath, "utf8");
    
    assert.ok(content.includes("mediahub:auth-status"), "auth-status Handler");
    assert.ok(content.includes("mediahub:auth-sign-in"), "auth-sign-in Handler");
    assert.ok(content.includes("mediahub:auth-sign-out"), "auth-sign-out Handler");
    assert.ok(content.includes("mediahub:search"), "search Handler");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
console.log("==========================================");

cleanup();

if (fail > 0) process.exit(1);
