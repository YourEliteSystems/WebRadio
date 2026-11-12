// Update Channel Tests – vier Kanaele (alpha/beta/rc/stable)
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

const UpdateChannel = require("../../electron/core/updates/UpdateChannel");
const ReleaseChannel = require("../../electron/core/updates/ReleaseChannel");
const ChannelMetadata = require("../../electron/core/updates/ChannelMetadata");
const UpdateState = require("../../electron/core/updates/UpdateState");

const CHANNELS = UpdateState.CHANNELS;

console.log("\n[1] Channel Detection");
test("1.0.7 -> stable", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.7"), CHANNELS.STABLE);
});
test("1.0.7-alpha.1 -> alpha", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.7-alpha.1"), CHANNELS.ALPHA);
});
test("1.0.7-beta.1 -> beta", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.7-beta.1"), CHANNELS.BETA);
});
test("1.0.8-rc.1 -> rc", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.8-rc.1"), CHANNELS.RC);
});
test("1.0.8-rc.12 -> rc", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.8-rc.12"), CHANNELS.RC);
});
test("1.0.8-nightly.1 -> beta (unbekannte Stage bleibt beta-kompatibel)", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("1.0.8-nightly.1"), CHANNELS.BETA);
});
test("v-Praefix und Grossschreibung werden erkannt", () => {
  assert.strictEqual(UpdateChannel.detectChannelFromVersion("v1.0.8-RC.1"), CHANNELS.RC);
});

console.log("\n[2] Channel Validation");
test("stable/beta/rc/alpha sind gueltig", () => {
  for (const channel of ["stable", "beta", "rc", "alpha"]) {
    assert.strictEqual(UpdateChannel.isValidChannel(channel), true, channel);
  }
});
test("unbekannte Channel sind ungueltig", () => {
  assert.strictEqual(UpdateChannel.isValidChannel("RC"), false);
  assert.strictEqual(UpdateChannel.isValidChannel("nightly"), false);
  assert.strictEqual(UpdateChannel.isValidChannel(""), false);
  assert.strictEqual(UpdateChannel.isValidChannel(null), false);
});

console.log("\n[3] electron-updater Konfiguration");
test("stable nutzt latest und keine Pre-Releases", () => {
  const cfg = UpdateChannel.getUpdaterConfig("stable", "1.0.8");
  assert.strictEqual(cfg.channel, null);
  assert.strictEqual(cfg.allowPrerelease, false);
  assert.strictEqual(cfg.allowDowngrade, false);
});
test("beta nutzt den beta-Feed", () => {
  const cfg = UpdateChannel.getUpdaterConfig("beta", "1.0.8-beta.1");
  assert.strictEqual(cfg.channel, "beta");
  assert.strictEqual(cfg.allowPrerelease, true);
  assert.strictEqual(cfg.allowDowngrade, false);
});
test("rc nutzt den rc-Feed", () => {
  const cfg = UpdateChannel.getUpdaterConfig("rc", "1.0.8-rc.1");
  assert.strictEqual(cfg.channel, "rc");
  assert.strictEqual(cfg.allowPrerelease, true);
  assert.strictEqual(cfg.allowDowngrade, false);
});
test("alpha nutzt den alpha-Feed", () => {
  const cfg = UpdateChannel.getUpdaterConfig("alpha", "1.0.8-alpha.1");
  assert.strictEqual(cfg.channel, "alpha");
  assert.strictEqual(cfg.allowPrerelease, true);
  assert.strictEqual(cfg.allowDowngrade, false);
});
test("kein Kanal erlaubt Downgrades, auch nicht aus einer Vorabversion", () => {
  for (const current of ["1.0.8", "1.0.8-rc.1", "1.0.8-beta.2"]) {
    for (const channel of ["stable", "beta", "rc", "alpha"]) {
      assert.strictEqual(
        UpdateChannel.getUpdaterConfig(channel, current).allowDowngrade,
        false,
        `${channel} / ${current}`
      );
    }
  }
});

