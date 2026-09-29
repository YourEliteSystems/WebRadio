"use strict";

/**
 * Tests für den lokalen Plugin-HTTP-Server (PluginHttpServer).
 *
 * Geprüft wird das tatsächliche HTTP-Verhalten: Statuscodes, MIME-Typen,
 * CORS-Header, Preflight, Traversal-Schutz sowie die Wiederaufnahme nach einem
 * fehlgeschlagenen Zugriff. Der Server wird dafür wirklich gestartet und über
 * echtes HTTP (127.0.0.1) angesprochen – nicht nur der Quelltext geprüft.
 */

const assert = require("assert");
const Module = require("module");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

// ─── Sandbox-Indirektion für electron/-Requires ───────────────────────────────
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron" || request === "electron-stub") return "electron-stub";
    return origResolve.call(this, request, parent, isMain, options);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-phs-test-"));
const pluginsRoot = path.join(tmpRoot, "plugins");
const pluginRoot = path.join(pluginsRoot, "mediahub");
const secondRoot = path.join(pluginsRoot, "second");

fs.mkdirSync(pluginRoot, { recursive: true });
fs.mkdirSync(secondRoot, { recursive: true });
fs.mkdirSync(path.join(tmpRoot, "logs"), { recursive: true });

const RENDERER_SOURCE = "\"use strict\";\n// mediahub renderer\nmodule.exports = {};\n";
fs.writeFileSync(path.join(pluginRoot, "renderer.js"), RENDERER_SOURCE, "utf8");
fs.writeFileSync(path.join(pluginRoot, "player.html"), "<!doctype html><html></html>", "utf8");
fs.writeFileSync(path.join(pluginRoot, "styles.css"), "body{color:red}\n", "utf8");
fs.writeFileSync(path.join(pluginRoot, "data.json"), "{\"ok\":true}\n", "utf8");
fs.writeFileSync(path.join(secondRoot, "renderer.js"), "// second\n", "utf8");
// Datei außerhalb aller Plugin-Roots – darf niemals ausgeliefert werden.
fs.writeFileSync(path.join(tmpRoot, "secret.txt"), "STRENG GEHEIM\n", "utf8");

require.cache["electron-stub"] = {
    id: "electron-stub",
    filename: "electron-stub",
    loaded: true,
    exports: { app: { getPath: () => tmpRoot, isPackaged: true } }
};

const PluginHttpServer = require("../../electron/core/plugins/PluginHttpServer");

let pass = 0, fail = 0;
let chain = Promise.resolve();

function test(name, fn) {
    chain = chain
        .then(() => fn())
        .then(() => { console.log(`  [OK] ${name}`); pass++; })
        .catch((err) => {
            console.error(`  [FAIL] ${name}: ${(err && err.message) || err}`);
            fail++;
        });
}

function request(method, urlPath, options = {}) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if ("origin" in options) headers.origin = options.origin;

        const req = http.request(
            {
                host: "127.0.0.1",
                port: PluginHttpServer.getPort(),
                path: urlPath,
                method,
                headers
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
            }
        );
        req.on("error", reject);
        req.end();
    });
}

// Server einmal für alle Tests starten und das Plugin registrieren.
chain = chain.then(async () => {
    await PluginHttpServer.start();
    PluginHttpServer.servePlugin(
        "mediahub",
        pluginRoot,
        ["http-origin", "local-assets", "external-origin", "youtube-iframe"]
    );
});

console.log("==========================================");
console.log("🧪 Starte PluginHttpServer Tests");
console.log("==========================================");

// ─────────────────────────────────────────────────────────────
// 1. Auslieferung registrierter Plugin-Ressourcen
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Auslieferung registrierter Ressourcen");

