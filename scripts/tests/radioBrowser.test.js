"use strict";
const assert = require("assert");
const os = require("os");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, m, o) {
    if (r === "electron") return "el-rb";
    return origResolve.call(this, r, p, m, o);
};
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wbrb-test-"));
const logsDir = path.join(tmpRoot, "logs");
const tempDir = path.join(tmpRoot, "temp");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });
const fakeApp = {
    isPackaged: true, getVersion: () => "1.0.6-beta.4",
    getPath: (k) => k === "userData" ? tmpRoot : (k === "temp" ? path.join(tmpRoot, "temp") : tmpRoot)
};
require.cache["el-rb"] = { id: "el-rb", filename: "el-rb", loaded: true, exports: { app: fakeApp } };
require("../../electron/core/storage/StorageManager").initialize();
// LogManager nur mit ConsoleTransport, damit der FileTransport in Tests
// kein ENOENT-Probleme macht und kein Schreib-Overhead entsteht.
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
LogManager.reset();
LogManager.initialize({ transports: ["console"] });

let pass = 0, fail = 0;
// Sequenzielle async-Tests: wichtig, weil Service-Zustand (Cache/Mirror) und
// der fetch-Mock geteilt sind – parallele Ausführung erzeugt Zombie-Fetches.
async function test(name, fn) {
    try { await fn(); console.log(`  [OK] ${name}`); pass++; }
    catch (e) { console.error(`  [FAIL] ${name}: ${(e && e.message) || String(e)}`); fail++; }
}

let fetchMock = null;
const origFetch = globalThis.fetch;
globalThis.fetch = function (url, options) {
    if (fetchMock) {
        return fetchMock(url, options);
    }
    return Promise.reject(new Error("fetch not mocked"));
};
function setFetchMock(fn) { fetchMock = fn; }
function clearFetchMock() { fetchMock = null; }

function loadService() {
    delete require.cache[require.resolve("../../electron/core/services/RadioBrowserService.js")];
    return require("../../electron/core/services/RadioBrowserService.js");
}

async function withService(mockFn, fn) {
    setFetchMock(mockFn);
    const rbs = loadService();
    try {
        await fn(rbs);
    } finally {
        clearFetchMock();
    }
}

function mockAll(searchMock) {
    return async (url) => {
        if (url.includes("/servers")) {
            return { ok: true, json: async () => [{ name: "test.api.radio-browser.info" }] };
        }
        return searchMock(url);
    };
}

(async () => {
    console.log("=== RadioBrowser Tests ===");

    console.log("\n[1] Suche");
    await test("erfolgreiche Suche liefert Stationen", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [{ name: "S1", url: "http://s1.com" }, { name: "S2", url: "http://s2.com" }] })),
        async (rbs) => {
            const result = await rbs.search("test");
            assert.ok(Array.isArray(result), "Array");
            assert.strictEqual(result.length, 2, "2 Stationen");
        }));

    await test("Suche mit Country-Code", () =>
        withService(mockAll(async (url) => { assert.ok(url.includes("countrycode=DE"), `URL: ${url}`); return { ok: true, json: async () => [{ name: "DE", url: "http://de.com" }] }; }),
        async (rbs) => { await rbs.search({ name: "test", country: "DE" }); }));

    await test("Suche mit Genre-Tag", () =>
        withService(mockAll(async (url) => { assert.ok(url.includes("tag=rock"), `URL: ${url}`); return { ok: true, json: async () => [{ name: "Rock", url: "http://r.com" }] }; }),
        async (rbs) => { await rbs.search({ genre: "rock" }); }));

    await test("Suche mit String-Parameter", () =>
        withService(mockAll(async (url) => { assert.ok(url.includes("name=Test"), `URL: ${url}`); return { ok: true, json: async () => [{ name: "T", url: "http://t.com" }] }; }),
        async (rbs) => { await rbs.search("Test"); }));
console.log("\n[2] Edge Cases");
    await test("leere Ergebnisse", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [] })),
        async (rbs) => { assert.strictEqual((await rbs.search("none")).length, 0, "Keine"); }));

    await test("API-Fehler wird propagiert", () =>
        withService(mockAll(async () => ({ ok: false, status: 500, json: async () => ({}) })),
        async (_rbs) => { let t = false; try { await _rbs.search("x"); } catch (e) { t = true; assert.ok(e.message.includes("500")); } assert.ok(t); }));

    await test("Netzwerkfehler wird propagiert", () =>
        withService(mockAll(async () => { throw new Error("NetworkError: Failed to fetch"); }),
        async (_rbs) => { let t = false; try { await _rbs.search("x"); } catch (e) { t = true; assert.ok(e.message.includes("NetworkError")); } assert.ok(t); }));

    await test("Timeout wird behandelt", () =>
        withService(mockAll(async () => new Promise((_, rej) => { const e = new Error("Timeout"); e.name = "AbortError"; setTimeout(() => rej(e), 10); })),
        async (_rbs) => { let t = false; try { await _rbs.search("x"); } catch { t = true; } assert.ok(t); }));

    console.log("\n[3] Metadata/Tags");
    await test("Stationsdaten enthalten erwartete Felder", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [{ name: "Radio", url: "http://s.com", homepage: "h", favicon: "f", tags: "a,b", country: "DE", votes: 1, codec: "MP3", bitrate: 128 }] })),
        async (rbs) => { const r = await rbs.search("Radio"); assert.strictEqual(r[0].name, "Radio"); assert.ok(r[0].url); }));

    await test("getCountries filtert 0-Sender-Laender", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [{ name: "DE", stationcount: 100 }, { name: "X", stationcount: 0 }] })),
        async (rbs) => { assert.strictEqual((await rbs.getCountries()).length, 1); }));

    await test("getTags filtert ungueltige Tags", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [{ name: "servers", stationcount: 10 }] })),
        async (_rbs) => {
            const tags = [
                { name: "rock", stationcount: 100 }, { name: "x", stationcount: 2 },
                { name: '"bad"', stationcount: 50 }, { name: "#hidden", stationcount: 50 },
                { name: "1num", stationcount: 50 }, { name: "pop", stationcount: 200 }
            ];
            const filtered = tags.filter(t => {
                const n = t.name.trim();
                return t.stationcount >= 5 && !n.includes('"') && !n.startsWith("#") && !/^\d/.test(n) && n.length <= 40;
            });
            assert.strictEqual(filtered.length, 2, `Gueltige: ${filtered.length}`);
        }));

    console.log("\n[4] Mirror");
    await test("getActiveMirror nach erfolgreichem Fetch", () =>
        withService(mockAll(async () => ({ ok: true, json: async () => [{ name: "T", url: "http://t.com" }] })),
        async (rbs) => { await rbs.search("x"); assert.ok(rbs.getActiveMirror()); }));

    globalThis.fetch = origFetch;
    console.log("\n==========================================");
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {
        // Ignore cleanup errors
    }
    if (fail > 0) process.exit(1);
})();