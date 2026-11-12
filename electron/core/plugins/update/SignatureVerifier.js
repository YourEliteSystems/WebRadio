"use strict";

/**
 * SignatureVerifier
 *
 * Ed25519-Signaturprüfung für Plugin-Update-Manifeste. Signiert wird die
 * kanonische JSON-Darstellung des Manifests ohne das Feld `signature`.
 *
 * Vertrauensbasis: eine lokale Liste öffentlicher Schlüssel
 * (`trusted-keys.json`) mit `keyId`, `algorithm` und `publicKey` (Base64,
 * DER/SPKI). Private Schlüssel existieren ausschließlich beim Herausgeber und
 * niemals in der Anwendung oder im Repository.
 */

const crypto = require("crypto");
const fs = require("fs");

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

/**
 * Erzeugt die zu signierende Nutzlast (Manifest ohne `signature`).
 */
function buildPayload(manifest) {
  const copy = { ...manifest };
  delete copy.signature;
  return Buffer.from(canonicalize(copy), "utf8");
}

/**
 * @param {Object} manifest
 * @param {{keys?:Array<{keyId:string,algorithm?:string,publicKey:string}>, allowUnsigned?:boolean}} options
 * @returns {{status:"valid"|"unsigned"|"invalid"|"unknown_key"|"malformed", keyId:string|null, message:string}}
 */
function verifyManifest(manifest, options = {}) {
  const signature = manifest && manifest.signature;
  if (!signature || signature.algorithm === undefined && signature.value === undefined) {
    return {
      status: options.allowUnsigned ? "unsigned_allowed" : "unsigned",
      keyId: null,
      message: "Manifest ist nicht signiert."
    };
  }
  if (signature.algorithm !== "ed25519" || typeof signature.value !== "string" ||
      typeof signature.keyId !== "string") {
    return { status: "malformed", keyId: signature.keyId || null, message: "Signaturblock ist unvollständig." };
  }

  const keys = Array.isArray(options.keys) ? options.keys : [];
  const entry = keys.find((key) => key && key.keyId === signature.keyId);
  if (!entry || typeof entry.publicKey !== "string") {
    return { status: "unknown_key", keyId: signature.keyId, message: "Unbekannter Signaturschlüssel." };
  }
  if (entry.algorithm && entry.algorithm !== "ed25519") {
    return { status: "unknown_key", keyId: signature.keyId, message: "Schlüsselalgorithmus wird nicht unterstützt." };
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(entry.publicKey, "base64"),
      format: "der",
      type: "spki"
    });
    const signatureBuffer = Buffer.from(signature.value, "base64");
    const payload = buildPayload(manifest);
    const valid = crypto.verify(null, payload, publicKey, signatureBuffer);
    return valid
      ? { status: "valid", keyId: signature.keyId, message: "Signatur gültig." }
      : { status: "invalid", keyId: signature.keyId, message: "Signatur ungültig." };
  } catch {
    return { status: "invalid", keyId: signature.keyId, message: "Signatur konnte nicht geprüft werden." };
  }
}

/**
 * Lädt die Vertrauensliste. Fehlerhafte Einträge werden verworfen, nicht
 * geraten; eine leere Liste bedeutet „keine Schlüssel vertrauenswürdig“.
 */
function loadTrustedKeys(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const keys = Array.isArray(raw?.keys) ? raw.keys : [];
    return keys.filter((key) =>
      key && typeof key.keyId === "string" && typeof key.publicKey === "string" &&
      (key.algorithm === undefined || key.algorithm === "ed25519")
    );
  } catch {
    return [];
  }
}

module.exports = {
  canonicalize,
  buildPayload,
  verifyManifest,
  loadTrustedKeys
};
