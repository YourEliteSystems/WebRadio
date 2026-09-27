const Module = require("module");
const fs = require("fs");
// PluginHttpServer – Lokaler HTTP-Server für Plugin-Ressourcen
// Testet CORS-Regeln, MIME-Typen und den Renderer-Serve.
"use strict";

const assert = require("assert");
const http = require("http");
const os = require("os");
const path = require("path");

// ─── Sandbox-Indirektion für electron/ core-require ───────────────────────────
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "electron" || request === "electron-stub") return "electron-stub";
    return origResolve.call(this, request, parent, isMain, options);
};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-phs-test-"));
fs.mkdirSync(path.join(tmpRoot, "plugins", "mediahub"), { recursive: true });
fs.writeFileSync(
    path.join(tmpRoot, "plugins", "mediahub", "renderer.js"),
    "\"use strict\";\nmodule.exports = {};\n"
);

const fakeApp = {
    getPath: () => tmpRoot,
    isPackaged: true
};
require.cache["electron-stub"] = {
    id: "electron-stub",
    filename: "electron-stub",
    loaded: true,
    exports: { app: fakeApp }
};

// ─── Anforderung der Server-Klasse ───────────────────────────────────────────
const PluginHttpServer = require("../../electron/core/plugins/PluginHttpServer");

let pass = 0;
let fail = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        pass++;
    } catch (err) {
        console.error(`  ❌ ${name}: ${err.message}`);
        fail++;
    }
}

function request(method, urlPath, { origin, contentType } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                host: "127.0.0.1",
                port: PluginHttpServer.getPort(),
                path: urlPath,
                method,
                headers: origin ? { origin } : undefined
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

// Verzeichnis für Plugin-Root
const pluginRoot = path.join(tmpRoot, "plugins", "mediahub");

test("PluginHttpServer lädt /plugins/mediahub/renderer.js mit 200, application/javascript und CORS", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "file://" });
    assert.strictEqual(res.status, 200, `Status: ${res.status}`);
    assert.strictEqual(res.headers["content-type"], "application/javascript; charset=utf-8");
    assert.strictEqual(res.headers["access-control-allow-origin"], "file://");
    assert.ok(res.body.includes("module.exports"));
});

test("Origin file:// wird gemäß capability-Regel zugelassen (echo)", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js", { origin: "file://" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["access-control-allow-origin"], "file://");
});

test("Fehlendes Origin -> Access-Control-Allow-Origin: * für lokale Plugin-Ressourcen", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
});

test("Content-Type bleibt application/javascript für renderer.js", async () => {
    const res = await request("GET", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.headers["content-type"], "application/javascript; charset=utf-8");
});

test("Methoden außer GET/HEAD werden abgelehnt", async () => {
    const res = await request("POST", "/plugins/mediahub/renderer.js");
    assert.strictEqual(res.status, 405);
});

test("Traversal-Versuch bleibt abgelehnt", async () => {
    const res = await request("GET", "/plugins/mediahub/../../package.json");
    assert.strictEqual(res.status, 403);
});
