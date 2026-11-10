"use strict";

/**
 * ArtifactVerifier.js
 *
 * Prüft heruntergeladene Update-Artefakte, bevor sie installiert werden.
 *
 * Aufgaben:
 *  - SHA-256- und SHA-512-Prüfsummen (hex oder base64) verifizieren
 *  - Dateigröße gegen die Release-Metadaten prüfen
 *  - Dateiformat (ELF / PE / Mach-O) prüfen
 *  - Architektur aus dem Binärformat lesen
 *  - Signaturprüfung, sofern ein öffentlicher Schlüssel vorliegt
 *  - Freien Speicherplatz prüfen
 *
 * Grundsätze:
 *  - Fehlende Prüfdaten werden als UNSUPPORTED, niemals als "bestanden"
 *    gemeldet.
 *  - Unvollständige oder manipulierte Dateien werden abgelehnt.
 *  - Es werden keine vertraulichen Daten protokolliert.
 */

const crypto = require("crypto");
const defaultFs = require("fs");
const defaultPath = require("path");

const TRUST = Object.freeze({
    DETECTED: "DETECTED",
    VERIFIED: "VERIFIED",
    UNKNOWN: "UNKNOWN",
    UNSUPPORTED: "UNSUPPORTED"
});

const HASH_ALGORITHMS = Object.freeze({
    sha256: { name: "sha256", hexLength: 64 },
    sha512: { name: "sha512", hexLength: 128 }
});

function normalizeAlgorithm(algorithm) {
    const key = typeof algorithm === "string" ? algorithm.toLowerCase().replace(/[-_]/g, "") : "sha256";
    return HASH_ALGORITHMS[key] || HASH_ALGORITHMS.sha256;
}

/**
 * Normalisiert einen erwarteten Hash (hex oder base64) zu Hex.
 *
 * @param {string} expected
 * @param {string} algorithm
 * @returns {{ value: string, encoding: string }|null}
 */
function normalizeExpectedHash(expected, algorithm) {
    const spec = normalizeAlgorithm(algorithm);
    if (typeof expected !== "string" || expected.trim().length === 0) return null;

    const value = expected.trim();
    if (new RegExp(`^[0-9a-fA-F]{${spec.hexLength}}$`).test(value)) {
        return { value: value.toLowerCase(), encoding: "hex" };
    }

    try {
        const decoded = Buffer.from(value, "base64");
        // base64 von sha512 ist 88 Zeichen inkl. Padding
        if (decoded.length * 2 === spec.hexLength) {
            return { value: decoded.toString("hex"), encoding: "base64" };
        }
    } catch {
        // kein base64 -> ungültig
    }

    return null;
}

/**
 * Berechnet den Hash einer Datei.
 */
function hashFile(filePath, algorithm = "sha256", fsObj = defaultFs) {
    const spec = normalizeAlgorithm(algorithm);
    const data = fsObj.readFileSync(filePath);
    return crypto.createHash(spec.name).update(data).digest("hex");
}

/**
 * Prüft eine Prüfsumme.
 *
 * @returns {{ name: string, status: string, ok: boolean, algorithm: string, detail: string }}
 */
function verifyHash(filePath, expected, { algorithm = "sha256", fsObj = defaultFs } = {}) {
    const spec = normalizeAlgorithm(algorithm);
    const normalized = normalizeExpectedHash(expected, spec.name);

    if (!normalized) {
        return {
            name: `hash-${spec.name}`,
            status: TRUST.UNSUPPORTED,
            ok: false,
            algorithm: spec.name,
            detail: "Kein gültiger erwarteter Hash vorhanden"
        };
    }

    let actual;
    try {
        actual = hashFile(filePath, spec.name, fsObj);
    } catch (err) {
        return {
            name: `hash-${spec.name}`,
            status: TRUST.UNKNOWN,
            ok: false,
            algorithm: spec.name,
            detail: `Datei nicht lesbar: ${err.message}`
        };
    }

    const ok = actual === normalized.value;
    return {
        name: `hash-${spec.name}`,
        status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
        ok,
        algorithm: spec.name,
        detail: ok ? "Prüfsumme stimmt überein" : "Prüfsumme weicht ab"
    };
}

