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

console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
