"use strict";
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const http = require("http");
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

const openedExternalUrls = [];
const fakeShell = {
    openExternal: (url) => {
        openedExternalUrls.push(url);
        return Promise.resolve();
    }
};

require.cache["el-mh"] = { id: "el-mh", filename: "el-mh", loaded: true, exports: { app: fakeApp, shell: fakeShell } };

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

// Test 6: Client Secret ist direkt integriert
test("Client Secret ist direkt integriert", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");
    
    assert.ok(content.includes("CLIENT_ID"), "CLIENT_ID definiert");
    assert.ok(content.includes("CLIENT_SECRET"), "CLIENT_SECRET Konstante definiert");
    assert.ok(!content.includes("process.env.MEDIAHUB_GOOGLE_CLIENT_SECRET"), "Keine Environment Variable Abhängigkeit");
    assert.ok(!content.includes("getClientSecret"), "Keine getClientSecret Funktion");
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

// Test 11: Client Secret ist direkt in den Code integriert
test("Client Secret ist direkt in den Code integriert", () => {
    const oauthPath = path.join(__dirname, "../../electron/core/services/MediaHubOAuth.js");
    const content = fs.readFileSync(oauthPath, "utf8");

    assert.ok(content.includes("const CLIENT_SECRET"), "CLIENT_SECRET Konstante definiert");
    assert.ok(!content.includes("if (clientSecret)"), "Keine bedingte Prüfung - Secret ist immer vorhanden");
    assert.ok(!content.includes("MEDIAHUB_GOOGLE_CLIENT_SECRET"), "Keine Environment Variable mehr");
    assert.ok(!content.includes("console.log(CLIENT_SECRET)"), "Client Secret wird nicht geloggt");
});

const OAUTH_MODULE_PATH = require.resolve("../../electron/core/services/MediaHubOAuth.js");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function rawGet(url) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const request = http.request({
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: "GET"
        }, response => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { body += chunk; });
            response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
        });
        request.setTimeout(10_000, () => request.destroy(new Error("Callback-Request Timeout")));
        request.on("error", reject);
        request.end();
    });
}

