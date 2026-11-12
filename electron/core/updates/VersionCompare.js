"use strict";

/**
 * VersionCompare.js
 *
 * Reiner SemVer-Vergleich für das Update-System.
 *
 * Regeln (SemVer 2.0.0):
 *   - major.minor.patch werden numerisch verglichen.
 *   - Ist eine Version Pre-Release und die andere nicht, ist die
 *     Pre-Release-Version kleiner (1.0.8-rc.1 < 1.0.8).
 *   - Pre-Release-Kennungen werden punktweise verglichen: numerische
 *     Identifier numerisch, alphanumerische lexikalisch (ASCII),
 *     numerische Identifier sind kleiner als alphanumerische.
 *   - Build-Metadaten (+…) werden ignoriert und beeinflussen den
 *     Vergleich nicht.
 *   - Optionales "v"-Präfix wird akzeptiert (Release-Tags).
 *
 * Ungültige Versionen liefern `null` (parse) bzw. `false` (isValid)
 * und dürfen niemals ein Update auslösen.
 */

const SEMVER_PATTERN =
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(version) {
    if (typeof version !== "string") return null;
    const raw = version.trim();
    if (!raw) return null;

    const match = SEMVER_PATTERN.exec(raw);
    if (!match) return null;

    const [, major, minor, patch, prerelease] = match;
    const identifiers = prerelease ? prerelease.split(".") : [];

    // Numerische Pre-Release-Identifier dürfen laut SemVer keine
    // führenden Nullen haben (z. B. "rc.01" ist ungültig).
    for (const identifier of identifiers) {
        if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0")) {
            return null;
        }
    }

    return {
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        prerelease: identifiers
    };
}

function isValid(version) {
    return parse(version) !== null;
}

function compareIdentifier(a, b) {
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);

    if (aNumeric && bNumeric) {
        const diff = Number(a) - Number(b);
        return diff < 0 ? -1 : diff > 0 ? 1 : 0;
    }
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

/**
 * Vergleicht zwei Versionen.
 *
 * @returns {-1|0|1|null} -1 wenn a < b, 0 bei Gleichheit, 1 wenn a > b,
 *                        null wenn eine Version ungültig ist.
 */
function compare(a, b) {
    const left = parse(a);
    const right = parse(b);
    if (!left || !right) return null;

    if (left.major !== right.major) return left.major < right.major ? -1 : 1;
    if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
    if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;

    // Keine Pre-Release-Kennung = höher als jede Pre-Release-Version.
    if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
    if (left.prerelease.length === 0) return 1;
    if (right.prerelease.length === 0) return -1;

    const length = Math.max(left.prerelease.length, right.prerelease.length);
    for (let index = 0; index < length; index += 1) {
        const aId = left.prerelease[index];
        const bId = right.prerelease[index];
        if (aId === undefined) return -1;
        if (bId === undefined) return 1;
        const diff = compareIdentifier(aId, bId);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * True, wenn `candidate` echt neuer als `current` ist.
 * Ungültige oder fehlende Versionen liefern immer false.
 */
function isNewer(candidate, current) {
    const result = compare(candidate, current);
    return result === 1;
}

/**
 * Liefert den Release-Stage-Namen einer Version oder null.
 * "1.0.8-rc.1" -> "rc", "1.0.8" -> null
 */
function getPrereleaseStage(version) {
    const parsed = parse(version);
    if (!parsed || parsed.prerelease.length === 0) return null;
    return parsed.prerelease[0].toLowerCase();
}

module.exports = {
    parse,
    isValid,
    compare,
    isNewer,
    getPrereleaseStage
};
