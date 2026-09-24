// ── Renderer release channel service ────────────────────────────────────
//
// WebRadio nutzt eine zentrale Release-Kanal-Erkennung im Electron-Core.
// Diese Datei bindet den Core-Resolver (ReleaseChannel / ChannelMetadata)
// auf die Renderer-Darstellung (Label, Farbe, Icon) ab.
//
// Prinzip: Einmal zentral geprüft (Core), dann nur noch gemappt werden.
// Es wird keine parallele Version-Management-Logik im Renderer eingeführt.

// Falls der Renderer Core-Module importieren kann, nutzen wir es.
// Andernfalls bleibt die Logik ein Basismapping für den Fall, dass
// keine Core-Daten verfügbar sind.
let CORE_RELEASE_CHANNEL = null;

try {
  const releaseChannelCore = require("../core/updates/ReleaseChannel"); // path may not exist at build time
  CORE_RELEASE_CHANNEL = releaseChannelCore;
} catch (_) {
  // Core-Modul nicht verfügbar (z. B. statisch gebündelt oder Test).
  // Wir behalten eine lokale Fallback-Logik, damit Tests trotzdem funktionieren.
  CORE_RELEASE_CHANNEL = null;
}

// CSS Design-Tokens, die der vorhandene Theme-System definieren.
// Diese Variablen werden im Build von core.css geliefert. Wir definieren
// sie hier als Fallback, falls die Theme-Datei sie nicht lädt.
const RELEASE_CSS_VARIABLES = {
  alpha: "--release-alpha",
  beta: "--release-beta",
  stable: "--release-stable"
};

// Zentrale_color-Map (basiert auf ChannelMetadata-Farben)
// Die Farben werden einheitlich aus der Core-Metadaten-Ökosystem abgeleitet.
const RELEASE_COLORS = {
  alpha: "#a855f7", // violet / purple
  beta: "#f59e0b", // orange
  stable: "#22c55e" // green
};

const RELEASE_LABELS = {
  alpha: "Alpha",
  beta: "Beta",
  stable: "Stable"
};

const RELEASE_SHORT_LABELS = {
  alpha: "Alpha",
  beta: "Beta",
  stable: "Stable"
};

/**
 * Bindet einen Release-Kanal auf UI-Meta (Label, Farbe, Kurz-Label).
 * The Core-Metadaten liefern die eigentliche Farbe. Dieser Service
 * erlaubt es, die Renderer irrelevante Core-Logik zu verwenden,
 * ohne eine doppelte Implementierung zu haben.
 *
 * @param {string} version
 * @returns {{ channel: string, label: string, shortLabel: string, color: string }}
 */
function resolve(version) {
  if (CORE_RELEASE_CHANNEL && typeof CORE_RELEASE_CHANNEL.resolve === "function") {
    try {
      return CORE_RELEASE_CHANNEL.resolve(version);
    } catch (_) {
      // Core-Resolver lieferte einen Fehler zurück; Fallback.
    }
  }

  // Fallback (nur für statische Rendering, wenn Core nicht verfügbar ist)
  const normalized = (version || "").trim();
  let channel = "stable";
  if (/-alpha(\.|$)/i.test(normalized)) {
    channel = "alpha";
  } else if (/-beta(\.|$)/i.test(normalized)) {
    channel = "beta";
  }
  return {
    channel,
    label: RELEASE_LABELS[channel] || "Stable",
    shortLabel: RELEASE_SHORT_LABELS[channel] || "Stable",
    color: RELEASE_COLORS[channel] || RELEASE_COLORS.stable
  };
}

/**
 * Ermittelt den Release-Kanal für eine Version.
 *
 * @param {string} version
 * @returns {"alpha" | "beta" | "stable"}
 */
function getChannel(version) {
  return resolve(version).channel;
}

/**
 * Prüft, ob die Version eine Pre-Release ist (alpha/beta/rc/nightly).
 *
 * @param {string} version
 * @returns {boolean}
 */
function isPrerelease(version) {
  const normalized = (version || "").trim();
  return /-(alpha|beta|rc|nightly)(\.|$)/i.test(normalized);
}

module.exports = {
  resolve,
  getChannel,
  isPrerelease,
  RELEASE_CSS_VARIABLES,
  RELEASE_COLORS,
  RELEASE_LABELS,
  RELEASE_SHORT_LABELS
};