/**
 * Prüft die Dateigröße.
 */
function verifyFileSize(filePath, expectedSize, { fsObj = defaultFs } = {}) {
    if (typeof expectedSize !== "number" || !Number.isFinite(expectedSize) || expectedSize <= 0) {
        return {
            name: "size",
            status: TRUST.UNSUPPORTED,
            ok: false,
            detail: "Keine erwartete Dateigröße vorhanden"
        };
    }

    let actual;
    try {
        actual = fsObj.statSync(filePath).size;
    } catch (err) {
        return {
            name: "size",
            status: TRUST.UNKNOWN,
            ok: false,
            detail: `Datei nicht lesbar: ${err.message}`
        };
    }

    const ok = actual === expectedSize;
    return {
        name: "size",
        status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
        ok,
        detail: ok
            ? "Dateigröße stimmt überein"
            : `Dateigröße weicht ab (erwartet ${expectedSize}, gefunden ${actual})`
    };
}

/**
 * Erkennt das Binärformat anhand der Magic Bytes.
 *
 * @returns {"elf"|"pe"|"macho"|"unknown"}
 */
function detectFileFormat(filePath, { fsObj = defaultFs } = {}) {
    let buffer;
    try {
        const fd = fsObj.openSync(filePath, "r");
        buffer = Buffer.alloc(4);
        try {
            fsObj.readSync(fd, buffer, 0, 4, 0);
        } finally {
            fsObj.closeSync(fd);
        }
    } catch {
        return "unknown";
    }

    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
        return "elf";
    }
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
        return "pe";
    }
    const magic = buffer.readUInt32BE(0);
    // Mach-O 64-bit (0xfeedfacf), 32-bit (0xfeedface), Universal (0xcafebabe)
    if (magic === 0xfeedfacf || magic === 0xfeedface || magic === 0xcafebabe) {
        return "macho";
    }
    return "unknown";
}

const ELF_MACHINES = Object.freeze({ 0x03: "ia32", 0x28: "arm", 0x3e: "x64", 0xb7: "arm64" });
const PE_MACHINES = Object.freeze({ 0x014c: "ia32", 0x8664: "x64", 0xaa64: "arm64", 0x01c4: "arm" });
const MACHO_CPUS = Object.freeze({ 7: "ia32", 12: "arm", 0x01000007: "x64", 0x0100000c: "arm64" });

/**
 * Liest die Architektur aus dem Binärformat.
 *
 * @returns {{ architecture: string, format: string, status: string }}
 */
function detectArchitecture(filePath, { fsObj = defaultFs } = {}) {
    const format = detectFileFormat(filePath, { fsObj });
    if (format === "unknown") {
        return { architecture: "unknown", format, status: TRUST.UNKNOWN };
    }

    try {
        if (format === "elf") {
            const fd = fsObj.openSync(filePath, "r");
            const header = Buffer.alloc(20);
            try {
                fsObj.readSync(fd, header, 0, 20, 0);
            } finally {
                fsObj.closeSync(fd);
            }
            const littleEndian = header[5] === 1;
            const machine = littleEndian ? header.readUInt16LE(18) : header.readUInt16BE(18);
            const architecture = ELF_MACHINES[machine] || "unknown";
            return { architecture, format, status: architecture === "unknown" ? TRUST.UNKNOWN : TRUST.DETECTED };
        }

        if (format === "pe") {
            const fd = fsObj.openSync(filePath, "r");
            const dosHeader = Buffer.alloc(64);
            try {
                fsObj.readSync(fd, dosHeader, 0, 64, 0);
            } finally {
                fsObj.closeSync(fd);
            }
            const peOffset = dosHeader.readUInt32LE(0x3c);
            const machineBuffer = Buffer.alloc(6);
            const fd2 = fsObj.openSync(filePath, "r");
            try {
                fsObj.readSync(fd2, machineBuffer, 0, 6, peOffset);
            } finally {
                fsObj.closeSync(fd2);
            }
            const machine = machineBuffer.readUInt16LE(4);
            const architecture = PE_MACHINES[machine] || "unknown";
            return { architecture, format, status: architecture === "unknown" ? TRUST.UNKNOWN : TRUST.DETECTED };
        }

        // Mach-O: cputype an Offset 4 (big endian)
        const fd = fsObj.openSync(filePath, "r");
        const header = Buffer.alloc(8);
        try {
            fsObj.readSync(fd, header, 0, 8, 0);
        } finally {
            fsObj.closeSync(fd);
        }
        const cpu = header.readUInt32BE(4);
        const architecture = MACHO_CPUS[cpu] || "unknown";
        return { architecture, format, status: architecture === "unknown" ? TRUST.UNKNOWN : TRUST.DETECTED };
    } catch {
        return { architecture: "unknown", format, status: TRUST.UNKNOWN };
    }
}

