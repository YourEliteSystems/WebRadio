"use strict";

/**
 * PluginPackageInstaller
 *
 * Führt die eigentliche, atomare Installation einer Plugin-Aktualisierung
 * durch. Der Ablauf ist bewusst defensiv:
 *
 *   1. Identität, Version, Kompatibilität und Berechtigungen prüfen
 *   2. Archiv im Arbeitsspeicher validieren (ZIP-Slip, Symlinks, Limits, CRC)
 *   3. in ein temporäres Staging-Verzeichnis entpacken
 *   4. `plugin.json` im Paket gegen das Manifest prüfen
 *   5. installiertes Verzeichnis in ein Backup verschieben
 *   6. Staging-Verzeichnis atomar an die Zielstelle verschieben
 *   7. Plugin neu laden; bei jedem Fehler automatisch zurückrollen
 *
 * Schlägt auch das Zurückrollen fehl, bleibt das Backup erhalten und der
 * Zustand wird als `rollback_failed` mit Backup-Pfad gemeldet.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const semver = require("./PluginSemver");
const UpdateManifest = require("./UpdateManifest");
const ZipArchive = require("./ZipArchive");

const MAX_ARCHIVE_BYTES = UpdateManifest.MAX_PACKAGE_BYTES;

function failure(code, message, details) {
  return { ok: false, code, message, ...(details ? { details } : {}) };
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Windows gibt Verzeichnisse manchmal erst kurz nach dem Entladen frei.
 * Ein kurzer, begrenzter Retry ist robuster als ein sofortiger Fehlschlag.
 */
function renameWithRetry(from, to, attempts = 6) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      lastError = error;
      if (!["EBUSY", "EPERM", "ENOTEMPTY", "EACCES"].includes(error.code)) throw error;
      sleepSync(40 * (attempt + 1));
    }
  }
  throw lastError;
}

function removeDirectory(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
    return true;
  } catch {
    return false;
  }
}

class PluginPackageInstaller {
  constructor(options = {}) {
    this.pluginsRoot = options.pluginsRoot;
    this.updatesRoot = options.updatesRoot;
    this.appVersion = options.appVersion || "0.0.0";
    this.logger = options.logger || { info() {}, warn() {}, error() {} };
    this.now = options.now || (() => new Date());
  }

  _paths(pluginId) {
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    return {
      staging: path.join(this.updatesRoot, "staging", `${pluginId}-${newId()}`),
      backup: path.join(this.updatesRoot, "backups", pluginId, `${stamp}-${newId()}`),
      trash: path.join(this.updatesRoot, "trash", `${pluginId}-${newId()}`)
    };
  }

