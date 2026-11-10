"use strict";

/**
 * update-security.test.js
 *
 * Unit-Tests für die Artefaktprüfung und das Backup-/Rollback-Verhalten.
 *
 * Geprüft werden:
 *  - SHA-256 / SHA-512 (hex und base64)
 *  - Dateigröße / unvollständige Downloads
 *  - Dateiformat und Architektur
 *  - Signaturprüfung
 *  - freier Speicherplatz
 *  - Integritätsprüfung vor der Installation
 *  - Backup bleibt erhalten, bis die Installation bestätigt ist
 */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ArtifactVerifier = require("../../electron/core/updates/verification/ArtifactVerifier");
const LinuxAppImageInstaller = require("../../electron/core/updates/providers/LinuxAppImageInstaller");

console.log("==========================================");
console.log("Update-Sicherheits- und Integritätstests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}: ${err.message}`);
        failed++;
    }
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "webradio-security-test-"));

function writeTemp(name, content) {
    const filePath = path.join(tmpRoot, name);
    fs.writeFileSync(filePath, content);
    return filePath;
}

/**
 * Erzeugt eine minimale ELF-Datei mit gesetzter e_machine.
 */
function createElf(filePath, { machine = 0x3e, size = 2048 } = {}) {
    const buffer = Buffer.alloc(size, 0);
    buffer[0] = 0x7f;
    buffer[1] = 0x45;
    buffer[2] = 0x4c;
    buffer[3] = 0x46;
    buffer[4] = 2;    // 64-bit
    buffer[5] = 1;    // little endian
    buffer.writeUInt16LE(machine, 18);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

function createPe(filePath, { machine = 0x8664, size = 2048 } = {}) {
    const buffer = Buffer.alloc(size, 0);
    buffer[0] = 0x4d; // M
    buffer[1] = 0x5a; // Z
    buffer.writeUInt32LE(0x40, 0x3c);
    buffer.write("PE\u0000\u0000", 0x40, "latin1");
    buffer.writeUInt16LE(machine, 0x44);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

// ─────────────────────────────────────────────────────────────
console.log("\n[1] Hash-Normalisierung");

test("SHA-256 als Hex wird akzeptiert", () => {
    const normalized = ArtifactVerifier.normalizeExpectedHash("a".repeat(64), "sha256");
    assert.ok(normalized);
    assert.strictEqual(normalized.encoding, "hex");
});

test("SHA-512 als base64 wird akzeptiert", () => {
    const digest = Buffer.alloc(64, 7).toString("base64");
    const normalized = ArtifactVerifier.normalizeExpectedHash(digest, "sha512");
    assert.ok(normalized);
    assert.strictEqual(normalized.encoding, "base64");
    assert.strictEqual(normalized.value.length, 128);
});

test("ungültige Hash-Länge wird abgelehnt", () => {
    assert.strictEqual(ArtifactVerifier.normalizeExpectedHash("abc", "sha256"), null);
    assert.strictEqual(ArtifactVerifier.normalizeExpectedHash("", "sha256"), null);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[2] Prüfsummen und Größe");

const samplePath = writeTemp("sample.bin", "webradio-artifact");
const sampleSha256 = crypto.createHash("sha256").update(fs.readFileSync(samplePath)).digest("hex");
const sampleSha512 = crypto.createHash("sha512").update(fs.readFileSync(samplePath)).digest("base64");

test("korrekte SHA-256 wird bestätigt", () => {
    const check = ArtifactVerifier.verifyHash(samplePath, sampleSha256, { algorithm: "sha256" });
    assert.strictEqual(check.ok, true);
    assert.strictEqual(check.status, ArtifactVerifier.TRUST.VERIFIED);
});

test("korrekte SHA-512 (base64) wird bestätigt", () => {
    const check = ArtifactVerifier.verifyHash(samplePath, sampleSha512, { algorithm: "sha512" });
    assert.strictEqual(check.ok, true);
});

test("manipulierte Datei wird abgelehnt", () => {
    const tampered = writeTemp("tampered.bin", "webradio-artifact-manipulated");
    const check = ArtifactVerifier.verifyHash(tampered, sampleSha256, { algorithm: "sha256" });
    assert.strictEqual(check.ok, false);
});

test("fehlender Hash ist UNSUPPORTED, nicht bestanden", () => {
    const check = ArtifactVerifier.verifyHash(samplePath, null);
    assert.strictEqual(check.status, ArtifactVerifier.TRUST.UNSUPPORTED);
    assert.strictEqual(check.ok, false);
});

test("Größenprüfung erkennt unvollständige Downloads", () => {
    const truncated = writeTemp("truncated.bin", "abc");
    const check = ArtifactVerifier.verifyFileSize(truncated, 4096);
    assert.strictEqual(check.ok, false);
    assert.ok(/weicht ab/.test(check.detail));
});

test("korrekte Größe wird bestätigt", () => {
    const check = ArtifactVerifier.verifyFileSize(samplePath, fs.statSync(samplePath).size);
    assert.strictEqual(check.ok, true);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[3] Format und Architektur");

test("ELF wird erkannt", () => {
    const elf = createElf(path.join(tmpRoot, "format.elf"));
    assert.strictEqual(ArtifactVerifier.detectFileFormat(elf), "elf");
});

test("PE wird erkannt", () => {
    const pe = createPe(path.join(tmpRoot, "format.exe"));
    assert.strictEqual(ArtifactVerifier.detectFileFormat(pe), "pe");
});

test("unbekanntes Format wird als unknown gemeldet", () => {
    const txt = writeTemp("format.txt", "kein binaerformat");
    assert.strictEqual(ArtifactVerifier.detectFileFormat(txt), "unknown");
});

test("ELF x64-Architektur wird gelesen", () => {
    const elf = createElf(path.join(tmpRoot, "arch-x64.elf"), { machine: 0x3e });
    const detected = ArtifactVerifier.detectArchitecture(elf);
    assert.strictEqual(detected.architecture, "x64");
    assert.strictEqual(detected.format, "elf");
});

test("ELF arm64-Architektur wird gelesen", () => {
    const elf = createElf(path.join(tmpRoot, "arch-arm64.elf"), { machine: 0xb7 });
    assert.strictEqual(ArtifactVerifier.detectArchitecture(elf).architecture, "arm64");
});

test("PE x64-Architektur wird gelesen", () => {
    const pe = createPe(path.join(tmpRoot, "arch-x64.exe"), { machine: 0x8664 });
    const detected = ArtifactVerifier.detectArchitecture(pe);
    assert.strictEqual(detected.architecture, "x64");
});

test("falsche Architektur wird abgelehnt", () => {
    const elf = createElf(path.join(tmpRoot, "arch-mismatch.elf"), { machine: 0x3e });
    const check = ArtifactVerifier.verifyArchitecture(elf, "arm64");
    assert.strictEqual(check.ok, false);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[4] Signaturprüfung");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const signedPath = writeTemp("signed.bin", "signierter-inhalt");
const signatureBase64 = crypto.sign("sha256", fs.readFileSync(signedPath), privateKey).toString("base64");

test("gültige Signatur wird bestätigt", () => {
    const check = ArtifactVerifier.verifySignature(signedPath, { publicKeyPem, signatureBase64 });
    assert.strictEqual(check.ok, true);
    assert.strictEqual(check.status, ArtifactVerifier.TRUST.VERIFIED);
});

test("ungültige Signatur wird abgelehnt", () => {
    const otherPath = writeTemp("other.bin", "anderer-inhalt");
    const check = ArtifactVerifier.verifySignature(otherPath, { publicKeyPem, signatureBase64 });
    assert.strictEqual(check.ok, false);
});

test("ohne Schlüssel ist die Signaturprüfung UNSUPPORTED", () => {
    const check = ArtifactVerifier.verifySignature(signedPath, {});
    assert.strictEqual(check.status, ArtifactVerifier.TRUST.UNSUPPORTED);
    assert.strictEqual(check.ok, false);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[5] Speicherplatz und Gesamtprüfung");

test("ausreichender Speicherplatz wird bestätigt", () => {
    const fakeFs = { statfsSync: () => ({ bavail: 100000, bsize: 4096 }) };
    const check = ArtifactVerifier.checkDiskSpace(tmpRoot, 1024 * 1024, { fsObj: fakeFs });
    assert.strictEqual(check.ok, true);
});

test("zu wenig Speicherplatz wird erkannt", () => {
    const fakeFs = { statfsSync: () => ({ bavail: 1, bsize: 4096 }) };
    const check = ArtifactVerifier.checkDiskSpace(tmpRoot, 1024 * 1024 * 1024, { fsObj: fakeFs });
    assert.strictEqual(check.ok, false);
});

test("vollständig gültiges Artefakt besteht die Gesamtprüfung", () => {
    const elf = createElf(path.join(tmpRoot, "valid.AppImage"), { machine: 0x3e });
    const hash = crypto.createHash("sha256").update(fs.readFileSync(elf)).digest("hex");
    const size = fs.statSync(elf).size;

    const result = ArtifactVerifier.verifyArtifact({
        filePath: elf,
        expectedHash: hash,
        hashAlgorithm: "sha256",
        expectedSize: size,
        expectedFormat: "elf",
        expectedArch: "x64"
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.failures, []);
});

test("manipuliertes Artefakt wird abgelehnt", () => {
    const elf = createElf(path.join(tmpRoot, "invalid.AppImage"), { machine: 0x3e });
    const result = ArtifactVerifier.verifyArtifact({
        filePath: elf,
        expectedHash: "0".repeat(64),
        hashAlgorithm: "sha256"
    });

    assert.strictEqual(result.ok, false);
    assert.ok(result.failures.length > 0);
});

test("fehlende Datei wird abgelehnt", () => {
    const result = ArtifactVerifier.verifyArtifact({ filePath: path.join(tmpRoot, "does-not-exist.bin") });
    assert.strictEqual(result.ok, false);
});

// ─────────────────────────────────────────────────────────────
console.log("\n[6] Installer: Integrität, Backup und Bestätigung");

test("verifyIntegrity lehnt falsche SHA-512 ab", () => {
    const elf = createElf(path.join(tmpRoot, "integrity.AppImage"));
    assert.throws(() => {
        LinuxAppImageInstaller.verifyIntegrity(elf, { expectedSha512: "A".repeat(86) + "==" });
    }, /Integritätsprüfung fehlgeschlagen/);
});

test("verifyIntegrity akzeptiert korrekte SHA-512", () => {
    const elf = createElf(path.join(tmpRoot, "integrity-ok.AppImage"));
    const sha512 = crypto.createHash("sha512").update(fs.readFileSync(elf)).digest("base64");
    const result = LinuxAppImageInstaller.verifyIntegrity(elf, { expectedSha512: sha512 });
    assert.strictEqual(result.ok, true);
});

test("Backup bleibt nach erfolgreichem Austausch erhalten und wird erst nach Bestätigung freigegeben", () => {
    const currentApp = path.join(tmpRoot, "backup-current.AppImage");
    const downloadedUpdate = path.join(tmpRoot, "backup-download.AppImage");
    createElf(currentApp, { size: 2048 });
    createElf(downloadedUpdate, { size: 4096 });

    const result = LinuxAppImageInstaller.applyUpdate({
        currentAppPath: currentApp,
        downloadedUpdatePath: downloadedUpdate,
        fsObj: fs
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.backupPath, "Backup-Pfad wird zurückgegeben");
    assert.strictEqual(fs.existsSync(result.backupPath), true, "Backup muss erhalten bleiben");
    assert.strictEqual(fs.existsSync(currentApp), true, "Neue Version liegt am Ziel");

    const confirmation = LinuxAppImageInstaller.confirmHealthyInstall({
        currentAppPath: currentApp,
        fsObj: fs
    });

    assert.ok(Array.isArray(confirmation.removed));
    assert.strictEqual(fs.existsSync(result.backupPath), false, "Bestätigtes Backup wird freigegeben");
});

test("Sicherung wird nicht gelöscht, nur weil am Ziel eine Datei existiert", () => {
    const currentApp = path.join(tmpRoot, "keep-current.AppImage");
    const downloadedUpdate = path.join(tmpRoot, "keep-download.AppImage");
    const orphanBackup = path.join(tmpRoot, ".webradio-update-keepme.bak");

    createElf(currentApp, { size: 2048 });
    createElf(downloadedUpdate, { size: 4096 });
    createElf(orphanBackup, { size: 2048 });

    LinuxAppImageInstaller.applyUpdate({
        currentAppPath: currentApp,
        downloadedUpdatePath: downloadedUpdate,
        fsObj: fs
    });

    assert.strictEqual(
        fs.existsSync(orphanBackup),
        true,
        "Backup darf nicht allein wegen eines vorhandenen Ziels entfernt werden"
    );

    try { fs.unlinkSync(orphanBackup); } catch { /* ignore */ }
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }

if (failed > 0) {
    process.exit(1);
}