test("GET auf registrierte Plugin-JavaScript-Datei liefert 200 und application/javascript", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 200, `Status: ${res.status}`);
    assert.strictEqual(
        res.headers["content-type"],
        "application/javascript; charset=utf-8",
        "JavaScript wird mit passendem MIME-Typ ausgeliefert"
    );
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res.body, RENDERER_SOURCE, "Dateiinhalt wird unverändert ausgeliefert");
});

test("HEAD liefert 200, Content-Type und keinen Body", async () => {
    const res = await request("HEAD", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-type"], "application/javascript; charset=utf-8");
    assert.strictEqual(res.body, "", "HEAD darf keinen Body liefern");
});

test("MIME-Typen werden anhand der Dateiendung gesetzt", async () => {
    const html = await request("GET", "/plugins/mediahub/player.html");
    const css = await request("GET", "/plugins/mediahub/styles.css");
    const json = await request("GET", "/plugins/mediahub/data.json");
    assert.strictEqual(html.headers["content-type"], "text/html; charset=utf-8");
    assert.strictEqual(css.headers["content-type"], "text/css; charset=utf-8");
    assert.strictEqual(json.headers["content-type"], "application/json; charset=utf-8");
});

// ─────────────────────────────────────────────────────────────
// 2. Abweisung nicht registrierter Ressourcen
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Abweisung nicht registrierter Ressourcen");

test("Nicht registriertes Plugin wird mit 404 abgewiesen", async () => {
    const res = await request("GET", "/plugins/unbekannt/renderer.js");
    assert.strictEqual(res.status, 404);
    assert.ok(res.body.includes("nicht registriert"), `Meldung: ${res.body}`);
});

test("Route außerhalb von /plugins/<id>/… liefert 404", async () => {
    const res = await request("GET", "/irgendwas/renderer.js");
    assert.strictEqual(res.status, 404);
});

test("Nicht vorhandene Datei im registrierten Plugin liefert 404", async () => {
    const res = await request("GET", "/plugins/mediahub/existiert-nicht.js");
    assert.strictEqual(res.status, 404);
});

// ─────────────────────────────────────────────────────────────
// 3. Traversal-Schutz
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Traversal-Schutz");

test("Path-Traversal wird mit 403 blockiert und liefert keine Fremdinhalte", async () => {
    const res = await request("GET", "/plugins/mediahub/../../secret.txt");
    assert.strictEqual(res.status, 403, `Status: ${res.status}`);
    assert.ok(!res.body.includes("STRENG GEHEIM"), "Fremdinhalt darf nicht ausgeliefert werden");
});

test("Traversal in ein anderes Plugin-Verzeichnis bleibt blockiert", async () => {
    const res = await request("GET", "/plugins/mediahub/../second/renderer.js");
    assert.strictEqual(res.status, 403, `Status: ${res.status}`);
});

test("URL-encodierte Traversal-Variante liefert keinen Fremdinhalt", async () => {
    const res = await request("GET", "/plugins/mediahub/%2e%2e/%2e%2e/secret.txt");
    assert.notStrictEqual(res.status, 200, "Darf nicht erfolgreich sein");
    assert.ok(!res.body.includes("STRENG GEHEIM"), "Fremdinhalt darf nicht ausgeliefert werden");
});

// ─────────────────────────────────────────────────────────────
// 4. CORS im lokalen Electron-Renderer-Kontext (file://)
// ─────────────────────────────────────────────────────────────
console.log("\n[4] CORS im Renderer-Kontext (file://)");

test("Ohne Origin-Header wird Access-Control-Allow-Origin: * gesetzt", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
});

test("Origin: null (file://-Renderer) erhält Access-Control-Allow-Origin: *", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "null" });
    assert.strictEqual(res.status, 200, `Status: ${res.status}`);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
});

test("Origin: file:// erhält Access-Control-Allow-Origin: *", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "file://" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
});

test("Wildcard-CORS setzt niemals Access-Control-Allow-Credentials", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "null" });
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    assert.strictEqual(
        res.headers["access-control-allow-credentials"],
        undefined,
        "Wildcard-CORS darf keine Credentials erlauben"
    );
});

