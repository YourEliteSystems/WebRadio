// Icon-Rendering Tests
// Prüft die zentrale Inline-SVG-Pipeline des Renderers:
//   renderer/ui/iconLibrary.js                → Sanitizing + Namensauflösung
//   electron/core/updates/ChannelMetadata.js  → Core-Icons müssen darstellbar sein
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ICON_LIBRARY_PATH = path.join(__dirname, "../../renderer/ui/iconLibrary.js");
const SIDEBAR_PATH = path.join(__dirname, "../../renderer/components/Sidebar.jsx");
const UPDATES_SETTINGS_PATH = path.join(__dirname, "../../renderer/components/settings/UpdatesSettings.jsx");

// Channel-Metadaten (CommonJS) enthalten die Icon-SVGs der Settings-Ansicht.
const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");

console.log("==========================================");
console.log("🧪 Starte Inline-SVG / Icon-Rendering Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;
let chain = Promise.resolve();

function test(name, fn) {
    chain = chain
        .then(() => fn())
        .then(() => {
            console.log(`  ✅ ${name}`);
            testsPassed++;
        })
        .catch((err) => {
            console.error(`  ❌ ${name}`);
            console.error(`     Error: ${err && err.message ? err.message : String(err)}`);
            testsFailed++;
        });
}

function report() {
    console.log("\n==========================================");
    console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
    console.log("==========================================");
    if (testsFailed > 0) process.exit(1);
}

// Die Icon-Bibliothek ist ESM (wird von esbuild gebündelt) und wird deshalb
// asynchron geladen; alle Tests laufen über die Promise-Kette.
let lib = null;
chain = chain.then(async () => {
    lib = await import(pathToFileURL(ICON_LIBRARY_PATH).href);
});

// ─────────────────────────────────────────────────────────────
// 1. normalizeSvgMarkup – Sanitizing & CSS-Hoheit über die Größe
// ─────────────────────────────────────────────────────────────
console.log("\n[1] normalizeSvgMarkup Tests");

test("Leitet echtes SVG-Markup weiter und ergänzt die Steuerklasse", () => {
    const svg = lib.normalizeSvgMarkup('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0z"/></svg>');
    assert.ok(svg, "SVG-Markup muss akzeptiert werden");
    assert.match(svg, /class="inline-svg__icon"/);
    assert.match(svg, /viewBox="0 0 24 24"/);
});

test("Entfernt harte width-/height-Attribute zugunsten von CSS", () => {
    const svg = lib.normalizeSvgMarkup('<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M0 0h1h1"/></svg>');
    assert.doesNotMatch(svg, /\swidth=/i);
    assert.doesNotMatch(svg, /\sheight=/i);
});

test("Entfernt XML-Deklaration und Doctype", () => {
    const svg = lib.normalizeSvgMarkup('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg><svg viewBox="0 0 24 24"><path d="M0 0h1"/></svg>');
    assert.ok(svg.startsWith("<svg"), `Prolog wurde nicht entfernt: ${svg.slice(0, 40)}`);
    assert.doesNotMatch(svg, /<\?xml/i);
    assert.doesNotMatch(svg, /<!DOCTYPE/i);
});

test("Verwirft Nicht-SVG-Werte (Klartext, Objekte, leer)", () => {
    assert.strictEqual(lib.normalizeSvgMarkup("media"), null, "Icon-Name ist kein Markup");
    assert.strictEqual(lib.normalizeSvgMarkup(""), null);
    assert.strictEqual(lib.normalizeSvgMarkup("   "), null);
    assert.strictEqual(lib.normalizeSvgMarkup(null), null);
    assert.strictEqual(lib.normalizeSvgMarkup(undefined), null);
    assert.strictEqual(lib.normalizeSvgMarkup({}), null);
    assert.strictEqual(lib.normalizeSvgMarkup("[object Object]"), null);
});

test("Entfernt Skripte, Event-Handler und javascript:-Links", () => {
    const hostile =
        '<svg viewBox="0 0 24 24"><script>alert(1)</script>' +
        '<path onload="alert(2)" d="M0 0h1"/>' +
        '<a xlink:href="javascript:alert(3)"><circle cx="1" cy="1" r="1"/></a></svg>';
    const svg = lib.normalizeSvgMarkup(hostile);
    assert.doesNotMatch(svg, /<script/i);
    assert.doesNotMatch(svg, /\sonload\s*=/i);
    assert.doesNotMatch(svg, /javascript:/i);
    assert.match(svg, /<circle/, "Harmlose Inhalte müssen erhalten bleiben");
});

test("isSvgMarkup unterscheidet Markup und Namen", () => {
    assert.strictEqual(lib.isSvgMarkup('<svg viewBox="0 0 24 24"></svg>'), true);
    assert.strictEqual(lib.isSvgMarkup("radio"), false);
    assert.strictEqual(lib.isSvgMarkup(42), false);
});

// ─────────────────────────────────────────────────────────────
// 2. resolveNavIcon – Namen → Symbol statt Klartext
// ─────────────────────────────────────────────────────────────
console.log("\n[2] resolveNavIcon Tests");

test("Löst Core- und Plugin-Namen zu SVG auf", () => {
    ["radio", "media", "music", "video", "list", "star", "search", "settings", "tools"].forEach((name) => {
        const svg = lib.resolveNavIcon(name);
        assert.ok(svg, `Icon-Name "${name}" muss auflösbar sein`);
        assert.ok(lib.isSvgMarkup(svg), `Icon "${name}" muss darstellbares Markup liefern`);
    });
});

test("Ignoriert Groß-/Kleinschreibung und Leerzeichen", () => {
    assert.strictEqual(lib.resolveNavIcon("MEDIA"), lib.resolveNavIcon("media"));
    assert.strictEqual(lib.resolveNavIcon("  radio  "), lib.resolveNavIcon("radio"));
});

test("Kennt Plugin-Aliase (youtube → video, favorites → star)", () => {
    assert.strictEqual(lib.resolveNavIcon("youtube"), lib.resolveNavIcon("video"));
    assert.strictEqual(lib.resolveNavIcon("favorites"), lib.resolveNavIcon("star"));
    assert.strictEqual(lib.resolveNavIcon("playlist"), lib.resolveNavIcon("list"));
});

test("Gibt unbekanntes SVG-Markup direkt weiter", () => {
    const custom = '<svg viewBox="0 0 16 16"><rect width="16" height="16"/></svg>';
    assert.strictEqual(lib.resolveNavIcon(custom), custom);
});

test("Unbekannte Namen liefern null statt Klartext", () => {
    assert.strictEqual(lib.resolveNavIcon("meda"), null);
    assert.strictEqual(lib.resolveNavIcon(""), null);
    assert.strictEqual(lib.resolveNavIcon("   "), null);
    assert.strictEqual(lib.resolveNavIcon("[object Object]"), null);
    assert.strictEqual(lib.resolveNavIcon(undefined), null);
    assert.strictEqual(lib.resolveNavIcon(null), null);
});

test("Alle Einträge der Icon-Bibliothek sind darstellbar", () => {
    const entries = Object.entries(lib.NAV_ICON_LIBRARY);
    assert.ok(entries.length >= 15, `Erwartet >= 15 Icons, erhalten ${entries.length}`);
    entries.forEach(([name, markup]) => {
        assert.ok(lib.normalizeSvgMarkup(markup), `Icon "${name}" ist nicht renderbar`);
    });
});

// ─────────────────────────────────────────────────────────────
// 3. Core-Metadaten → Settings-Rendering
// ─────────────────────────────────────────────────────────────
console.log("\n[3] ChannelMetadata → Inline-SVG Tests");

test("Jeder Update-Channel liefert renderbares Icon-Markup", () => {
    const all = ChannelMetadata.getAllUpdateChannelMetadata();
    assert.strictEqual(all.length, ChannelMetadata.CHANNEL_IDS.length);
    all.forEach((meta) => {
        assert.ok(lib.isSvgMarkup(meta.icon), `Channel "${meta.id}" hat kein SVG-Icon`);
    });
});

test("Kanal-Icons verlieren ihre harte Größe und erben currentColor", () => {
    ChannelMetadata.getAllUpdateChannelMetadata().forEach((meta) => {
        const svg = lib.normalizeSvgMarkup(meta.icon);
        assert.doesNotMatch(svg, /\swidth=/i, `Channel "${meta.id}" erzwingt eine Breite`);
        assert.doesNotMatch(svg, /\sheight=/i, `Channel "${meta.id}" erzwingt eine Höhe`);
        assert.match(svg, /currentColor/, `Channel "${meta.id}" erbt keine Schriftfarbe`);
    });
});

// ─────────────────────────────────────────────────────────────
// 4. Aufrufvertrag in der Oberfläche
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Komponenten-Vertrag Tests");

test("Sidebar rendert Navigations-Icons über <NavIcon/>", () => {
    const source = fs.readFileSync(SIDEBAR_PATH, "utf8");
    assert.match(source, /import NavIcon from/, "Sidebar muss NavIcon einbinden");
    assert.doesNotMatch(source, />\s*\{(item|section)\.icon\}/,
        "Rohes Icon-Feld darf nicht als Text ausgegeben werden");
});

test("UpdatesSettings rendert Kanal-Icons über <InlineSvg/>", () => {
    const source = fs.readFileSync(UPDATES_SETTINGS_PATH, "utf8");
    assert.match(source, /import InlineSvg from/, "UpdatesSettings muss InlineSvg einbinden");
    assert.doesNotMatch(source, />\s*\{meta\.icon\}/,
        "SVG-String darf nicht direkt als JSX-Kind stehen");
});

report_chain();


