"use strict";

/**
 * Tests für das Laden von Renderer-Plugin-Skripten.
 *
 * Zwei Ebenen:
 *  1. Sicherheits-/Regressionsgurte: Die Content-Security-Policy des Hauptfensters
 *     muss den lokalen Plugin-HTTP-Server erlauben; `webSecurity` bleibt aktiv;
 *     das Preload darf nicht durch eine doppelte Exposition abbrechen.
 *  2. Verhaltenstest: Der RendererPluginManager wird in einer Sandbox mit
 *     DOM-Stubs geladen. Geprüft wird, dass ein fehlgeschlagenes Skript den
 *     tatsächlichen Grund protokolliert und einen späteren erfolgreichen
 *     Startversuch nicht dauerhaft blockiert.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..", "..");

let pass = 0, fail = 0;
const skipped = [];
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

console.log("==========================================");
console.log("🧪 Starte Renderer-Plugin-Lade-Tests");
console.log("==========================================");

// ─────────────────────────────────────────────────────────────
// 1. Sicherheits-/Regressionsgurte (Quelltextprüfungen)
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Sicherheits- und Regressionsgurte");

test("CSP des Hauptfensters erlaubt Skripte des lokalen Plugin-HTTP-Servers", () => {
    const html = fs.readFileSync(path.join(ROOT, "renderer", "index.html"), "utf8");
    assert.ok(
        /script-src[^;]*http:\/\/127\.0\.0\.1:\*/.test(html),
        "script-src muss die Loopback-Adresse des PluginHttpServer erlauben " +
        "(sonst blockiert die CSP jedes Plugin-Renderer-Skript)"
    );
    assert.ok(
        /frame-src[^;]*http:\/\/127\.0\.0\.1:\*/.test(html),
        "frame-src muss lokale Plugin-Assets (z. B. player.html) erlauben"
    );

    const scriptSrc = (/script-src([^;]*)/.exec(html) || ["", ""])[1];
    const withoutLoopback = scriptSrc.replace(/http:\/\/127\.0\.0\.1:\*/g, "");
    assert.ok(!withoutLoopback.includes("*"), "Kein pauschales Wildcard in script-src");
});

test("webSecurity bleibt überall aktiv", () => {
    const offenders = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith(".js")) {
                const src = fs.readFileSync(full, "utf8");
                if (/webSecurity\s*:\s*false/.test(src)) offenders.push(path.relative(ROOT, full));
            }
        }
    };
    walk(path.join(ROOT, "electron"));
    assert.deepStrictEqual(offenders, [], `webSecurity darf nicht deaktiviert werden: ${offenders.join(", ")}`);
});

test("Hauptfenster behält contextIsolation und deaktiviertes nodeIntegration", () => {
    const src = fs.readFileSync(path.join(ROOT, "electron", "core", "app", "MainWindow.js"), "utf8");
    assert.ok(/contextIsolation:\s*true/.test(src), "contextIsolation: true");
    assert.ok(/nodeIntegration:\s*false/.test(src), "nodeIntegration: false");
});