test("Externer Origin ohne passende Capability wird mit 403 abgewiesen", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "https://boese.example" });
    assert.strictEqual(res.status, 403, `Status: ${res.status}`);
    assert.ok(!res.headers["access-control-allow-origin"], "Kein CORS-Freigabekopf für abgelehnte Origins");
});

test("Capability-berechtigter externer Origin wird gespiegelt (Echo + Vary)", async () => {
    const res = await request("GET", "/plugins/mediahub/player.html", { origin: "https://www.youtube.com" });
    assert.strictEqual(res.status, 200, `Status: ${res.status}`);
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://www.youtube.com");
    assert.strictEqual(res.headers["vary"], "Origin");
});

// ─────────────────────────────────────────────────────────────
// 5. Preflight und HTTP-Methoden
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Preflight und HTTP-Methoden");

test("OPTIONS-Preflight wird mit 204 und Allow-Headern beantwortet", async () => {
    const res = await request("OPTIONS", "/plugins/mediahub/renderer.js", { origin: "null" });
    assert.strictEqual(res.status, 204, `Status: ${res.status}`);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    assert.ok(/GET/.test(res.headers["access-control-allow-methods"] || ""), "GET im Allow-Methods");
    assert.ok(/OPTIONS/.test(res.headers["access-control-allow-methods"] || ""), "OPTIONS im Allow-Methods");
    assert.ok(/Origin/.test(res.headers["access-control-allow-headers"] || ""), "Origin im Allow-Headers");
});

test("POST wird mit 405 und Allow-Header abgewiesen", async () => {
    const res = await request("POST", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 405, `Status: ${res.status}`);
    assert.ok(/GET/.test(res.headers.allow || ""), `Allow: ${res.headers.allow}`);
});

// ─────────────────────────────────────────────────────────────
// 6. Bindung und Wiederaufnahme nach Fehlern
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Bindung und Wiederaufnahme");

test("Server ist ausschließlich an 127.0.0.1 gebunden", () => {
    assert.strictEqual(PluginHttpServer.getAddress(), "127.0.0.1");
});

test("Fehlgeschlagener Zugriff verhindert keinen späteren erfolgreichen Start", async () => {
    // Plugin ist nicht registriert → 404
    const denied = await request("GET", "/plugins/retry-plugin/renderer.js");
    assert.strictEqual(denied.status, 404, `Status: ${denied.status}`);

    // Nach der Registrierung liefert derselbe Pfad 200
    PluginHttpServer.servePlugin("retry-plugin", secondRoot, ["http-origin"]);
    const ok = await request("GET", "/plugins/retry-plugin/renderer.js");
    assert.strictEqual(ok.status, 200, `Status: ${ok.status}`);

    // Und nach dem Entfernen erneut 404 (kein dauerhaftes „Hängenbleiben“)
    PluginHttpServer.unservePlugin("retry-plugin");
    const deniedAgain = await request("GET", "/plugins/retry-plugin/renderer.js");
    assert.strictEqual(deniedAgain.status, 404, `Status: ${deniedAgain.status}`);
});

test("servePlugin ignoriert Pfade, die nicht existieren", async () => {
    PluginHttpServer.servePlugin("fehlt", path.join(tmpRoot, "gibt-es-nicht"), ["http-origin"]);
    const res = await request("GET", "/plugins/fehlt/renderer.js");
    assert.strictEqual(res.status, 404, "Nicht existierender Plugin-Pfad darf nicht ausgeliefert werden");
});

async function report() {
    console.log("\n==========================================");
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");

    // Der Server hält offene Handles; ohne Stopp würde der Node-Prozess
    // nach dem Testlauf nicht mehr terminieren.
    try { await PluginHttpServer.stop(); } catch { /* ignore */ }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }

    if (fail > 0) process.exit(1);
}

chain.then(report, report);