console.log("\n[4] Stage-Filter");
test("stable akzeptiert nur finale Releases", () => {
  const filter = UpdateChannel.getAllowedPreReleaseFilter("stable");
  assert.strictEqual(filter({ version: "1.0.8" }), true);
  for (const version of ["1.0.8-rc.1", "1.0.8-beta.1", "1.0.8-alpha.1", "1.0.8-nightly.1"]) {
    assert.strictEqual(filter({ version }), false, version);
  }
});
test("beta akzeptiert Beta, RC und Stable", () => {
  const filter = UpdateChannel.getAllowedPreReleaseFilter("beta");
  assert.strictEqual(filter({ version: "1.0.8-beta.1" }), true);
  assert.strictEqual(filter({ version: "1.0.8-rc.1" }), true);
  assert.strictEqual(filter({ version: "1.0.8" }), true);
  assert.strictEqual(filter({ version: "1.0.8-alpha.1" }), false);
  assert.strictEqual(filter({ version: "1.0.8-nightly.1" }), false);
});
test("rc akzeptiert RC und Stable", () => {
  const filter = UpdateChannel.getAllowedPreReleaseFilter("rc");
  assert.strictEqual(filter({ version: "1.0.8-rc.2" }), true);
  assert.strictEqual(filter({ version: "1.0.8" }), true);
  assert.strictEqual(filter({ version: "1.0.8-beta.1" }), false);
  assert.strictEqual(filter({ version: "1.0.8-alpha.1" }), false);
});
test("alpha akzeptiert alle Stages", () => {
  const filter = UpdateChannel.getAllowedPreReleaseFilter("alpha");
  for (const version of ["1.0.8-alpha.1", "1.0.8-beta.1", "1.0.8-rc.1", "1.0.8"]) {
    assert.strictEqual(filter({ version }), true, version);
  }
});

console.log("\n[5] ReleaseChannel-Resolver");
test("ReleaseChannel erkennt RC", () => {
  assert.strictEqual(ReleaseChannel.resolveChannel("1.0.8-rc.1"), "rc");
  assert.strictEqual(ReleaseChannel.resolveChannel("1.0.8"), "stable");
});
test("ReleaseChannel liefert Label, Kurzlabel und Farbe fuer RC", () => {
  const resolved = ReleaseChannel.resolve("1.0.8-rc.1");
  assert.strictEqual(resolved.channel, "rc");
  assert.strictEqual(resolved.label, "Release Candidate");
  assert.strictEqual(resolved.shortLabel, "RC");
  assert.strictEqual(resolved.color, "#8b5cf6");
});
test("ReleaseChannel-Farben entsprechen dem Channel-Konzept", () => {
  assert.strictEqual(ReleaseChannel.resolve("1.0.8-alpha.1").color, "#ef4444");
  assert.strictEqual(ReleaseChannel.resolve("1.0.8-beta.1").color, "#f59e0b");
  assert.strictEqual(ReleaseChannel.resolve("1.0.8-rc.1").color, "#8b5cf6");
  assert.strictEqual(ReleaseChannel.resolve("1.0.8").color, "#22c55e");
});
test("ReleaseChannel faellt bei ungueltigen Eingaben auf Stable zurueck", () => {
  assert.strictEqual(ReleaseChannel.resolveChannel(null), "stable");
  assert.strictEqual(ReleaseChannel.resolveChannel(""), "stable");
  assert.strictEqual(ReleaseChannel.resolveChannel("keine-version"), "stable");
});

console.log("\n[6] ChannelMetadata");
test("vier Kanaele sind definiert und geordnet", () => {
  assert.deepStrictEqual(ChannelMetadata.CHANNEL_IDS, ["alpha", "beta", "rc", "stable"]);
  assert.strictEqual(ChannelMetadata.getAllUpdateChannelMetadata().length, 4);
});
test("RC-Metadaten enthalten Label, Farbe und Icon", () => {
  const rc = ChannelMetadata.CHANNEL_METADATA.rc;
  assert.strictEqual(rc.label, "Release Candidate");
  assert.strictEqual(rc.shortLabel, "RC");
  assert.strictEqual(rc.color, "#8b5cf6");
  assert.ok(rc.icon.includes("<svg"));
});
test("Alpha ist rot, Beta orange, Stable gruen", () => {
  assert.strictEqual(ChannelMetadata.CHANNEL_METADATA.alpha.color, "#ef4444");
  assert.strictEqual(ChannelMetadata.CHANNEL_METADATA.beta.color, "#f59e0b");
  assert.strictEqual(ChannelMetadata.CHANNEL_METADATA.stable.color, "#22c55e");
});
test("jeder Kanal hat Icon, Label, Kurzlabel und Beschreibung", () => {
  for (const id of ChannelMetadata.CHANNEL_IDS) {
    const meta = ChannelMetadata.CHANNEL_METADATA[id];
    assert.ok(meta.icon && meta.icon.includes("<svg"), `${id} Icon`);
    assert.ok(meta.label, `${id} Label`);
    assert.ok(meta.shortLabel, `${id} Kurzlabel`);
    assert.ok(meta.description, `${id} Beschreibung`);
  }
});
test("getUpdateChannelMetadata liefert eine defensive Kopie", () => {
  const copy = ChannelMetadata.getUpdateChannelMetadata("rc");
  assert.strictEqual(copy.id, "rc");
  assert.strictEqual(Object.isFrozen(copy), true);
});

console.log("\n[7] UpdateState");
test("CHANNELS enthaelt RC", () => {
  assert.strictEqual(UpdateState.CHANNELS.RC, "rc");
});
test("Default-State startet auf stable", () => {
  assert.strictEqual(UpdateState.createDefaultState().channel, "stable");
});

console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
