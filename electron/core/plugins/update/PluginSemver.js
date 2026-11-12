"use strict";

/**
 * PluginSemver
 *
 * Bewusst kleine, dependency-freie Semver-Implementierung für Plugin- und
 * Engine-Versionen. Unterstützt genau die Schreibweisen, die das Plugin-SDK
 * dokumentiert (`>=1.0.7`, `^1.2.0`, `~1.2.3`, exakte Versionen und
 * Leerzeichen-kombinierte Bereiche). Unbekannte Schreibweisen gelten als
 * ungültig und werden abgelehnt – es wird nichts geraten.
 */

const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const COMPARATOR_PATTERN = /^(\^|~|>=|<=|>|<|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;

/**
 * @param {string} version
 * @returns {{major:number,minor:number,patch:number,prerelease:string[],raw:string}|null}
 */
function parse(version) {
  if (typeof version !== "string") return null;
  const match = VERSION_PATTERN.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
    raw: version.trim()
  };
}

function isValid(version) {
  return parse(version) !== null;
}

function comparePrerelease(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  // Eine Version ohne Prerelease ist höher als eine mit.
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      const diff = Number(left) - Number(right);
      if (diff !== 0) return diff < 0 ? -1 : 1;
      continue;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/**
 * @returns {number} negativ, 0 oder positiv
 */
function compare(a, b) {
  const left = typeof a === "string" ? parse(a) : a;
  const right = typeof b === "string" ? parse(b) : b;
  if (!left || !right) throw new Error("Ungültige Version im Vergleich");
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  return comparePrerelease(left.prerelease, right.prerelease);
}

function isPrerelease(version) {
  const parsed = typeof version === "string" ? parse(version) : version;
  return Boolean(parsed && parsed.prerelease.length);
}

function bump(version, part) {
  const parsed = parse(version);
  if (!parsed) return null;
  if (part === "major") return `${parsed.major + 1}.0.0`;
  if (part === "minor") return `${parsed.major}.${parsed.minor + 1}.0`;
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

/**
 * Zerlegt einen Bereich in einzelne Vergleiche (UND-Verknüpfung).
 * @returns {Array<{operator:string,version:string}>|null}
 */
function parseRange(range) {
  if (typeof range !== "string") return null;
  const trimmed = range.trim();
  if (trimmed === "" || trimmed === "*") return [];
  const parts = trimmed.split(/\s+/);
  if (parts.length > 4) return null;
  const comparators = [];
  for (const part of parts) {
    const match = COMPARATOR_PATTERN.exec(part);
    if (!match) return null;
    const operator = match[1] || "=";
    const version = match[2];
    if (!isValid(version)) return null;
    comparators.push({ operator, version });
  }
  return comparators;
}

function isValidRange(range) {
  return parseRange(range) !== null;
}

function satisfiesComparator(version, comparator) {
  const { operator, version: target } = comparator;
  const cmp = compare(version, target);
  switch (operator) {
    case "=":
      return cmp === 0;
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case "^": {
      const base = parse(target);
      const value = parse(version);
      if (!base || !value) return false;
      const upper = base.major > 0
        ? `${base.major + 1}.0.0`
        : base.minor > 0
          ? `0.${base.minor + 1}.0`
          : `0.0.${base.patch + 1}`;
      return compare(value, base) >= 0 && compare(value, upper) < 0;
    }
    case "~": {
      const base = parse(target);
      const value = parse(version);
      if (!base || !value) return false;
      const upper = `${base.major}.${base.minor + 1}.0`;
      return compare(value, base) >= 0 && compare(value, upper) < 0;
    }
    default:
      return false;
  }
}

/**
 * Prüft, ob `version` den Bereich `range` erfüllt.
 * Ungültige Versionen oder Bereiche erfüllen nie einen Bereich.
 */
function satisfies(version, range) {
  if (!isValid(version)) return false;
  const comparators = parseRange(range);
  if (comparators === null) return false;
  if (comparators.length === 0) return true;
  return comparators.every((comparator) => satisfiesComparator(version, comparator));
}

module.exports = {
  parse,
  isValid,
  isValidRange,
  compare,
  isPrerelease,
  bump,
  satisfies
};