  /**
   * @param {Object} params
   * @param {Object} params.installedManifest  Manifest der installierten Version
   * @param {string} params.pluginDirectory     Installiertes Plugin-Verzeichnis
   * @param {Object} params.manifest           Validiertes Update-Manifest
   * @param {string} params.packagePath        Heruntergeladenes ZIP
   * @param {string[]} [params.approvedPermissions]
   * @param {Function} params.reload           Callback, der das Plugin neu lädt
   * @returns {Promise<Object>}
   */
  async install(params) {
    const {
      installedManifest,
      pluginDirectory,
      manifest,
      packagePath,
      approvedPermissions = [],
      reload,
      localization = null
    } = params;

    if (!installedManifest || !installedManifest.id) {
      return failure("plugin_not_installed", "Das Plugin ist nicht installiert.");
    }
    if (!manifest || manifest.pluginId !== installedManifest.id) {
      return failure("plugin_id_mismatch", "Die Plugin-ID des Updates passt nicht zur installierten Version.");
    }
    const comparison = semver.compare(manifest.version, installedManifest.version);
    if (comparison <= 0) {
      return failure("not_an_upgrade", `Version ${manifest.version} ist keine Aktualisierung von ${installedManifest.version}.`);
    }
    if (!semver.satisfies(this.appVersion, manifest.engines?.webradio)) {
      return failure(
        "incompatible_engine",
        `Das Update benötigt WebRadio ${manifest.engines?.webradio}, installiert ist ${this.appVersion}.`
      );
    }

    const permissions = UpdateManifest.diffPermissions(installedManifest, manifest);
    const approved = new Set(approvedPermissions);
    const unapproved = permissions.added.filter((permission) => !approved.has(permission));
    if (unapproved.length > 0) {
      return failure(
        "permissions_not_approved",
        `Zusätzliche Berechtigungen wurden nicht bestätigt: ${unapproved.join(", ")}`,
        { added: permissions.added }
      );
    }

    if (!packagePath || !fs.existsSync(packagePath)) {
      return failure("package_missing", "Das Paket wurde nicht gefunden.");
    }
    const stats = fs.statSync(packagePath);
    if (!stats.isFile() || stats.size === 0 || stats.size > MAX_ARCHIVE_BYTES) {
      return failure("invalid_package", "Das Paket hat eine unzulässige Größe.");
    }

    const paths = this._paths(manifest.pluginId);
    let movedToBackup = false;
    let installed = false;
    let catalogBackup = null;
    let catalogsProvisioned = false;

    try {
      const archive = fs.readFileSync(packagePath);
      ZipArchive.extract(archive, paths.staging, ZipArchive.DEFAULT_LIMITS);

      const manifestPath = path.join(paths.staging, "plugin.json");
      if (!fs.existsSync(manifestPath)) {
        return failure("package_without_manifest", "Das Paket enthält keine plugin.json.");
      }
      let packageManifest;
      try {
        packageManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        return failure("package_manifest_invalid", "Die plugin.json im Paket ist ungültig.");
      }
      if (packageManifest.id !== manifest.pluginId) {
        return failure("package_id_mismatch", "Die plugin.json im Paket gehört zu einer anderen Plugin-ID.");
      }
      if (packageManifest.version !== manifest.version) {
        return failure("package_version_mismatch", "Die plugin.json im Paket hat eine andere Version als das Manifest.");
      }
      if (typeof packageManifest.main !== "string" || !fs.existsSync(path.join(paths.staging, packageManifest.main))) {
        return failure("package_entry_missing", "Die Einstiegsdatei des Plugins fehlt im Paket.");
      }
      // Das Paket darf keine anderen Rechte deklarieren als das geprüfte
      // Manifest – sonst ließen sich Berechtigungen am Manifest vorbei
      // einschmuggeln.
      const sameSet = (left, right) => {
        const a = new Set(Array.isArray(left) ? left : []);
        const b = new Set(Array.isArray(right) ? right : []);
        return a.size === b.size && [...a].every((item) => b.has(item));
      };
      if (!sameSet(packageManifest.permissions, manifest.permissions) ||
          !sameSet(packageManifest.capabilities, manifest.capabilities) ||
          !sameSet(packageManifest.webSessionOrigins, manifest.webSessionOrigins)) {
        return failure(
          "package_permissions_mismatch",
          "Die plugin.json im Paket deklariert andere Berechtigungen als das geprüfte Manifest."
        );
      }

      fs.mkdirSync(path.dirname(paths.backup), { recursive: true });

      // Übersetzungskataloge gehören zum Installationsvorgang: Sie werden
      // vor dem Dateitausch provisioniert und bei einem Rollback
      // mit zurückgespielt. Ein Update kann so niemals Kataloge eines
      // anderen Plugins verändern.
      if (localization && typeof localization === "object") {
        const provisioned = packageManifest.localization
          ? localization.provision(manifest.pluginId, packageManifest)
          : typeof localization.clear === "function"
            ? localization.clear(manifest.pluginId)
            : { ok: true, backupPath: null };

        if (!provisioned || provisioned.ok === false) {
          return failure(
            "catalog_provision_failed",
            "Die Übersetzungskataloge konnten nicht bereitgestellt werden."
          );
        }
        catalogBackup = provisioned.backupPath || null;
        catalogsProvisioned = true;
      }

      renameWithRetry(pluginDirectory, paths.backup);
      movedToBackup = true;
      renameWithRetry(paths.staging, pluginDirectory);
      installed = true;

      const reloadResult = typeof reload === "function" ? await reload(manifest.pluginId) : { ok: true };
      if (reloadResult && reloadResult.ok === false) {
        const rolledBack = await this._rollback({
          pluginId: manifest.pluginId,
          pluginDirectory,
          backup: paths.backup,
          trash: paths.trash,
          reload,
          localization: catalogsProvisioned ? localization : null,
          catalogBackup
        });
        return rolledBack
          ? failure("install_failed_rolled_back", `Update fehlgeschlagen, vorherige Version wiederhergestellt: ${reloadResult.message || "unbekannter Fehler"}`)
          : failure("rollback_failed", "Update und Wiederherstellung sind fehlgeschlagen.", { backupPath: paths.backup });
      }

      removeDirectory(paths.trash);
      this.logger.info(`[PluginUpdate] ${manifest.pluginId} auf ${manifest.version} aktualisiert.`);
      return {
        ok: true,
        pluginId: manifest.pluginId,
        version: manifest.version,
        previousVersion: installedManifest.version,
        backupPath: paths.backup,
        permissions
      };
    } catch (error) {
      this.logger.error(`[PluginUpdate] Installation fehlgeschlagen (${manifest.pluginId}): ${error.message}`);
      if (installed) {
        const rolledBack = await this._rollback({
          pluginId: manifest.pluginId,
          pluginDirectory,
          backup: paths.backup,
          trash: paths.trash,
          reload,
          localization: catalogsProvisioned ? localization : null,
          catalogBackup
        });
        return rolledBack
          ? failure("install_failed_rolled_back", `Update fehlgeschlagen, vorherige Version wiederhergestellt: ${error.message}`)
          : failure("rollback_failed", "Update und Wiederherstellung sind fehlgeschlagen.", { backupPath: paths.backup });
      }
      if (movedToBackup) {
        try {
          renameWithRetry(paths.backup, pluginDirectory);
        } catch {
          return failure("rollback_failed", "Die vorherige Version konnte nicht zurückgeholt werden.", { backupPath: paths.backup });
        }
        if (catalogsProvisioned && localization && typeof localization.restore === "function") {
          localization.restore(manifest.pluginId, catalogBackup);
        }
      }
      return failure("install_failed", `Update fehlgeschlagen: ${error.message}`);
    } finally {
      removeDirectory(paths.staging);
    }
  }

