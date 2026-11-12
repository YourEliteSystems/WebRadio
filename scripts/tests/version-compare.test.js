// SemVer-Vergleich (VersionCompare) – Update-System
"use strict";

const assert = require("assert");
const VersionCompare = require("../../electron/core/updates/VersionCompare");

console.log("==========================================");
console.log("🧪 Starte Versionsvergleich-Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

console.log("\n[1] Spezifikations-Tabelle");
const table = [
  ["1.0.7", "1.0.8-rc.1", true],
  ["1.0.8-rc.1", "1.0.8-rc.2", true],
  ["1.0.8-rc.1", "1.0.8", true],
  ["1.0.8-rc.2", "1.0.8-rc.1", false],
  ["1.0.8", "1.0.7", false],
  ["1.0.8", "1.0.8", false],
  ["1.0.8-beta.1", "1.0.8-rc.1", true],
  ["1.0.8-rc.1", "1.0.8-beta.1", false]
];

for (const [current, candidate, expected] of table) {
  test(`${current} -> ${candidate}: ${expected ? "Update" : "kein Update"}`, () => {
    assert.strictEqual(VersionCompare.isNewer(candidate, current), expected);
  });
}

console.log("\n[2] Pre-Release-Reihenfolge (SemVer)");
test("alpha < beta < rc < stable", () => {
  assert.strictEqual(VersionCompare.isNewer("1.0.8-beta.1", "1.0.8-alpha.9"), true);
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.1", "1.0.8-beta.9"), true);
  assert.strictEqual(VersionCompare.isNewer("1.0.8", "1.0.8-rc.9"), true);
});
test("numerische Identifier werden numerisch verglichen", () => {
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.10", "1.0.8-rc.2"), true);
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.2", "1.0.8-rc.10"), false);
});
test("alphanumerische Identifier sind groesser als numerische", () => {
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.1a", "1.0.8-rc.1"), true);
});
test("laengere Pre-Release-Kette gewinnt bei gleichem Praefix", () => {
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.1.1", "1.0.8-rc.1"), true);
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.1", "1.0.8-rc.1.1"), false);
});

console.log("\n[3] Build-Metadaten");
test("Build-Metadaten beeinflussen den Vergleich nicht", () => {
  assert.strictEqual(VersionCompare.compare("1.0.8+build.5", "1.0.8+build.9"), 0);
  assert.strictEqual(VersionCompare.isNewer("1.0.8+build.9", "1.0.8+build.1"), false);
  assert.strictEqual(VersionCompare.isNewer("1.0.9+build.1", "1.0.8+build.9"), true);
  assert.strictEqual(VersionCompare.isNewer("1.0.8-rc.1+build.2", "1.0.8-rc.1+build.1"), false);
});

console.log("\n[4] v-Praefix und Whitespace");
test("v-Praefix wird akzeptiert", () => {
  assert.strictEqual(VersionCompare.isNewer("v1.0.8", "1.0.7"), true);
  assert.strictEqual(VersionCompare.isNewer(" 1.0.8-rc.2 ", "v1.0.8-rc.1"), true);
});

console.log("\n[5] Ungueltige Versionen");
for (const invalid of [
  "", " ", "1.0", "1", "1.0.8.1", "1.0.8-", "1.0.8-rc..1",
  "1.0.8-rc.01", "abc", "1.0.8+", null, undefined, 108
]) {
  test(`ungueltig: ${JSON.stringify(invalid)}`, () => {
    assert.strictEqual(VersionCompare.isValid(invalid), false);
    assert.strictEqual(VersionCompare.compare("1.0.8", invalid), null);
    assert.strictEqual(VersionCompare.isNewer(invalid, "1.0.7"), false);
  });
}
test("fehlende installierte Version loest kein Update aus", () => {
  assert.strictEqual(VersionCompare.isNewer("1.0.8", null), false);
  assert.strictEqual(VersionCompare.isNewer("1.0.8", undefined), false);
});

console.log("\n[6] compare-Rueckgabewerte");
test("compare liefert -1/0/1", () => {
  assert.strictEqual(VersionCompare.compare("1.0.7", "1.0.8"), -1);
  assert.strictEqual(VersionCompare.compare("1.0.8", "1.0.8"), 0);
  assert.strictEqual(VersionCompare.compare("1.0.8", "1.0.7"), 1);
});
test("getPrereleaseStage liefert die Stage", () => {
  assert.strictEqual(VersionCompare.getPrereleaseStage("1.0.8-rc.1"), "rc");
  assert.strictEqual(VersionCompare.getPrereleaseStage("1.0.8-beta.2"), "beta");
  assert.strictEqual(VersionCompare.getPrereleaseStage("1.0.8"), null);
});

console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${passed} bestanden, ${failed} fehlgeschlagen`);
console.log("==========================================");

if (failed > 0) process.exit(1);
