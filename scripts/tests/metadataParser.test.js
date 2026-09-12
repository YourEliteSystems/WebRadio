"use strict";

const assert = require("assert");
const { parseTitle } = require("../../electron/core/audio/metadataParser");

console.log("==========================================");
console.log("🧪 Starte Metadata Parser Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        testsFailed++;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. Gültige Metadata
// ─────────────────────────────────────────────────────────────
console.log("\n[1] Gültige Metadata");

test("Parst 'Künstler - Titel' korrekt", () => {
    const res = parseTitle("Alice Merton - No Roots");
    assert.strictEqual(res.artist, "Alice Merton");
    assert.strictEqual(res.song, "No Roots");
});

test("Parst 'Künstler: Titel' korrekt", () => {
    const res = parseTitle("Daft Punk: One More Time");
    assert.strictEqual(res.artist, "Daft Punk");
    assert.strictEqual(res.song, "One More Time");
});

test("Parst Titel mit mehreren Bindestrichen (Song behält Rest)", () => {
    const res = parseTitle("Artist - Song - Remix");
    assert.strictEqual(res.artist, "Artist");
    assert.strictEqual(res.song, "Song - Remix");
});

test("Parst fehlenden Artist als 'Unbekannt'", () => {
    const res = parseTitle("Nur Ein Titel");
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Nur Ein Titel");
});

// ─────────────────────────────────────────────────────────────
// 2. Fehlende / ungültige Metadata
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Fehlende / ungültige Metadata");

test("Liefert Unbekannt bei null", () => {
    const res = parseTitle(null);
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Unbekannt");
});

test("Liefert Unbekannt bei undefined", () => {
    const res = parseTitle(undefined);
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Unbekannt");
});

test("Liefert Unbekannt bei leerem String", () => {
    const res = parseTitle("");
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Unbekannt");
});

test("Liefert Unbekannt bei leerem Whitespace", () => {
    const res = parseTitle("   ");
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Unbekannt");
});

test("Liefert Unbekannt bei Nicht-String (Zahl)", () => {
    const res = parseTitle(42);
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Unbekannt");
});

test("Behandelt zu kurzen Artist (1 Zeichen) als Unbekannt", () => {
    const res = parseTitle("A - Song Title");
    assert.strictEqual(res.artist, "Unbekannt");
    assert.strictEqual(res.song, "Song Title");
});

// ─────────────────────────────────────────────────────────────
// 3. Sonderzeichen & Whitespace
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Sonderzeichen & Whitespace");

test("Normalisiert En-Dash (U+2013) zu Bindestrich", () => {
    const res = parseTitle("Künstler \u2013 Titel");
    assert.strictEqual(res.artist, "Künstler");
    assert.strictEqual(res.song, "Titel");
});

test("Normalisiert Em-Dash (U+2014) zu Bindestrich", () => {
    const res = parseTitle("Künstler \u2014 Titel");
    assert.strictEqual(res.artist, "Künstler");
    assert.strictEqual(res.song, "Titel");
});

test("Kollabiert mehrfache Leerzeichen", () => {
    const res = parseTitle("Artist  -   Song");
    assert.strictEqual(res.artist, "Artist");
    assert.strictEqual(res.song, "Song");
});

test("Trimmt führende/trailende Whitespace", () => {
    const res = parseTitle("  Artist - Song  ");
    assert.strictEqual(res.artist, "Artist");
    assert.strictEqual(res.song, "Song");
});

test("Behält Sonderzeichen im Songtitel (Umlaute)", () => {
    const res = parseTitle("Ärzte - Männer sind Schweine");
    assert.strictEqual(res.artist, "Ärzte");
    assert.strictEqual(res.song, "Männer sind Schweine");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}