  async _rollback({ pluginId, pluginDirectory, backup, trash, reload, localization, catalogBackup }) {
    try {
      if (fs.existsSync(pluginDirectory)) {
        fs.mkdirSync(path.dirname(trash), { recursive: true });
        removeDirectory(trash);
        renameWithRetry(pluginDirectory, trash);
      }
      renameWithRetry(backup, pluginDirectory);

      // Kataloge gehören zum Rollback: Die vorherige Version muss auch ihre
      // vorherigen Texte sehen.
      if (localization && typeof localization.restore === "function") {
        const restored = localization.restore(pluginId, catalogBackup);
        if (!restored || restored.ok === false) {
          this.logger.error("[PluginUpdate] Katalog-Rollback fehlgeschlagen.");
        }
      }

      const reloadResult = typeof reload === "function" ? await reload() : { ok: true };
      if (reloadResult && reloadResult.ok === false) {
        this.logger.error("[PluginUpdate] Rollback geladen, aber Plugin startet nicht.");
        removeDirectory(trash);
        return true;
      }
      removeDirectory(trash);
      this.logger.warn("[PluginUpdate] Rollback erfolgreich.");
      return true;
    } catch (error) {
      this.logger.error(`[PluginUpdate] Rollback fehlgeschlagen: ${error.message}`);
      return false;
    }
  }
}

module.exports = PluginPackageInstaller;
module.exports.renameWithRetry = renameWithRetry;
