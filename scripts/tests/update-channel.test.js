// Update Channel Tests
"use strict";

const assert = require("assert");

console.log("==========================================");
console.log("🧪 Starte Update Channel Tests");
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

// Mock Import (da wir im Test-Kontext sind)
const CHANNELS = {
  STABLE: "stable",
  BETA: "beta",
  ALPHA: "alpha"
};

const ERROR_CODES = {
  INVALID_CHANNEL: "UPDATER_INVALID_CHANNEL"
};

function isPrerelease(version) {
  if (typeof version !== "string") return false;
  return /-(alpha|beta|rc|nightly)(\.\d+)?/i.test(version);
}

function isValidChannel(channel) {
  return channel === CHANNELS.STABLE || channel === CHANNELS.BETA || channel === CHANNELS.ALPHA;
}

function detectChannelFromVersion(version) {
  if (isPrerelease(version)) {
    if (/-alpha(\.|$)/i.test(version)) {
      return CHANNELS.ALPHA;
    }
    if (/-beta(\.|$)/i.test(version)) {
      return CHANNELS.BETA;
    }
    return CHANNELS.BETA;
  }
  return CHANNELS.STABLE;
}

function getUpdateChannel(settings, currentVersion) {
  if (settings && settings.updates && settings.updates.channel) {
    const userChannel = settings.updates.channel;
    if (isValidChannel(userChannel)) {
      return userChannel;
    }
  }
  
  if (currentVersion) {
    return detectChannelFromVersion(currentVersion);
  }
  
  return CHANNELS.STABLE;
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

console.log("\n[1] Channel Detection");
test("1.0.7 -> stable", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7"), CHANNELS.STABLE);
});

test("1.0.7-alpha.1 -> alpha", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-alpha.1"), CHANNELS.ALPHA);
});

test("1.0.7-beta.1 -> beta", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-beta.1"), CHANNELS.BETA);
});

test("1.0.7-rc.1 -> beta", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-rc.1"), CHANNELS.BETA);
});

test("1.0.7-nightly.1 -> beta", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-nightly.1"), CHANNELS.BETA);
});

console.log("\n[2] Channel Validation");
test("stable ist gültig", () => {
  assert.strictEqual(isValidChannel(CHANNELS.STABLE), true);
});

test("beta ist gültig", () => {
  assert.strictEqual(isValidChannel(CHANNELS.BETA), true);
});

test("alpha ist gültig", () => {
  assert.strictEqual(isValidChannel(CHANNELS.ALPHA), true);
});

test("invalid ist ungültig", () => {
  assert.strictEqual(isValidChannel("invalid"), false);
});

console.log("\n[3] Zentrale getUpdateChannel");
test("User-Settings haben Priorität", () => {
  const settings = { updates: { channel: CHANNELS.ALPHA } };
  assert.strictEqual(getUpdateChannel(settings, "1.0.7"), CHANNELS.ALPHA);
});

test("User-Settings mit updateChannel haben Priorität", () => {
  const UpdateChannel = require("../../electron/core/updates/UpdateChannel");
  const settings = { updateChannel: CHANNELS.ALPHA };
  assert.strictEqual(UpdateChannel.getUpdateChannel(settings, "1.0.7"), CHANNELS.ALPHA);
});

test("Version-Fallback ohne Settings", () => {
  assert.strictEqual(getUpdateChannel(null, "1.0.7-alpha.1"), CHANNELS.ALPHA);
});

test("Stable Fallback ohne Settings und Version", () => {
  assert.strictEqual(getUpdateChannel(null, null), CHANNELS.STABLE);
});

test("User-Settings mit ungültigem Channel fallen auf Version zurück", () => {
  const settings = { updates: { channel: "invalid" } };
  assert.strictEqual(getUpdateChannel(settings, "1.0.7-beta.1"), CHANNELS.BETA);
});

console.log("\n[4] Pre-Release Erkennung");
test("1.0.7 ist kein Pre-Release", () => {
  assert.strictEqual(isPrerelease("1.0.7"), false);
});

test("1.0.7-alpha.1 ist Pre-Release", () => {
  assert.strictEqual(isPrerelease("1.0.7-alpha.1"), true);
});

test("1.0.7-beta.1 ist Pre-Release", () => {
  assert.strictEqual(isPrerelease("1.0.7-beta.1"), true);
});

test("1.0.7-rc.1 ist Pre-Release", () => {
  assert.strictEqual(isPrerelease("1.0.7-rc.1"), true);
});

console.log("\n[5] Release-Channel Ableitung (alpha/beta/stable)");
test("1.0.7-alpha.1 -> alpha (nicht beta, nicht stable)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-alpha.1"), CHANNELS.ALPHA);
});

