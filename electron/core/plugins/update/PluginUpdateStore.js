"use strict";

/**
 * PluginUpdateStore
 *
 * Persistiert ausschließlich Update-Metadaten (Einstellungen, Kanalwahl,
 * Zeitpunkt und Ergebnis der letzten Prüfung). Plugin-Daten und -Dateien
 * werden nicht angefasst.
 */

const fs = require("fs");
const path = require("path");
const UpdateManifest = require("./UpdateManifest");

const STORE_VERSION = 1;
const DEFAULT_SETTINGS = {
  autoCheck: true,
  intervalHours: 6,
  defaultChannel: "stable"
};

function defaults() {
  return {
    version: STORE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    plugins: {}
  };
}

function clampSettings(input = {}) {
  const settings = { ...DEFAULT_SETTINGS };
  if (typeof input.autoCheck === "boolean") settings.autoCheck = input.autoCheck;
  if (Number.isFinite(input.intervalHours)) {
    settings.intervalHours = Math.min(168, Math.max(1, Math.round(input.intervalHours)));
  }
  if (UpdateManifest.ALLOWED_CHANNELS.includes(input.defaultChannel)) {
    settings.defaultChannel = input.defaultChannel;
  }
  return settings;
}

class PluginUpdateStore {
  constructor(options = {}) {
    if (!options.filePath) throw new Error("PluginUpdateStore benötigt einen filePath");
    this.filePath = options.filePath;
    this.cache = null;
  }

  read() {
    if (this.cache) return this.cache;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      this.cache = defaults();
      return this.cache;
    }
    const base = defaults();
    if (data && typeof data === "object") {
      base.settings = clampSettings(data.settings);
      if (data.plugins && typeof data.plugins === "object" && !Array.isArray(data.plugins)) {
        for (const [id, value] of Object.entries(data.plugins)) {
          if (!value || typeof value !== "object" || Array.isArray(value)) continue;
          const entry = {};
          if (UpdateManifest.ALLOWED_CHANNELS.includes(value.channel)) entry.channel = value.channel;
          if (typeof value.lastCheckedAt === "string") entry.lastCheckedAt = value.lastCheckedAt;
          if (typeof value.manifestUrl === "string" && value.manifestUrl.length <= 2048) {
            entry.manifestUrl = value.manifestUrl;
          }
          base.plugins[id] = entry;
        }
      }
    }
    this.cache = base;
    return base;
  }

  write(next) {
    const data = next || this.read();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(temporary, this.filePath);
    this.cache = data;
    return data;
  }

  getSettings() {
    return { ...this.read().settings };
  }

  updateSettings(patch) {
    const data = this.read();
    data.settings = clampSettings({ ...data.settings, ...patch });
    this.write(data);
    return { ...data.settings };
  }

  getPluginState(pluginId) {
    return { ...(this.read().plugins[pluginId] || {}) };
  }

  updatePluginState(pluginId, patch) {
    const data = this.read();
    data.plugins[pluginId] = { ...(data.plugins[pluginId] || {}), ...patch };
    this.write(data);
    return { ...data.plugins[pluginId] };
  }
}

module.exports = PluginUpdateStore;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
module.exports.clampSettings = clampSettings;
