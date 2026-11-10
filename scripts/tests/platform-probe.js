"use strict";

/**
 * platform-probe.js
 *
 * Echter Plattform-Probe: führt SystemDetector und InstallationDetector
 * gegen das TATSÄCHLICHE Host-System aus (kein simuliertes Dateisystem).
 *
 * Wird in der CI auf Windows, Ubuntu und in einem Arch-Linux-Container
 * ausgeführt. Damit unterscheiden sich echte Plattformtests klar von
 * simulierten Unit-Tests.
 *
 * Exit-Code 1, wenn die Plattform nicht erkannt werden kann oder unter
 * Linux keine os-release-Daten gelesen werden.
 */

const os = require("os");
const path = require("path");

const SystemDetector = require("../../electron/core/platform/SystemDetector");
const InstallationDetector = require("../../electron/core/platform/InstallationDetector");

const app = {
    isPackaged: true,
    getPath: (key) => {
        if (key === "exe") return process.execPath;
        if (key === "userData") return path.join(os.homedir(), ".webradio-platform-probe");
        if (key === "temp") return os.tmpdir();
        return null;
    },
    getAppPath: () => path.dirname(process.execPath)
};

const system = SystemDetector.detect({
    app,
    processObj: process,
    platform: process.platform,
    arch: process.arch,
    versions: process.versions
});

const installation = InstallationDetector.detect({ system, app, processObj: process });

const report = {
    platform: process.platform,
    arch: process.arch,
    os: system.os,
    architecture: system.architecture,
    runtime: system.runtime,
    distribution: system.linux ? system.linux.distribution : null,
    installation: {
        kind: installation.kind,
        format: installation.format,
        source: installation.source,
        status: installation.status,
        installPath: installation.paths.installPath,
        permissions: installation.permissions
    }
};

console.log("=== Platform Probe ===");
console.log(JSON.stringify(report, null, 2));

let exitCode = 0;

if (system.os.name === "unknown") {
    console.error("❌ Betriebssystem wurde nicht erkannt");
    exitCode = 1;
}

if (system.architecture.system === "unknown") {
    console.error("❌ Systemarchitektur wurde nicht erkannt");
    exitCode = 1;
}

if (system.os.name === "linux") {
    if (!system.linux || !system.linux.osReleasePath) {
        console.error("❌ /etc/os-release konnte auf diesem Linux-System nicht gelesen werden");
        exitCode = 1;
    } else if (!system.linux.distribution.id) {
        console.error("❌ Distributions-ID fehlt in /etc/os-release");
        exitCode = 1;
    } else {
        console.log(`✅ Linux-Distribution erkannt: ${system.linux.distribution.id} (Familie: ${system.linux.distribution.family})`);
    }
}

if (installation.kind === "unknown") {
    console.warn("⚠️  Installationsart konnte auf diesem Host nicht bestimmt werden (informativ für die Probe).");
}

if (exitCode === 0) {
    console.log("✅ Plattform-Probe erfolgreich");
}

process.exit(exitCode);
