"use strict";

/**
 * PluginUpdateService
 *
 * Verbindet die drei Verantwortlichkeiten:
 *   Website  -> PluginCatalogClient  (nur veröffentlichte/geprüfte Plugins)
 *   Entwickler-Server -> Update-Manifest + Paket (HTTPS, signiert)
 *   Desktop  -> Prüfung, Download, Verifikation, Installation, Rollback
 *
 * Der Dienst führt immer nur eine Operation gleichzeitig aus, blockiert den
 * Main-Prozess nicht (ausschließlich asynchrone I/O) und kann jederzeit
 * abgebrochen werden.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const semver = require("./PluginSemver");
const UpdateManifest = require("./UpdateManifest");
const SignatureVerifier = require("./SignatureVerifier");
const UpdateSourcePolicy = require("./UpdateSourcePolicy");
const HttpDownloader = require("./HttpDownloader");
const PluginCatalogClient = require("./PluginCatalogClient");
const PluginUpdateStore = require("./PluginUpdateStore");
const PluginPackageInstaller = require("./PluginPackageInstaller");

const MAX_MANIFEST_BYTES = 256 * 1024;
const AUTO_CHECK_DELAY_MS = 20000;

function statusResult(status, extra = {}) {
  return { status, ...extra };
}

class PluginUpdateService {
  constructor(options = {}) {
    this.appVersion = options.appVersion || "0.0.0";
    this.pluginsRoot = options.pluginsRoot;
    this.updatesRoot = options.updatesRoot;
    this.logger = options.logger || { info() {}, warn() {}, error() {} };
    this.emit = options.emit || (() => {});
    this.getInstalledPlugins = options.getInstalledPlugins || (() => {
      const PluginLoader = require("../PluginLoader");
      return PluginLoader.discoverPlugins();
    });
    this.isPluginEnabled = options.isPluginEnabled || null;
    this.reloadPlugins = options.reloadPlugins || (async () => ({ ok: true }));
    // Ausschließlich für automatisierte Tests: erlaubt HTTP und Loopback als
    // Update-Quelle. Wird von der Anwendung nie gesetzt.
    this.allowInsecure = options.allowInsecure === true;
    // Optionaler Adapter für Übersetzungskataloge (Provisionierung/Rollback
    // sind Teil des Installationsvorgangs).
    this.localizationAdapter = options.localizationAdapter || null;
    this.catalog = options.catalogClient || new PluginCatalogClient(options.catalogOptions);
    this.store = options.store || new PluginUpdateStore({
      filePath: path.join(options.updatesRoot, "state.json")
    });
    this.trustedKeys = options.trustedKeys || SignatureVerifier.loadTrustedKeys(
      path.join(__dirname, "trusted-keys.json")
    );
    this.installer = options.installer || new PluginPackageInstaller({
      pluginsRoot: options.pluginsRoot,
      updatesRoot: options.updatesRoot,
      appVersion: this.appVersion,
      logger: this.logger
    });
    this.results = new Map();
    this.running = false;
    this.abortController = null;
    this.autoCheckTimer = null;
    this.autoCheckStartTimer = null;
  }

  // ─────────────────────────────────────────
  // Zustand
  // ─────────────────────────────────────────

  /**
   * Liefert den vollständigen UI-Zustand. Enthält keine Pfade zu Backups oder
   * Download-Verzeichnissen, damit der Renderer keine Dateisystemdetails sieht.
   */
  getState() {
    const settings = this.store.getSettings();
    const plugins = [];
    let discovered = [];
    try {
      discovered = this.getInstalledPlugins() || [];
    } catch (error) {
      this.logger.error(`[PluginUpdate] Installierte Plugins nicht lesbar: ${error.message}`);
    }

    for (const plugin of discovered) {
      const manifest = plugin.manifest || plugin;
      if (!manifest || !manifest.id) continue;
      const result = this.results.get(manifest.id) || { status: "idle" };
      const updateConfig = this._readUpdateConfig(manifest, plugin.path);
      plugins.push({
        id: manifest.id,
        name: manifest.name || manifest.id,
        installedVersion: manifest.version || "0.0.0",
        enabled: this.isPluginEnabled ? this.isPluginEnabled(manifest.id) : true,
        channel: this._channelFor(manifest.id, updateConfig),
        source: {
          configured: Boolean(updateConfig.manifestUrl),
          manifestUrl: updateConfig.manifestUrl || null,
          host: updateConfig.manifestUrl ? this._hostOf(updateConfig.manifestUrl) : null
        },
        ...result
      });
    }

    return {
      settings,
      catalog: this.catalogStatus || { ok: null, fetchedAt: null, error: null },
      busy: this.running,
      plugins
    };
  }

  _channelFor(pluginId, updateConfig) {
    const stored = this.store.getPluginState(pluginId).channel;
    if (UpdateManifest.ALLOWED_CHANNELS.includes(stored)) return stored;
    if (UpdateManifest.ALLOWED_CHANNELS.includes(updateConfig.channel)) return updateConfig.channel;
    return this.store.getSettings().defaultChannel;
  }

  _hostOf(url) {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }

  /**
   * Liest die Update-Konfiguration aus `plugin.json`. Es werden ausschließlich
   * dokumentierte Felder akzeptiert; alles andere wird ignoriert.
   */
  _readUpdateConfig(manifest, pluginPath) {
    const update = manifest && manifest.update;
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      return { manifestUrl: null, channel: null };
    }
    const manifestUrl = typeof update.manifestUrl === "string" && update.manifestUrl.length <= 2048
      ? update.manifestUrl
      : null;
    const channel = UpdateManifest.ALLOWED_CHANNELS.includes(update.channel) ? update.channel : null;
    if (!manifestUrl && !pluginPath) return { manifestUrl: null, channel };
    return { manifestUrl, channel };
  }

  _notify() {
    try {
      this.emit(this.getState());
    } catch (error) {
      this.logger.warn(`[PluginUpdate] Zustandsbenachrichtigung fehlgeschlagen: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────
  // Prüfung
  // ─────────────────────────────────────────

  async checkAll(options = {}) {
    const installed = (this.getInstalledPlugins() || []).filter((plugin) => (plugin.manifest || plugin)?.id);
    const results = [];
    for (const plugin of installed) {
      // Sequenziell: mehrere gleichzeitige Manifest-Abrufe bringen keinen
      // Vorteil und erschweren Abbruch sowie Fehlzuordnung.
      results.push(await this._checkPlugin(plugin, options));
    }
    this._notify();
    return results;
  }

  async checkPlugin(pluginId, options = {}) {
    const plugin = (this.getInstalledPlugins() || [])
      .find((entry) => (entry.manifest || entry)?.id === pluginId);
    if (!plugin) {
      return statusResult("error", { error: { code: "plugin_not_installed", message: "Plugin ist nicht installiert." } });
    }
    const result = await this._checkPlugin(plugin, options);
    this._notify();
    return result;
  }

  async _checkPlugin(plugin, options = {}) {
    const manifest = plugin.manifest || plugin;
    const pluginId = manifest.id;
    const updateConfig = this._readUpdateConfig(manifest, plugin.path);
    const channel = this._channelFor(pluginId, updateConfig);

    if (!updateConfig.manifestUrl) {
      return this._record(pluginId, {
        status: "no_source",
        installedVersion: manifest.version,
        channel,
        message: "Für dieses Plugin ist keine Update-Quelle hinterlegt."
      });
    }

    const policy = await UpdateSourcePolicy.validateSource(updateConfig.manifestUrl, {
      allowInsecure: this.allowInsecure
    });
    if (!policy.ok) {
      return this._record(pluginId, {
        status: "error",
        installedVersion: manifest.version,
        channel,
        error: { code: policy.code, message: policy.message }
      });
    }

    const catalog = await this.catalog.find(pluginId, { force: options.forceCatalog === true });
    this.catalogStatus = {
      ok: catalog.catalog.ok,
      fetchedAt: catalog.catalog.fetchedAt || null,
      error: catalog.catalog.error || null
    };
    if (!catalog.catalog.ok) {
      return this._record(pluginId, {
        status: "error",
        installedVersion: manifest.version,
        channel,
        error: catalog.catalog.error
      });
    }
    if (!catalog.entry) {
      return this._record(pluginId, {
        status: "not_published",
        installedVersion: manifest.version,
        channel,
        message: "Das Plugin ist im WebRadio-Katalog nicht veröffentlicht."
      });
    }

    const download = path.join(this.updatesRoot, "manifests", `${pluginId}-${crypto.randomBytes(4).toString("hex")}.json`);
    let downloadResult;
    try {
      downloadResult = await HttpDownloader.download(updateConfig.manifestUrl, download, {
        maxBytes: MAX_MANIFEST_BYTES,
        timeoutMs: 15000,
        allowInsecure: this.allowInsecure
      });
      if (!downloadResult.ok) {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          error: { code: downloadResult.code, message: downloadResult.message }
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(download, "utf8"));
      } catch {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          error: { code: "manifest_invalid_json", message: "Das Update-Manifest ist kein gültiges JSON." }
        });
      }

      const validation = UpdateManifest.validate(parsed, { installedManifest: manifest });
      if (!validation.valid) {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          error: {
            code: "manifest_invalid",
            message: "Das Update-Manifest ist ungültig.",
            details: validation.errors.slice(0, 8)
          }
        });
      }

      const signature = SignatureVerifier.verifyManifest(parsed, { keys: this.trustedKeys });
      if (signature.status === "invalid" || signature.status === "malformed" || signature.status === "unknown_key") {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          signature,
          error: { code: "signature_invalid", message: "Die Signatur des Update-Manifests ist nicht vertrauenswürdig." }
        });
      }
      if (signature.status === "unsigned" && options.requireSignature === true) {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          signature,
          error: { code: "signature_required", message: "Für dieses Update ist eine Signatur erforderlich." }
        });
      }

      const publishedVersionMismatch = catalog.entry.latestVersion &&
        semver.isValid(catalog.entry.latestVersion) &&
        semver.compare(parsed.version, catalog.entry.latestVersion) > 0;
      if (publishedVersionMismatch && options.allowUnpublishedVersion !== true) {
        return this._record(pluginId, {
          status: "not_published",
          installedVersion: manifest.version,
          channel,
          signature,
          availableVersion: parsed.version,
          message: "Die angebotene Version ist im WebRadio-Katalog noch nicht veröffentlicht."
        });
      }

      const dependencies = this._checkDependencies(parsed, manifest.id);
      if (dependencies.missing.length > 0) {
        return this._record(pluginId, {
          status: "error",
          installedVersion: manifest.version,
          channel,
          signature,
          availableVersion: parsed.version,
          error: {
            code: "missing_dependencies",
            message: `Fehlende Abhängigkeiten: ${dependencies.missing.join(", ")}`,
            details: dependencies.missing
          }
        });
      }

      const permissions = UpdateManifest.diffPermissions(manifest, parsed);
      const compatible = semver.satisfies(this.appVersion, parsed.engines.webradio);
      const isNewer = semver.compare(parsed.version, manifest.version) > 0;
      const base = {
        installedVersion: manifest.version,
        channel,
        availableVersion: parsed.version,
        developerName: catalog.entry.developerName || "",
        changelog: parsed.changelog || "",
        releasedAt: parsed.release.releasedAt,
        packageSize: parsed.release.size,
        downloadHost: this._hostOf(parsed.release.downloadUrl),
        signature,
        permissions,
        published: true,
        integrity: "not_checked",
        lastCheckedAt: new Date().toISOString()
      };

      if (parsed.channel !== channel) {
        return this._record(pluginId, {
          ...base,
          status: "channel_mismatch",
          message: `Das Manifest gilt für Kanal "${parsed.channel}", ausgewählt ist "${channel}".`
        });
      }
      if (!compatible) {
        return this._record(pluginId, {
          ...base,
          status: "incompatible",
          error: {
            code: "incompatible_engine",
            message: `Benötigt WebRadio ${parsed.engines.webradio}, installiert ist ${this.appVersion}.`
          }
        });
      }
      if (!isNewer) {
        return this._record(pluginId, {
          ...base,
          status: "up_to_date",
          availableVersion: null,
          manifest: parsed
        });
      }

      this.store.updatePluginState(pluginId, {
        manifestUrl: updateConfig.manifestUrl,
        channel,
        lastCheckedAt: base.lastCheckedAt
      });

      return this._record(pluginId, {
        ...base,
        status: "update_available",
        requiresPermissionApproval: permissions.added.length > 0,
        requiresUnsignedApproval: signature.status === "unsigned",
        manifest: parsed
      });
    } finally {
      try {
        if (fs.existsSync(download)) fs.unlinkSync(download);
      } catch { /* best effort */ }
    }
  }

  /**
   * Prüft, ob alle deklarierten Plugin-Abhängigkeiten installiert sind und
   * die geforderten Versionsbereiche erfüllen. Optionale Abhängigkeiten werden
   * nur geprüft, wenn sie installiert sind.
   */
  _checkDependencies(manifest, ownId) {
    const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
    if (dependencies.length === 0) return { ok: true, missing: [] };

    const installed = new Map();
    try {
      for (const plugin of this.getInstalledPlugins() || []) {
        const entry = plugin.manifest || plugin;
        if (entry?.id && entry.id !== ownId) installed.set(entry.id, entry.version);
      }
    } catch { /* bereits an anderer Stelle protokolliert */ }

    const missing = [];
    for (const dependency of dependencies) {
      const version = installed.get(dependency.id);
      if (!version) {
        if (dependency.optional !== true) missing.push(dependency.id);
        continue;
      }
      if (!semver.satisfies(version, dependency.range)) {
        missing.push(`${dependency.id} (${dependency.range})`);
      }
    }
    return { ok: missing.length === 0, missing };
  }

  _record(pluginId, result) {
    const stored = this.results.get(pluginId) || {};
    const merged = { ...stored, ...result };
    this.results.set(pluginId, merged);
    this.logger.info(`[PluginUpdate] ${pluginId}: ${merged.status}`);
    return merged;
  }

  // ─────────────────────────────────────────
  // Installation
  // ─────────────────────────────────────────

  async applyUpdate(pluginId, options = {}) {
    if (this.running) {
      return { ok: false, code: "busy", message: "Es läuft bereits ein Update-Vorgang." };
    }
    const installed = (this.getInstalledPlugins() || [])
      .find((entry) => (entry.manifest || entry)?.id === pluginId);
    if (!installed) {
      return { ok: false, code: "plugin_not_installed", message: "Plugin ist nicht installiert." };
    }
    const manifest = installed.manifest || installed;
    const cached = this.results.get(pluginId);
    if (!cached || !cached.manifest) {
      return { ok: false, code: "no_update_info", message: "Es liegen keine Update-Informationen vor." };
    }

    this.running = true;
    this.abortController = new AbortController();
    this._notify();

    const controller = this.abortController;
    const work = cached.manifest;
    const downloadPath = path.join(
      this.updatesRoot,
      "downloads",
      `${pluginId}-${work.version}-${crypto.randomBytes(4).toString("hex")}.zip`
    );

    try {
      if (cached.requiresUnsignedApproval && options.allowUnsigned !== true) {
        return { ok: false, code: "signature_required", message: "Nicht signierte Updates benötigen eine ausdrückliche Bestätigung." };
      }
      if (cached.requiresPermissionApproval) {
        const approved = new Set(Array.isArray(options.approvedPermissions) ? options.approvedPermissions : []);
        const missing = cached.permissions.added.filter((permission) => !approved.has(permission));
        if (missing.length > 0) {
          return {
            ok: false,
            code: "permissions_not_approved",
            message: "Zusätzliche Berechtigungen müssen bestätigt werden.",
            details: { added: cached.permissions.added }
          };
        }
      }

      this._record(pluginId, { status: "downloading", progress: null });
      this._notify();

      const download = await HttpDownloader.download(work.release.downloadUrl, downloadPath, {
        maxBytes: work.release.size,
        signal: controller.signal,
        allowInsecure: this.allowInsecure
      });
      if (!download.ok) {
        this._record(pluginId, {
          status: "error",
          integrity: "failed",
          error: { code: download.code, message: download.message }
        });
        return { ok: false, code: download.code, message: download.message };
      }

      if (download.bytes !== work.release.size || download.sha256 !== work.release.sha256.toLowerCase()) {
        this._record(pluginId, {
          status: "error",
          integrity: "failed",
          error: { code: "integrity_mismatch", message: "Prüfsumme oder Größe des Pakets stimmen nicht." }
        });
        return { ok: false, code: "integrity_mismatch", message: "Prüfsumme oder Größe des Pakets stimmen nicht." };
      }

      const signature = SignatureVerifier.verifyManifest(work, { keys: this.trustedKeys });
      if (["invalid", "malformed", "unknown_key"].includes(signature.status)) {
        this._record(pluginId, {
          status: "error",
          signature,
          error: { code: "signature_invalid", message: "Die Signatur ist nicht vertrauenswürdig." }
        });
        return { ok: false, code: "signature_invalid", message: "Die Signatur ist nicht vertrauenswürdig." };
      }

      this._record(pluginId, { status: "installing", integrity: "verified" });
      this._notify();

      const installation = await this.installer.install({
        installedManifest: manifest,
        pluginDirectory: installed.path,
        manifest: work,
        packagePath: downloadPath,
        approvedPermissions: options.approvedPermissions || [],
        localization: this.localizationAdapter,
        reload: async () => {
          const result = await this.reloadPlugins();
          return { ok: result?.success !== false, message: result?.errors?.[0]?.error };
        }
      });

      if (!installation.ok) {
        this._record(pluginId, {
          status: installation.code === "rollback_failed" ? "rollback_failed" : "error",
          error: { code: installation.code, message: installation.message },
          ...(installation.details ? { details: installation.details } : {})
        });
        return installation;
      }

      this._record(pluginId, {
        status: "updated",
        installedVersion: installation.version,
        availableVersion: null,
        integrity: "verified",
        backupPreserved: true
      });
      this.store.updatePluginState(pluginId, { channel: this._channelFor(pluginId, {}), lastCheckedAt: new Date().toISOString() });
      return installation;
    } catch (error) {
      this.logger.error(`[PluginUpdate] Update ${pluginId} fehlgeschlagen: ${error.message}`);
      this._record(pluginId, {
        status: "error",
        error: { code: error.code || "update_failed", message: error.message }
      });
      return { ok: false, code: error.code || "update_failed", message: error.message };
    } finally {
      this.running = false;
      this.abortController = null;
      try {
        if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
      } catch { /* best effort */ }
      this._notify();
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      return { ok: true };
    }
    return { ok: false, code: "nothing_running", message: "Es läuft kein Update-Vorgang." };
  }

  // ─────────────────────────────────────────
  // Einstellungen
  // ─────────────────────────────────────────

  setChannel(pluginId, channel) {
    if (!UpdateManifest.ALLOWED_CHANNELS.includes(channel)) {
      return { ok: false, code: "invalid_channel", message: "Unbekannter Update-Kanal." };
    }
    this.store.updatePluginState(pluginId, { channel });
    this._notify();
    return { ok: true, channel };
  }

  setSettings(patch) {
    const settings = this.store.updateSettings(patch);
    this._scheduleAutoCheck();
    this._notify();
    return { ok: true, settings };
  }

  // ─────────────────────────────────────────
  // Automatische Prüfung
  // ─────────────────────────────────────────

  /**
   * Automatische Prüfung bedeutet ausschließlich „nach Updates suchen“.
   * Eine automatische Installation findet nicht statt.
   */
  startAutoCheck() {
    this._scheduleAutoCheck();
  }

  _scheduleAutoCheck() {
    this.stopAutoCheck();
    const settings = this.store.getSettings();
    if (!settings.autoCheck) return;
    const interval = Math.max(1, settings.intervalHours) * 60 * 60 * 1000;

    this.autoCheckStartTimer = setTimeout(() => {
      this.checkAll().catch((error) => {
        this.logger.warn(`[PluginUpdate] Automatische Prüfung fehlgeschlagen: ${error.message}`);
      });
    }, AUTO_CHECK_DELAY_MS);
    this.autoCheckStartTimer.unref?.();

    this.autoCheckTimer = setInterval(() => {
      this.checkAll().catch((error) => {
        this.logger.warn(`[PluginUpdate] Automatische Prüfung fehlgeschlagen: ${error.message}`);
      });
    }, interval);
    this.autoCheckTimer.unref?.();
  }

  stopAutoCheck() {
    if (this.autoCheckStartTimer) clearTimeout(this.autoCheckStartTimer);
    if (this.autoCheckTimer) clearInterval(this.autoCheckTimer);
    this.autoCheckStartTimer = null;
    this.autoCheckTimer = null;
  }

  shutdown() {
    this.stopAutoCheck();
    if (this.abortController) this.abortController.abort();
  }
}

module.exports = PluginUpdateService;