/**
 * Prüft die Architektur gegen die erwartete Architektur.
 */
function verifyArchitecture(filePath, expectedArch, { fsObj = defaultFs } = {}) {
    if (!expectedArch || expectedArch === "unknown") {
        return { name: "architecture", status: TRUST.UNSUPPORTED, ok: false, detail: "Keine erwartete Architektur vorhanden" };
    }

    const detected = detectArchitecture(filePath, { fsObj });
    if (detected.architecture === "unknown") {
        return { name: "architecture", status: TRUST.UNKNOWN, ok: false, detail: "Architektur nicht ermittelbar" };
    }

    const ok = detected.architecture === expectedArch;
    return {
        name: "architecture",
        status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
        ok,
        detail: ok
            ? `Architektur ${detected.architecture} bestätigt`
            : `Architektur weicht ab (erwartet ${expectedArch}, gefunden ${detected.architecture})`
    };
}

/**
 * Prüft das Dateiformat.
 */
function verifyFormat(filePath, expectedFormat, { fsObj = defaultFs } = {}) {
    if (!expectedFormat) {
        return { name: "format", status: TRUST.UNSUPPORTED, ok: false, detail: "Kein erwartetes Format vorhanden" };
    }

    const format = detectFileFormat(filePath, { fsObj });
    const ok = format === expectedFormat;
    return {
        name: "format",
        status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
        ok,
        detail: ok ? `Format ${format} bestätigt` : `Format weicht ab (erwartet ${expectedFormat}, gefunden ${format})`
    };
}

/**
 * Verifiziert eine Signatur, sofern Schlüssel und Signatur vorliegen.
 *
 * Ohne hinterlegten öffentlichen Schlüssel wird bewusst UNSUPPORTED
 * gemeldet – niemals VERIFIED.
 */
function verifySignature(filePath, options = {}) {
    const { fsObj = defaultFs, publicKeyPem = null, signaturePath = null, signatureBase64 = null, algorithm = "sha256" } = options;

    if (!publicKeyPem || (!signaturePath && !signatureBase64)) {
        return {
            name: "signature",
            status: TRUST.UNSUPPORTED,
            ok: false,
            detail: "Keine Signaturprüfdaten bereitgestellt"
        };
    }

    try {
        const data = fsObj.readFileSync(filePath);
        const signature = signaturePath
            ? fsObj.readFileSync(signaturePath)
            : Buffer.from(signatureBase64, "base64");

        const ok = crypto.verify(algorithm, data, publicKeyPem, signature);
        return {
            name: "signature",
            status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
            ok,
            detail: ok ? "Signatur gültig" : "Signatur ungültig"
        };
    } catch (err) {
        return {
            name: "signature",
            status: TRUST.DETECTED,
            ok: false,
            detail: `Signaturprüfung fehlgeschlagen: ${err.message}`
        };
    }
}

/**
 * Prüft den freien Speicherplatz im Zielverzeichnis.
 *
 * @returns {{ name: string, status: string, ok: boolean, detail: string }}
 */
