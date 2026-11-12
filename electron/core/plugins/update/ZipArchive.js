"use strict";

/**
 * ZipArchive
 *
 * Minimaler, dependency-freier ZIP-Leser für Plugin-Pakete. Unterstützt
 * ausschließlich die Methoden „stored“ (0) und „deflate“ (8), verweigert
 * verschlüsselte Einträge, ZIP64 und Data-Descriptor-Einträge.
 *
 * Sicherheitsgarantien:
 *  - nur relative Pfade ohne Laufwerksbuchstaben, ohne `..`, ohne Backslash
 *  - keine Symlinks, keine Verzeichnis-Einträge mit Inhalt
 *  - Größenlimits pro Eintrag und gesamt
 *  - CRC32-Prüfung jedes Eintrags
 *  - Duplikate (auch nur in Groß-/Kleinschreibung unterschieden) werden
 *    abgelehnt, damit keine Datei eine andere überschreiben kann
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const DEFAULT_LIMITS = {
  maxEntries: 2000,
  maxEntrySize: 32 * 1024 * 1024,
  maxTotalSize: 64 * 1024 * 1024,
  maxNameLength: 255,
  maxDepth: 10
};

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw fail("invalid_archive", "ZIP-Zentralverzeichnis nicht gefunden.");
}

/**
 * Liest die Einträge des Zentralverzeichnisses.
 * @param {Buffer} buffer
 * @returns {Array<Object>}
 */
function readEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw fail("invalid_archive", "Datei ist kein gültiges ZIP-Archiv.");
  }
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);

  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw fail("zip64_unsupported", "ZIP64-Archive werden nicht unterstützt.");
  }
  if (directoryOffset + directorySize > buffer.length) {
    throw fail("invalid_archive", "Zentralverzeichnis liegt außerhalb der Datei.");
  }

  const entries = [];
  let pointer = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== CENTRAL_SIGNATURE) {
      throw fail("invalid_archive", "Zentralverzeichnis ist beschädigt.");
    }
    const flags = buffer.readUInt16LE(pointer + 8);
    const method = buffer.readUInt16LE(pointer + 10);
    const crc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const externalAttributes = buffer.readUInt32LE(pointer + 38);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);

    entries.push({
      name,
      flags,
      method,
      crc32: crc,
      compressedSize,
      uncompressedSize,
      externalAttributes,
      localOffset
    });

    pointer += 46 + nameLength + extraLength + commentLength;
  }

  if (pointer > directoryOffset + directorySize) {
    throw fail("invalid_archive", "Zentralverzeichnis ist inkonsistent.");
  }

  return entries;
}

function hasControlCharacter(value) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function isSymlink(entry) {
  const mode = (entry.externalAttributes >>> 16) & 0xffff;
  return (mode & 0o170000) === 0o120000;
}

/**
 * Validiert Eintragsnamen und -größen gegen feste Limits.
 */