test("Preload exponiert updatesAPI nur einmal (sonst bricht das Preload ab)", () => {
    const src = fs.readFileSync(path.join(ROOT, "electron", "preload.js"), "utf8");
    // Kommentarzeilen entfernen – sonst würde die erklärende Notiz mitzählen.
    const active = src
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
    const occurrences = (active.match(/exposeInMainWorld\(\s*["']updatesAPI["']/g) || []).length;
    assert.strictEqual(occurrences, 1, `updatesAPI wird ${occurrences}× exponiert`);
    assert.ok(
        /exposeInMainWorld\(\s*["']updateAPI["']/.test(active),
        "Der updateAPI-Alias bleibt erhalten"
    );
});

test("RendererPluginManager entfernt fehlgeschlagene Skripte (Retry bleibt möglich)", () => {
    const src = fs.readFileSync(path.join(ROOT, "renderer", "plugins", "RendererPluginManager.js"), "utf8");
    assert.ok(/discardFailedScript/.test(src), "Fehlgeschlagene Skripte werden verworfen");
    assert.ok(/injectedScripts\.delete\(pluginId\)/.test(src), "Eintrag wird aus injectedScripts entfernt");
    assert.ok(/securitypolicyviolation/.test(src), "CSP-Verstöße werden erfasst");
});

test("PluginHttpServer protokolliert alle Diagnose-Kategorien", () => {
    const src = fs.readFileSync(path.join(ROOT, "electron", "core", "plugins", "PluginHttpServer.js"), "utf8");
    for (const category of [
        "[route-unregistered]",
        "[unknown-plugin]",
        "[file-missing]",
        "[file-unreadable]",
        "[http-error]",
        "[cors-rejected]",
        "[served]"
    ]) {
        assert.ok(src.includes(category), `Diagnose-Kategorie ${category} fehlt`);
    }
});

// ─────────────────────────────────────────────────────────────
// 2. Verhaltenstest des RendererPluginManager
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Verhalten beim Laden von Renderer-Skripten");

const PLUGIN_URL = "http://127.0.0.1:1/plugins/demo/renderer.js";
const logs = [];
const createdScripts = [];
const appendedScripts = [];

const windowStub = {
    _listeners: new Map(),
    addEventListener(type, handler) {
        if (!this._listeners.has(type)) this._listeners.set(type, new Set());
        this._listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
        this._listeners.get(type)?.delete(handler);
    },
    dispatch(type, event) {
        for (const handler of Array.from(this._listeners.get(type) || [])) handler(event);
    },
    pluginAPI: {
        log: (level, context, message) => logs.push({ level, context, message })
    }
};

const documentStub = {
    createElement(tag) {
        const element = {
            tagName: tag,
            src: "",
            type: "",
            crossOrigin: "",
            removed: false,
            onload: null,
            onerror: null,
            remove() { this.removed = true; }
        };
        createdScripts.push(element);
        return element;
    },
    body: {
        appendChild(element) {
            appendedScripts.push(element);
            return element;
        }
    },
    getElementById: () => null,
    head: { appendChild: () => {} }
};

global.window = windowStub;
global.document = documentStub;

const tick = () => new Promise((resolve) => setImmediate(resolve));

// Der Renderer-Code nutzt ESM-Imports ohne Dateiendung. Nodes nativer
// ESM-Resolver akzeptiert das nicht, deshalb wird das Modul für die Sandbox
// mit esbuild gebündelt und anschließend dynamisch importiert.
const SANDBOX_BUNDLE = path.join(os.tmpdir(), `webradio-rpm-sandbox-${process.pid}.mjs`);

require("esbuild").buildSync({
    entryPoints: [path.join(ROOT, "renderer", "plugins", "RendererPluginManager.js")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: SANDBOX_BUNDLE,
    logLevel: "silent"
});

async function loadManager() {
    return import(`${pathToFileURL(SANDBOX_BUNDLE).href}?sandbox=${Date.now()}`);
}

const lastError = () => [...logs].reverse().find((entry) => entry.level === "error");

test("Ladefehler durch CSP-Blockade wird mit dem tatsächlichen Grund protokolliert", async () => {
    const manager = await loadManager();
    window.api = { getRendererScripts: async () => [PLUGIN_URL] };
    logs.length = 0;

    const loading = manager.loadRendererPlugins();
    await tick();

    assert.strictEqual(createdScripts.length, 1, "Genau ein Skript-Tag wird injiziert");
    assert.strictEqual(appendedScripts.length, 1, "Skript wird in das Dokument eingehängt");
    assert.strictEqual(createdScripts[0].type, "module", "Plugin-Skripte werden als Modul geladen");

    // Chromium meldet die CSP-Blockade, ohne den Server zu kontaktieren.
    window.dispatch("securitypolicyviolation", {
        blockedURI: `${PLUGIN_URL}?t=1`,
        effectiveDirective: "script-src",
        violatedDirective: "script-src 'self'"
    });
    createdScripts[0].onerror({ type: "error", message: "error" });

    await loading;

    const error = lastError();
    assert.ok(error, "Es wurde ein Fehler protokolliert");
    assert.ok(
        error.message.includes("Failed to load renderer script"),
        `Meldung: ${error.message}`
    );
    assert.ok(
        error.message.includes("CSP hat das Laden blockiert"),
        `CSP-Grund fehlt in der Meldung: ${error.message}`
    );
    assert.ok(
        error.message.includes("script-src"),
        `Verletzte Richtlinie fehlt: ${error.message}`
    );
});

test("Nach einem fehlgeschlagenen Laden ist ein späterer erfolgreicher Start möglich", async () => {
    const manager = await loadManager();
    logs.length = 0;

    const loading = manager.loadRendererPlugins();
    await tick();

    assert.strictEqual(
        createdScripts.length,
        2,
        "Der fehlgeschlagene Versuch blockiert einen erneuten Versuch nicht"
    );
    assert.strictEqual(createdScripts[0].removed, true, "Fehlgeschlagenes Skript-Tag wurde entfernt");

    // Diesmal registriert das Skript sein Plugin wie vorgesehen.
    window.registerPlugin({ id: "demo" });
    createdScripts[1].onload();
    await loading;

    const info = [...logs].reverse().find((entry) => entry.level === "info" &&
        entry.message.includes("Loaded renderer script"));
    assert.ok(info, "Erfolgreiches Laden wird protokolliert");
    assert.ok(!lastError(), `Kein Fehler erwartet, erhalten: ${lastError()?.message}`);
});

test("Geladenes, aber nicht registrierendes Skript wird als Registrierungsfehler gemeldet", async () => {
    const manager = await loadManager();
    logs.length = 0;

    const loading = manager.loadRendererPlugins();
    await tick();

    // Kein registerPlugin-Aufruf: Skript lädt, registriert aber nichts.
    createdScripts[2].onload();
    await loading;

    const error = lastError();
    assert.ok(error, "Fehler wird protokolliert");
    assert.ok(
        error.message.includes("hat aber kein Plugin registriert"),
        `Meldung: ${error.message}`
    );
});

function report() {
    console.log("\n==========================================");
    if (skipped.length > 0) console.log(`Übersprungen: ${skipped.join(", ")}`);
    console.log(`Ergebnis: ${pass} bestanden, ${fail} fehlgeschlagen.`);
    console.log("==========================================");
    try { fs.rmSync(SANDBOX_BUNDLE, { force: true }); } catch { /* ignore */ }
    if (fail > 0) process.exit(1);
}

chain.then(report, report);