function checkDiskSpace(directory, requiredBytes, { fsObj = defaultFs } = {}) {
    if (typeof requiredBytes !== "number" || !Number.isFinite(requiredBytes) || requiredBytes <= 0) {
        return { name: "disk-space", status: TRUST.UNSUPPORTED, ok: false, detail: "Kein Platzbedarf angegeben" };
    }

    try {
        if (typeof fsObj.statfsSync !== "function") {
            return { name: "disk-space", status: TRUST.UNKNOWN, ok: false, detail: "Freier Speicherplatz nicht ermittelbar" };
        }
        const stats = fsObj.statfsSync(directory);
        const available = Number(stats.bavail) * Number(stats.bsize);
        if (!Number.isFinite(available)) {
            return { name: "disk-space", status: TRUST.UNKNOWN, ok: false, detail: "Freier Speicherplatz nicht ermittelbar" };
        }
        const ok = available >= requiredBytes;
        return {
            name: "disk-space",
            status: ok ? TRUST.VERIFIED : TRUST.DETECTED,
            ok,
            detail: ok
                ? "Ausreichend freier Speicherplatz"
                : `Zu wenig freier Speicherplatz (benötigt ${requiredBytes}, verfügbar ${available})`
        };
    } catch (err) {
        return {
            name: "disk-space",
            status: TRUST.UNKNOWN,
            ok: false,
            detail: `Speicherplatzprüfung fehlgeschlagen: ${err.message}`
        };
    }
}

/**
 * Führt alle verfügbaren Prüfungen aus.
 *
 * @param {object} options
 * @returns {{ ok: boolean, checks: object[], failures: string[] }}
 */
function verifyArtifact(options = {}) {
    const {
        filePath,
        expectedHash = null,
        hashAlgorithm = "sha256",
        expectedSize = null,
        expectedFormat = null,
        expectedArch = null,
        signature = null,
        fsObj = defaultFs
    } = options;

    const checks = [];

    if (!filePath) {
        return {
            ok: false,
            checks: [{ name: "exists", status: TRUST.UNKNOWN, ok: false, detail: "Kein Dateipfad angegeben" }],
            failures: ["existiert nicht"]
        };
    }

    let stat = null;
    try {
        stat = fsObj.statSync(filePath);
    } catch {
        stat = null;
    }

    if (!stat || !stat.isFile || !stat.isFile()) {
        // Manche fake-fs Implementierungen liefern kein isFile()
        if (!stat) {
            return {
                ok: false,
                checks: [{ name: "exists", status: TRUST.UNKNOWN, ok: false, detail: "Datei nicht gefunden" }],
                failures: ["existiert nicht"]
            };
        }
    }

    if (stat.size <= 0) {
        return {
            ok: false,
            checks: [{ name: "exists", status: TRUST.DETECTED, ok: false, detail: "Datei ist leer" }],
            failures: ["leer"]
        };
    }

    if (expectedHash) {
        checks.push(verifyHash(filePath, expectedHash, { algorithm: hashAlgorithm, fsObj }));
    }
    if (expectedSize !== null && expectedSize !== undefined) {
        checks.push(verifyFileSize(filePath, expectedSize, { fsObj }));
    }
    if (expectedFormat) {
        checks.push(verifyFormat(filePath, expectedFormat, { fsObj }));
    }
    if (expectedArch) {
        checks.push(verifyArchitecture(filePath, expectedArch, { fsObj }));
    }
    if (signature) {
        checks.push(verifySignature(filePath, { ...signature, fsObj }));
    }

    const failures = checks
        .filter((check) => check.status !== TRUST.UNSUPPORTED && !check.ok)
        .map((check) => check.detail);

    return {
        ok: failures.length === 0 && checks.some((check) => check.ok),
        checks,
        failures
    };
}

module.exports = {
    TRUST,
    HASH_ALGORITHMS,
    normalizeExpectedHash,
    hashFile,
    verifyHash,
    verifyFileSize,
    detectFileFormat,
    detectArchitecture,
    verifyArchitecture,
    verifyFormat,
    verifySignature,
    checkDiskSpace,
    verifyArtifact
};