function validateEntries(entries, limits = DEFAULT_LIMITS) {
  const errors = [];
  const seen = new Set();
  let total = 0;

  if (entries.length === 0) {
    errors.push({ code: "empty_archive", message: "Archiv enthält keine Dateien." });
  }
  if (entries.length > limits.maxEntries) {
    errors.push({ code: "too_many_entries", message: "Archiv enthält zu viele Dateien." });
  }

  for (const entry of entries) {
    const name = entry.name;
    if (typeof name !== "string" || name.length === 0 || name.length > limits.maxNameLength) {
      errors.push({ code: "invalid_entry_name", message: `Ungültiger Dateiname: ${String(name).slice(0, 80)}` });
      continue;
    }
    if (name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name) ||
        hasControlCharacter(name)) {
      errors.push({ code: "path_traversal", message: `Unsicherer Pfad: ${name}` });
      continue;
    }
    const segments = name.replace(/\/$/, "").split("/");
    if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) {
      errors.push({ code: "path_traversal", message: `Unsicherer Pfad: ${name}` });
      continue;
    }
    if (segments.length > limits.maxDepth) {
      errors.push({ code: "path_too_deep", message: `Pfad zu tief: ${name}` });
      continue;
    }
    const normalized = name.replace(/\/$/, "").toLowerCase();
    if (seen.has(normalized)) {
      errors.push({ code: "duplicate_entry", message: `Doppelter Eintrag: ${name}` });
      continue;
    }
    seen.add(normalized);

    if (entry.flags & 0x1) {
      errors.push({ code: "encrypted_entry", message: `Verschlüsselter Eintrag: ${name}` });
    }
    if (entry.method !== 0 && entry.method !== 8) {
      errors.push({ code: "unsupported_compression", message: `Nicht unterstützte Kompression: ${name}` });
    }
    if (!Number.isFinite(entry.uncompressedSize) || entry.uncompressedSize > limits.maxEntrySize) {
      errors.push({ code: "entry_too_large", message: `Eintrag zu groß: ${name}` });
    }
    if (!Number.isFinite(entry.compressedSize) || entry.compressedSize > limits.maxEntrySize) {
      errors.push({ code: "entry_too_large", message: `Eintrag zu groß: ${name}` });
    }
    if (isSymlink(entry)) {
      errors.push({ code: "symlink_entry", message: `Symlink im Archiv: ${name}` });
    }
    if (entry.uncompressedSize === 0xffffffff || entry.compressedSize === 0xffffffff) {
      errors.push({ code: "zip64_unsupported", message: `ZIP64-Eintrag: ${name}` });
    }
    total += entry.uncompressedSize;
  }

  if (total > limits.maxTotalSize) {
    errors.push({ code: "archive_too_large", message: "Archiv ist entpackt zu groß." });
  }

  return { valid: errors.length === 0, errors, totalUncompressedSize: total };
}

function readEntryData(buffer, entry) {
  if (entry.localOffset + 30 > buffer.length) {
    throw fail("invalid_archive", `Lokaler Header fehlt: ${entry.name}`);
  }
  if (buffer.readUInt32LE(entry.localOffset) !== LOCAL_SIGNATURE) {
    throw fail("invalid_archive", `Lokaler Header beschädigt: ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) {
    throw fail("invalid_archive", `Daten außerhalb der Datei: ${entry.name}`);
  }
  const raw = buffer.subarray(start, end);
  let data;
  if (entry.method === 0) {
    data = raw;
  } else {
    data = zlib.inflateRawSync(raw, { maxOutputLength: entry.uncompressedSize || 1 });
  }
  if (data.length !== entry.uncompressedSize) {
    throw fail("size_mismatch", `Entpackte Größe stimmt nicht: ${entry.name}`);
  }
  if (crc32(data) !== entry.crc32) {
    throw fail("crc_mismatch", `CRC32 stimmt nicht: ${entry.name}`);
  }
  return data;
}

/**
 * Entpackt ein Archiv in ein Zielverzeichnis. Jeder Zielpfad wird erneut
 * gegen das Zielverzeichnis geprüft (Defense in Depth).
 */
function extract(buffer, targetDirectory, limits = DEFAULT_LIMITS) {
  const entries = readEntries(buffer);
  const validation = validateEntries(entries, limits);
  if (!validation.valid) {
    const error = fail("invalid_archive", validation.errors.map((item) => item.message).join("; "));
    error.details = validation.errors;
    throw error;
  }

  const root = path.resolve(targetDirectory);
  fs.mkdirSync(root, { recursive: true });
  let files = 0;

  for (const entry of entries) {
    const isDirectory = entry.name.endsWith("/");
    const destination = path.resolve(root, entry.name.replace(/\/$/, ""));
    if (destination !== root && !destination.startsWith(root + path.sep)) {
      throw fail("path_traversal", `Zielpfad außerhalb des Installationsverzeichnisses: ${entry.name}`);
    }
    if (isDirectory) {
      fs.mkdirSync(destination, { recursive: true });
      continue;
    }
    const data = readEntryData(buffer, entry);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data, { mode: 0o644 });
    files += 1;
  }

  return { files, entries: entries.length, totalUncompressedSize: validation.totalUncompressedSize };
}

module.exports = {
  DEFAULT_LIMITS,
  crc32,
  readEntries,
  validateEntries,
  extract
};
