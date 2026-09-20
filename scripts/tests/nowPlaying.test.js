"use strict";

/**
 * nowPlaying.test.js
 *
 * Tests für die reine Now-Playing-Logik:
 *  - Content-Extraktion aus dem Unified Player State
 *  - Identitätsregeln (wann gilt etwas als "neuer Titel"?)
 *  - Keine Anzeige bei rein technischen Updates (Play/Pause/Volume/identisch)
 *  - Persistent-Modus aktualisiert ohne Neuaufbau
 *  - Radio/FFmpeg wird nicht als Musikinfo dargestellt
 */

const assert = require("assert");

console.log("==========================================");
console.log("🧪 NowPlayingContent / Mode Logic Tests");
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
    if (err.stack) console.error(err.stack.split("\n").slice(0, 4).join("\n"));
    failed++;
  }
}

function assertNull(actual, message) {
  if (actual !== null) {
    throw new Error(`${message || "Erwartet null"}: ${JSON.stringify(actual)}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "Assertion failed"}: erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);
  }
}

// Der gleiche Extraktionslogik wie in NowPlayingDisplay.jsx
function getNowPlayingContent(state) {
  if (!state) return null;

  const { state: playerState, title, artist, artwork, source } = state;

  if (playerState !== "playing" && playerState !== "loading") {
    return null;
  }

  const rawTitle = typeof title === "string" ? title.trim() : null;
  const rawArtist = typeof artist === "string" ? artist.trim() : null;

  if (!rawTitle && !rawArtist) {
    return null;
  }

  let displayTitle = rawTitle || null;
  let displayArtist = rawArtist || null;

  if (!displayTitle && source && source.type === "radio" && rawTitle) {
    displayTitle = rawTitle;
  }

  if (!displayArtist) {
    displayArtist = "Unbekannter Interpret";
  }

  return {
    title: displayTitle,
    artist: displayArtist,
    artwork: artwork && typeof artwork === "string" ? artwork : null,
    sourceLabel: source && source.name ? source.name : null
  };
}

function getContentIdentity(content) {
  if (!content) return null;
  return `${content.title || ""}|${content.artist || ""}`;
}

console.log("\n[1] Content Extraction");

test("gibt null für idle/stopped/paused/error zurück", () => {
  assertNull(getNowPlayingContent({ state: "idle" }), "idle");
  assertNull(getNowPlayingContent({ state: "stopped" }), "stopped");
  assertNull(getNowPlayingContent({ state: "paused" }), "paused");
  assertNull(getNowPlayingContent({ state: "error" }), "error");
});

test("gibt null für leere Metadaten zurück", () => {
  assertNull(getNowPlayingContent({ state: "playing", title: null, artist: null, source: { type: "radio" } }));
  assertNull(getNowPlayingContent({ state: "playing", title: "", artist: "", source: { type: "radio" } }));
});

test("verwendet Titel als Titel, interpretiert Provider-Name nicht als Titel", () => {
  const content = getNowPlayingContent({
    state: "playing",
    title: "Never Gonna Give You Up",
    artist: "Rick Astley",
    source: { id: "radio", name: "Radio", provider: "FFmpeg", type: "radio" }
  });

  assertEqual(content.title, "Never Gonna Give You Up");
  assertEqual(content.artist, "Rick Astley");
  assertEqual(content.sourceLabel, "Radio");
});

test("verwendet bei Radio ohne Artist den Titel und füllt Artist als Fallback", () => {
  const content = getNowPlayingContent({
    state: "playing",
    title: "RadioXYZ StreamTitle",
    artist: null,
    source: { id: "radio", name: "Radio", provider: "FFmpeg", type: "radio" }
  });

  assertEqual(content.title, "RadioXYZ StreamTitle");
  assertEqual(content.artist, "Unbekannter Interpret");
  assertEqual(content.sourceLabel, "Radio");
});

test("verwendet bei Nicht-Radio Titel direkt", () => {
  const content = getNowPlayingContent({
    state: "playing",
    title: "Song A",
    artist: "Artist A",
    source: { id: "mediahub", name: "MediaHub", provider: "YouTube", type: "mediahub" }
  });

  assertEqual(content.title, "Song A");
  assertEqual(content.artist, "Artist A");
  assertEqual(content.sourceLabel, "MediaHub");
});

test("verwendet artwork nur bei gültiger URL-ähnlicher Zeichenkette", () => {
  const withArtwork = getNowPlayingContent({
    state: "playing",
    title: "T",
    artist: "A",
    artwork: "https://example.com/cover.jpg",
    source: { name: "S" }
  });

  assertEqual(withArtwork.artwork, "https://example.com/cover.jpg");

  const ohneArtwork = getNowPlayingContent({
    state: "playing",
    title: "T",
    artist: "A",
    artwork: null,
    source: { name: "S" }
  });

  assertEqual(ohneArtwork.artwork, null);
});

test("Radio-Provider-Label erscheint nie als Titel oder Artist", () => {
  const content = getNowPlayingContent({
    state: "playing",
    title: "StreamTitle",
    artist: null,
    source: { name: "Radio", provider: "FFmpeg", type: "radio" }
  });

  assertEqual(content.title, "StreamTitle");
  assertEqual(content.artist, "Unbekannter Interpret");
  assertEqual(content.sourceLabel, "Radio");
});

console.log("\n[2] Identitätsregeln / Einmalig-Modus");

test("gleicher Inhalt gilt nicht als neuer Titelwechsel", () => {
  const c1 = getNowPlayingContent({
    state: "playing",
    title: "Song A",
    artist: "Artist A"
  });
  const c2 = getNowPlayingContent({
    state: "playing",
    title: "Song A",
    artist: "Artist A"
  });

  assertEqual(getContentIdentity(c1), getContentIdentity(c2));
});

test("Andere Metadaten ergeben andere Identität", () => {
  const c1 = getNowPlayingContent({
    state: "playing",
    title: "Song A",
    artist: "Artist A"
  });
  const c2 = getNowPlayingContent({
    state: "playing",
    title: "Song B",
    artist: "Artist B"
  });

  assertNotEqual(getContentIdentity(c1), getContentIdentity(c2));
});

test("Play/Pause/Volume-änderungen ändern nicht die Identität", () => {
  const base = {
    state: "playing",
    title: "Song",
    artist: "Artist",
    source: { name: "S", type: "radio" }
  };

  const playing = getNowPlayingContent(base);
  const paused = getNowPlayingContent({ ...base, state: "paused" });
  const loading = getNowPlayingContent({ ...base, state: "loading" });

  assertEqual(getContentIdentity(playing), getContentIdentity(loading));
  assertNull(paused, "Paused-State soll keine Inhaltsidentität liefern");
});

test("identische State-Updates ohne Metadatenänderung erzeugen keine neue Identität", () => {
  const a = getNowPlayingContent({
    state: "playing",
    title: "T",
    artist: "A",
    source: { name: "Radio", type: "radio" },
    volume: 0.5
  });

  const b = getNowPlayingContent({
    state: "playing",
    title: "T",
    artist: "A",
    source: { name: "Radio", type: "radio" },
    volume: 0.7
  });

  assertEqual(getContentIdentity(a), getContentIdentity(b));
});

test("ein echter Wechsel auf ein anderes Medium ergibt neue Identität", () => {
  const radio = getNowPlayingContent({
    state: "playing",
    title: "StreamTitle",
    artist: null,
    source: { name: "Radio", type: "radio" }
  });

  const track = getNowPlayingContent({
    state: "playing",
    title: "Song",
    artist: "Artist",
    source: { name: "MediaHub", type: "mediahub" }
  });

  assertNotEqual(getContentIdentity(radio), getContentIdentity(track));
});

console.log("\n[3] Persistent-Modus Verhalten (Logik-Simulation)");

test("Persistent: State mit Inhalt -> Anzeige aktualisiert sich", () => {
  let visible = false;
  let content = null;

  const applyPersistent = (state) => {
    const c = getNowPlayingContent(state);
    if (!c) {
      visible = false;
      content = null;
      return;
    }
    content = c;
    visible = true;
  };

  applyPersistent({
    state: "playing",
    title: "Song A",
    artist: "Artist A",
    source: { name: "MediaHub", type: "mediahub" }
  });

  assertEqual(content.title, "Song A");
  assertEqual(visible, true);

  applyPersistent({
    state: "playing",
    title: "Song B",
    artist: "Artist B",
    source: { name: "MediaHub", type: "mediahub" }
  });

  assertEqual(content.title, "Song B");
  assertEqual(visible, true);
});

test("Persistent: State ohne Inhalt -> Anzeige ausgeblendet", () => {
  let visible = true;
  let content = { title: "Old" };

  const applyPersistent = (state) => {
    const c = getNowPlayingContent(state);
    if (!c) {
      visible = false;
      content = null;
      return;
    }
    content = c;
    visible = true;
  };

  applyPersistent({ state: "stopped" });

  assertEqual(visible, false);
  assertNull(content);
});

console.log("\n[4] Kein Popup bei Initialisierung");

test("Initialer Load/Playing-State ohne vorherigen Vergleich löst keine Identitätsänderung aus", () => {
  const first = getNowPlayingContent({
    state: "playing",
    title: "Initial Song",
    artist: "Initial Artist",
    source: { name: "Radio", type: "radio" }
  });

  const second = getNowPlayingContent({
    state: "playing",
    title: "Initial Song",
    artist: "Initial Artist",
    source: { name: "Radio", type: "radio" }
  });

  // Beide haben dieselbe Identität; bei einmalig-Modus darf dies nicht als
  // Titelwechsel interpretiert werden.
  assertEqual(getContentIdentity(first), getContentIdentity(second));
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) process.exit(1);

function assertNotEqual(a, b) {
  if (a === b) {
    throw new Error(`Erwartet unterschiedliche Werte, erhalten ${JSON.stringify(a)}`);
  }
}