test("1.0.7-alpha.2 -> alpha (nicht beta, nicht stable)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-alpha.2"), CHANNELS.ALPHA);
});

test("1.0.7-beta.1 -> beta (nicht alpha, nicht stable)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-beta.1"), CHANNELS.BETA);
});

test("1.0.7-beta.2 -> beta (nicht alpha, nicht stable)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-beta.2"), CHANNELS.BETA);
});

test("1.0.7 -> stable", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7"), CHANNELS.STABLE);
});

test("1.0.7-alpha.0 -> alpha (Prerelease-Star-Nummer 0)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-alpha.0"), CHANNELS.ALPHA);
});

test("1.0.7-alpha.9 -> alpha", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-alpha.9"), CHANNELS.ALPHA);
});

test("1.0.7-beta.0 -> beta (Prerelease-Star-Nummer 0)", () => {
  assert.strictEqual(detectChannelFromVersion("1.0.7-beta.0"), CHANNELS.BETA);
});

test("1.1.0-rc.1 kann als Beta-kompatibel markiert werden", () => {
  assert.strictEqual(detectChannelFromVersion("1.1.0-rc.1"), CHANNELS.BETA);
});

console.log("\n[6] central channel meta / labelable metadata" );
test("ChannelMetadata alpha/beta/stable existieren", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  assert.ok(ChannelMetadata.CHANNEL_METADATA.alpha, "alpha metadata")
  assert.ok(ChannelMetadata.CHANNEL_METADATA.beta, "beta metadata")
  assert.ok(ChannelMetadata.CHANNEL_METADATA.stable, "stable metadata")
});

test("Channel-Meta enthält id/label/color/shortLabel", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const a = ChannelMetadata.CHANNEL_METADATA.alpha;
  assert.strictEqual(a.id, "alpha");
  assert.strictEqual(a.label, "Alpha");
  assert.ok(a.color);
  assert.strictEqual(a.shortLabel, "Alpha");
});

test("ChannelMetadaten-IDs sind alpha/beta/stable", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  assert.deepStrictEqual(ChannelMetadata.CHANNEL_IDS, ["alpha", "beta", "stable"]);
});

test("getAllUpdateChannelMetadata enthält alpha/beta/stable", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const list = ChannelMetadata.getAllUpdateChannelMetadata();
  assert.strictEqual(list.length, 3);
  assert.ok(list.some((m) => m.id === "alpha"));
  assert.ok(list.some((m) => m.id === "beta"));
  assert.ok(list.some((m) => m.id === "stable"));
});

test("ChannelMetadata alpha enthält gültiges Icon-SVG", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const icon = ChannelMetadata.CHANNEL_METADATA.alpha.icon;
  assert.ok(typeof icon === "string", "Icon ist String");
  assert.ok(icon.includes("<svg"), "Icon enthält <svg>");
  assert.ok(icon.includes("viewBox"), "Icon enthält viewBox");
  assert.ok(icon.includes("currentColor"), "Icon enthält currentColor");
});

test("ChannelMetadata beta enthält gültiges Icon-SVG", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const icon = ChannelMetadata.CHANNEL_METADATA.beta.icon;
  assert.ok(typeof icon === "string", "Icon ist String");
  assert.ok(icon.includes("<svg"), "Icon enthält <svg>");
  assert.ok(icon.includes("viewBox"), "Icon enthält viewBox");
  assert.ok(icon.includes("currentColor"), "Icon enthält currentColor");
});

test("ChannelMetadata stable enthält gültiges Icon-SVG", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const icon = ChannelMetadata.CHANNEL_METADATA.stable.icon;
  assert.ok(typeof icon === "string", "Icon ist String");
  assert.ok(icon.includes("<svg"), "Icon enthält <svg>");
  assert.ok(icon.includes("viewBox"), "Icon enthält viewBox");
  assert.ok(icon.includes("currentColor") || icon.includes("stroke"), "Icon enthält currentColor oder stroke");
});

test("ChannelMetadata-Copy enthält mindenfalls Icon", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  const copied = ChannelMetadata.getUpdateChannelMetadata("alpha");
  assert.ok(copied.icon && copied.icon.trim(), "Copied alpha enthält Icon");
});

test("Alle Channel-Metadata enthalten Icon, Label und Farbe", () => {
  const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
  for (const id of ChannelMetadata.CHANNEL_IDS) {
    const meta = ChannelMetadata.CHANNEL_METADATA[id];
    assert.ok(meta.icon && meta.icon.trim(), `${id} enthält Icon`);
    assert.ok(meta.label, `${id} enthält Label`);
    assert.ok(meta.color, `${id} enthält Farbe`);
  }
});

console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