async function asyncTest(name, fn) {
    try { await fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

async function beginSignIn() {
    openedExternalUrls.length = 0;
    const outcome = require(OAUTH_MODULE_PATH).signIn().then(value => ({ value }), error => ({ error }));
    for (let i = 0; i < 300 && openedExternalUrls.length === 0; i++) await sleep(10);
    assert.ok(openedExternalUrls.length > 0, "shell.openExternal wurde aufgerufen");
    const authorize = new URL(openedExternalUrls[0]);
    const callbackUrl = authorize.searchParams.get("redirect_uri");
    const state = authorize.searchParams.get("state");
    assert.ok(callbackUrl, "redirect_uri im Authorize-Request");
    assert.ok(state, "state im Authorize-Request");
    return { outcome, callbackUrl, state };
}

function styleOf(html) {
    const match = html.match(/<style>([\s\S]*?)<\/style>/);
    assert.ok(match, "Inline-Styleblock vorhanden");
    return match[1];
}

function assertOauthHeaders(res) {
    assert.strictEqual(res.headers["content-type"], "text/html; charset=utf-8", "Content-Type");
    assert.strictEqual(res.headers["cache-control"], "no-store", "Cache-Control");
}

async function runOauthCallbackTests() {
    const realFetch = global.fetch;

    await asyncTest("Erfolgreicher OAuth-Callback liefert HTTP 200 mit Erfolgsseite", async () => {
        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({ access_token: "ACCESS_TOKEN_VALUE", refresh_token: "REFRESH_TOKEN_VALUE", expires_in: 3600 })
        });
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}&code=AUTHORIZATION_CODE_VALUE`);
            const result = await outcome;

            assert.strictEqual(res.status, 200, "HTTP 200");
            assert.deepStrictEqual(result.value, { connected: true }, "signIn() meldet verbunden");
            assert.strictEqual(result.error, undefined, "kein Fehler");
            assert.ok(res.body.includes("Erfolgreich verbunden"), "Überschrift");
            assert.ok(res.body.includes("MediaHub wurde erfolgreich mit deinem Konto verbunden."), "Beschreibung");
            assert.ok(res.body.includes("Du kannst dieses Fenster jetzt schließen."), "Hinweis");
            assert.ok(res.body.includes("status--success"), "grüner Erfolgsindikator");
            assert.ok(res.body.includes("#16a34a"), "grüne Hintergrundfarbe des Indikators");
            assert.ok(res.body.includes("M5 12.6l4.6 4.6"), "Checkmark-SVG");
            assert.ok(res.body.includes("M8 5.6v12.8L18.4 12z"), "MediaHub-Play-Symbol");
            assertOauthHeaders(res);
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Erfolgsseite liefert die geforderten HTTP-Header", async () => {
        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({ access_token: "ACCESS_TOKEN_VALUE", refresh_token: "REFRESH_TOKEN_VALUE", expires_in: 3600 })
        });
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}&code=AUTHORIZATION_CODE_VALUE`);
            await outcome;
            assertOauthHeaders(res);
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Erfolgsseite enthält keine Tokens, Codes oder Secrets", async () => {
        global.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({ access_token: "ACCESS_TOKEN_VALUE", refresh_token: "REFRESH_TOKEN_VALUE", expires_in: 3600 })
        });
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}&code=AUTHORIZATION_CODE_VALUE`);
            await outcome;
            for (const secret of ["AUTHORIZATION_CODE_VALUE", "ACCESS_TOKEN_VALUE", "REFRESH_TOKEN_VALUE", "GOCSPX-"]) {
                assert.ok(!res.body.includes(secret), `Body enthält kein ${secret}`);
            }
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Fehlerseite: HTTP 400, Dark-Theme und tatsächliche Fehlerbeschreibung", async () => {
        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const description = "<img src=x onerror=alert(1)> & \"beschrieben\"";
            const res = await rawGet(
                `${callbackUrl}?state=${encodeURIComponent(state)}&error=access_denied&error_description=${encodeURIComponent(description)}`
            );
            await outcome;

            assert.strictEqual(res.status, 400, "HTTP 400");
            assert.ok(res.body.includes("Verbindung fehlgeschlagen"), "Überschrift");
            assert.ok(res.body.includes("MediaHub konnte nicht mit deinem Konto verbunden werden."), "Beschreibung");
            assert.ok(res.body.includes("Du kannst dieses Fenster jetzt schließen und es erneut versuchen."), "Hinweis");
            assert.ok(res.body.includes("status--error"), "roter Fehlerindikator");
            assert.ok(res.body.includes("color-scheme:dark"), "Dark-Theme Meta");
            assert.ok(res.body.includes("--bg:#0f1115"), "dunkler Hintergrund");
            assertOauthHeaders(res);
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Fehlerseite verwendet dasselbe Grunddesign wie die Erfolgsseite", async () => {
        global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ access_token: "A", refresh_token: "R", expires_in: 3600 }) });
        let successBody;
        try {
            const success = await beginSignIn();
            const res = await rawGet(`${success.callbackUrl}?state=${encodeURIComponent(success.state)}&code=AUTHORIZATION_CODE_VALUE`);
            await success.outcome;
            successBody = res.body;
        } finally { global.fetch = realFetch; }

        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        try {
            const failure = await beginSignIn();
            const res = await rawGet(`${failure.callbackUrl}?state=${encodeURIComponent(failure.state)}&error=access_denied`);
            await failure.outcome;
            assert.strictEqual(styleOf(res.body), styleOf(successBody), "identischer CSS-Block");
            assert.ok(res.body.includes("<!DOCTYPE html>"), "HTML5-Doctype");
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Fehlertext wird HTML-sicher escaped", async () => {
        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const description = "<script>window.stolen=1</script>";
            const res = await rawGet(
                `${callbackUrl}?state=${encodeURIComponent(state)}&error=access_denied&error_description=${encodeURIComponent(description)}`
            );
            await outcome;

            assert.ok(!res.body.includes("<script>window.stolen=1</script>"), "kein roher HTML-Einschleusung");
            assert.ok(!res.body.includes("<script>"), "kein Script-Tag");
            assert.ok(res.body.includes("&lt;script&gt;window.stolen=1&lt;/script&gt;"), "geescapeter Fehlertext bleibt sichtbar");
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Fehlerseite ohne OAuth-Parameter nennt den konkreten Grund", async () => {
        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        try {
            const { outcome, callbackUrl, state } = await beginSignIn();
            const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}`);
            await outcome;

            assert.strictEqual(res.status, 400, "HTTP 400");
            assert.ok(res.body.includes("Google hat keinen Anmeldecode geliefert."), "konkrete Fehlerbeschreibung");
            assertOauthHeaders(res);
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Ungültiger State: Fehlerseite ohne Reflektion des Authorization-Codes", async () => {
        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        try {
            const { outcome, callbackUrl } = await beginSignIn();
            const res = await rawGet(`${callbackUrl}?state=WRONG_STATE&code=AUTHORIZATION_CODE_VALUE&error_description=%3Cscript%3E`);
            const error = (await outcome).error;

            assert.strictEqual(res.status, 400, "HTTP 400");
            assert.strictEqual(error && error.message, "Ungültige OAuth-Antwort.", "Flow-Verhalten unverändert");
            assert.ok(res.body.includes("Verbindung fehlgeschlagen"), "Fehlerseite");
            assert.ok(res.body.includes("Anmeldung fehlgeschlagen."), "bisheriger Fehlertext bleibt erhalten");
            assert.ok(!res.body.includes("AUTHORIZATION_CODE_VALUE"), "kein Authorization-Code im Body");
            assert.ok(!res.body.includes("<script>"), "Parameter werden nicht reflektiert");
            assertOauthHeaders(res);
        } finally { global.fetch = realFetch; }
    });

    await asyncTest("Beide Seiten nennen niemals Tokens, Codes oder Secrets", async () => {
        global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ access_token: "ACCESS_TOKEN_VALUE", refresh_token: "REFRESH_TOKEN_VALUE", expires_in: 3600 }) });
        const successRes = await (async () => {
            try {
                const { outcome, callbackUrl, state } = await beginSignIn();
                const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}&code=AUTHORIZATION_CODE_VALUE`);
                await outcome;
                return res;
            } finally { global.fetch = realFetch; }
        })();

        global.fetch = async () => { throw new Error("Token-Endpunkt darf nicht erreicht werden"); };
        const failureRes = await (async () => {
            try {
                const { outcome, callbackUrl, state } = await beginSignIn();
                const res = await rawGet(`${callbackUrl}?state=${encodeURIComponent(state)}&error=access_denied`);
                await outcome;
                return res;
            } finally { global.fetch = realFetch; }
        })();

        for (const res of [successRes, failureRes]) {
            for (const secret of ["AUTHORIZATION_CODE_VALUE", "ACCESS_TOKEN_VALUE", "REFRESH_TOKEN_VALUE", "GOCSPX-", "client_secret"]) {
                assert.ok(!res.body.includes(secret), `Body enthält kein ${secret}`);
            }
            assertOauthHeaders(res);
        }
    });
}

(async () => {
    await runOauthCallbackTests();
    require(OAUTH_MODULE_PATH).signOut();

    console.log("\n==========================================");
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");

    cleanup();
    process.exitCode = fail > 0 ? 1 : 0;
})().catch(error => {
    console.error(`  [FAIL] Unerwarteter Fehler: ${(error && error.stack) || error}`);
    cleanup();
    process.exit(1);
});
