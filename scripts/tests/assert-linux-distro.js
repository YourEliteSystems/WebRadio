"use strict";

/**
 * assert-linux-distro.js
 *
 * Echter Plattform-Integrationstest: prüft auf dem laufenden Host, dass
 * die erwartete Linux-Distributionsfamilie und der erwartete Paketmanager
 * erkannt werden.
 *
 * Verwendung:
 *   node scripts/tests/assert-linux-distro.js <familie> [paketmanager]
 *
 * Beispiel (CI):
 *   node scripts/tests/assert-linux-distro.js debian apt
 *   node scripts/tests/assert-linux-distro.js arch pacman
 */

const SystemDetector = require("../../electron/core/platform/SystemDetector");

const expectedFamily = process.argv[2] || null;
const expectedPackageManager = process.argv[3] || null;

if (!expectedFamily) {
    console.error("Aufruf: node scripts/tests/assert-linux-distro.js <familie> [paketmanager]");
    process.exit(2);
}

const info = SystemDetector.detect({
    processObj: process,
    platform: process.platform,
    arch: process.arch,
    versions: process.versions
});

if (info.os.name !== "linux") {
    console.error(`❌ Erwartet Linux, erkannt: ${info.os.name}`);
    process.exit(1);
}

if (!info.linux || !info.linux.osReleasePath) {
    console.error("❌ /etc/os-release wurde nicht gelesen");
    process.exit(1);
}

const distro = info.linux.distribution;
console.log("Erkannte Distribution:", JSON.stringify(distro, null, 2));

let exitCode = 0;

if (distro.family !== expectedFamily) {
    console.error(`❌ Familie: erwartet "${expectedFamily}", erkannt "${distro.family}"`);
    exitCode = 1;
}

if (expectedPackageManager && distro.packageManager !== expectedPackageManager) {
    console.error(`❌ Paketmanager: erwartet "${expectedPackageManager}", erkannt "${distro.packageManager}"`);
    exitCode = 1;
}

if (exitCode === 0) {
    console.log(`✅ Distribution korrekt erkannt (${distro.id}, Familie ${distro.family}, Paketmanager ${distro.packageManager})`);
}

process.exit(exitCode);
