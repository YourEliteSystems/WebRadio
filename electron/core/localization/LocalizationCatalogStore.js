"use strict";

/**
 * LocalizationCatalogStore
 *
 * Einzige Laufzeitquelle für Übersetzungskataloge:
 *
 * ```text
 * userData/localization/
 * ├── de-DE.json
 * ├── en-US.json
 * ├── plugins/<plugin-id>/<locale>.json
 * └── themes/<theme-id>/<locale>.json
 * ```
 *
 * Die mitgelieferten Kataloge (`electron/core/localization/locales`) werden
 * ausschließlich zur **initialen Bereitstellung** und zur **kontrollierten
 * Wiederherstellung** gelesen. Im laufenden Betrieb liest die Anwendung
 * ausschließlich aus `userData`; es gibt keinen zweiten Ladepfad.
 *
 * Alle Schreibvorgänge sind atomar (temporäres Verzeichnis + Umbenennen) und
 * hinterlassen bei einem Fehler den vorherigen Zustand. Plugin- und
 * Theme-Kataloge liegen in getrennten Namensräumen; eine Operation für ein
 * Plugin kann niemals ein anderes Plugin oder die Anwendungskataloge
 * verändern.
 */

const fsDefault = require("fs");
const pathDefault = require("path");
const crypto = require("crypto");

const { validateCatalog } = require("./CatalogValidator");
const { validatePluginLocalization } = require("./PluginLocalization");
const { SUPPORTED_LOCALES } = require("./types");

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2})?$/;

function newId() {
  return crypto.randomBytes(6).toString("hex");
}

function stamp(now) {
  return now().toISOString().replace(/[:.]/g, "-");
}

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Ergaenzt fehlende Schluessel rekursiv, ohne vorhandene Werte zu
 * veraendern. Wird bei der Katalog-Aktualisierung bestehender
 * userData-Installationen verwendet.
 *
 * @param {object} target
 * @param {object} source
 * @returns {{catalog: object, changed: boolean}}
 */
function mergeMissingKeys(target, source) {
  let changed = false;
  const result = isPlainObject(target) ? { ...target } : {};

  for (const [key, value] of Object.entries(source || {})) {
    if (!(key in result)) {
      result[key] = value;
      changed = true;
      continue;
    }
    if (isPlainObject(result[key]) && isPlainObject(value)) {
      const merged = mergeMissingKeys(result[key], value);
      if (merged.changed) {
        result[key] = merged.catalog;
        changed = true;
      }
    }
  }

  return { catalog: result, changed };
}

class LocalizationCatalogStore {
  /**
   * @param {Object} options
   * @param {string} options.userDataPath
   * @param {string} options.bundledDir Verzeichnis der mitgelieferten Kataloge
   * @param {typeof import('fs')} [options.fsModule]
   * @param {typeof import('path')} [options.pathModule]
   * @param {() => Date} [options.now]
   * @param {(message: string) => void} [options.onWarning]
   */
  constructor(options = {}) {
    if (!options.userDataPath) throw new TypeError("LocalizationCatalogStore benötigt userDataPath");
    if (!options.bundledDir) throw new TypeError("LocalizationCatalogStore benötigt bundledDir");
    this._userDataPath = options.userDataPath;
    this._bundledDir = options.bundledDir;
    this._fs = options.fsModule || fsDefault;
    this._path = options.pathModule || pathDefault;
    this._now = options.now || (() => new Date());
    this._onWarning = options.onWarning || null;
  }

  get root() {
    return this._path.join(this._userDataPath, "localization");
  }

  get pluginsRoot() {
    return this._path.join(this.root, "plugins");
  }

  get themesRoot() {
    return this._path.join(this.root, "themes");
  }

  get backupsRoot() {
    return this._path.join(this.root, "backups");
  }

  // ─────────────────────────────────────────────
  // Anwendungskataloge
  // ─────────────────────────────────────────────

  /**
   * Stellt sicher, dass für alle unterstützten Sprachen gültige Kataloge in
   * `userData` liegen. Fehlende Dateien werden aus den mitgelieferten
   * Katalogen kopiert; ungültige Dateien werden gesichert und kontrolliert
   * wiederhergestellt.
   *
   * @param {string[]} [locales]
   * @returns {{ok:boolean, created:string[], restored:string[], errors:string[]}}
   */
  ensureAppCatalogs(locales = SUPPORTED_LOCALES) {
    const created = [];
    const restored = [];
    const updated = [];
    const errors = [];

    this._fs.mkdirSync(this.root, { recursive: true });

    for (const locale of locales) {
      if (!LOCALE_PATTERN.test(locale)) {
        errors.push(`Ungültige Locale: ${String(locale)}`);
        continue;
      }

      const target = this._path.join(this.root, `${locale}.json`);
      const bundled = this._path.join(this._bundledDir, `${locale}.json`);
      const exists = this._fs.existsSync(target);

      if (exists) {
        const current = this._readCatalog(target, locale);
        if (current.ok) {
          // Ein gueltiger Katalog bleibt die Laufzeitquelle. Neue Schluessel
          // aus dem mitgelieferten Katalog werden jedoch ergaenzt, damit
          // neue UI-Texte auch bei bestehender userData-Installation
          // ankommen. Vorhandene (ggf. vom Benutzer angepasste) Werte
          // werden dabei niemals ueberschrieben.
          const bundledSource = this._readCatalog(bundled, locale);
          if (bundledSource.ok) {
            const merged = mergeMissingKeys(current.catalog, bundledSource.catalog);
            if (merged.changed) {
              try {
                this._writeJsonAtomic(target, merged.catalog);
                updated.push(locale);
              } catch (error) {
                errors.push(`${locale}: neue Katalogschluessel konnten nicht ergaenzt werden (${error.message})`);
              }
            }
          }
          continue;
        }

        // Ungültige Datei sichern und mit dem mitgelieferten Katalog
        // wiederherstellen – niemals stillschweigend weiterverwenden.
        const backup = this._path.join(this.backupsRoot, `${locale}-${stamp(this._now)}.json`);
        try {
          this._fs.mkdirSync(this.backupsRoot, { recursive: true });
          this._fs.renameSync(target, backup);
        } catch (error) {
          errors.push(`${locale}: ungültiger Katalog konnte nicht gesichert werden (${error.message})`);
          continue;
        }
        errors.push(`${locale}: ungültiger Katalog gesichert (${backup})`);
      }

      const source = this._readCatalog(bundled, locale);
      if (!source.ok) {
        errors.push(`${locale}: mitgelieferter Katalog ist ungültig (${source.errors.join("; ")})`);
        continue;
      }

      try {
        this._writeJsonAtomic(target, source.catalog);
        if (exists) restored.push(locale);
        else created.push(locale);
      } catch (error) {
        errors.push(`${locale}: Katalog konnte nicht bereitgestellt werden (${error.message})`);
      }
    }

    for (const message of errors) this._warn(message);
    return { ok: errors.length === 0, created, restored, updated, errors };
  }

  /**
   * Lädt alle Anwendungskataloge aus `userData`.
   *
   * @param {string[]} [locales]
   * @returns {{resources: Record<string, Record<string, unknown>>, errors: string[]}}
   */
  loadAppCatalogs(locales = SUPPORTED_LOCALES) {
    const resources = {};
    const errors = [];

    for (const locale of locales) {
      const file = this._path.join(this.root, `${locale}.json`);
      const result = this._readCatalog(file, locale);
      if (result.ok) resources[locale] = result.catalog;
      else errors.push(`${locale}: ${result.errors.join("; ")}`);
    }

    return { resources, errors };
  }

  // ─────────────────────────────────────────────
  // Plugin-Kataloge
  // ─────────────────────────────────────────────

  /**
   * Schreibt die Übersetzungen eines Plugins in seinen Namensraum.
   * Vorhandene Kataloge werden als Backup aufbewahrt und können über
   * `restorePlugin` zurückgespielt werden.
   *
   * @param {string} pluginId
   * @param {unknown} localization Manifest-Deklaration
   * @returns {{ok:boolean, code?:string, message?:string, errors?:string[], backupPath?:string|null, keyCount?:number}}
   */
  provisionPlugin(pluginId, localization) {
    const idCheck = this._validateId(pluginId, "Plugin");
    if (!idCheck.ok) return idCheck;

    const validation = validatePluginLocalization(pluginId, localization);
    if (!validation.valid) {
      return failure("invalid_catalogs", `Ungültige Plugin-Kataloge: ${validation.errors.join("; ")}`, {
        errors: validation.errors
      });
    }

    const target = this._path.join(this.pluginsRoot, pluginId);
    const write = this._writeScope(target, validation.catalogs);
    if (!write.ok) return write;

    this._warn(
      `Plugin-Kataloge bereitgestellt: ${pluginId} (${Object.keys(validation.catalogs).join(", ")})`
    );

    return {
      ok: true,
      backupPath: write.backupPath,
      keyCount: validation.keyCount
    };
  }

  /**
   * Stellt den vorherigen Katalogzustand eines Plugins wieder her.
   *
   * @param {string} pluginId
   * @param {string|null} backupPath
   */
  restorePlugin(pluginId, backupPath) {
    const idCheck = this._validateId(pluginId, "Plugin");
    if (!idCheck.ok) return idCheck;
    if (!backupPath) {
      // Kein vorheriger Zustand: bereitgestellte Kataloge entfernen.
      return this.removePlugin(pluginId);
    }
    return this._restoreScope(this._path.join(this.pluginsRoot, pluginId), backupPath);
  }

  /**
   * Liest die Kataloge eines Plugins aus `userData`.
   *
   * @param {string} pluginId
   * @returns {Record<string, Record<string, unknown>>|null}
   */
  readPluginCatalogs(pluginId) {
    const idCheck = this._validateId(pluginId, "Plugin");
    if (!idCheck.ok) return null;
    return this._readScope(this._path.join(this.pluginsRoot, pluginId));
  }

  /**
   * Entfernt die Kataloge eines Plugins kontrolliert (Verschieben in den
   * Papierkorb, danach löschen). Andere Plugins bleiben unberührt.
   *
   * @param {string} pluginId
   */
  removePlugin(pluginId) {
    const idCheck = this._validateId(pluginId, "Plugin");
    if (!idCheck.ok) return idCheck;
    return this._removeScope(this._path.join(this.pluginsRoot, pluginId), `plugin-${pluginId}`);
  }

  /** @returns {string[]} */
  listPluginIds() {
    return this._listScopes(this.pluginsRoot);
  }

  /**
   * Entfernt die Kataloge eines Plugins, ohne sie zu löschen: Das Verzeichnis
   * wird als Backup verschoben und kann über `restorePlugin` zurückgespielt
   * werden (z. B. wenn eine neue Plugin-Version keine Übersetzungen mehr
   * deklariert).
   *
   * @param {string} pluginId
   * @returns {{ok:boolean, backupPath?:string|null, code?:string, message?:string}}
   */
  clearPlugin(pluginId) {
    const idCheck = this._validateId(pluginId, "Plugin");
    if (!idCheck.ok) return idCheck;

    const target = this._path.join(this.pluginsRoot, pluginId);
    if (!this._fs.existsSync(target)) return { ok: true, backupPath: null };

    const backup = `${target}.backup-${stamp(this._now)}-${newId()}`;
    try {
      this._fs.mkdirSync(this._path.dirname(backup), { recursive: true });
      this._fs.renameSync(target, backup);
      return { ok: true, backupPath: backup };
    } catch (error) {
      return failure("clear_failed", `Kataloge konnten nicht entfernt werden: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Theme-Kataloge
  // ─────────────────────────────────────────────

  /**
   * Theme-Kataloge werden nur für Metadaten (Name, Beschreibung,
   * Einstellungsbezeichnungen, Hilfetexte) verwendet – niemals für Code.
   *
   * @param {string} themeId
   * @param {unknown} localization
   */
  provisionTheme(themeId, localization) {
    const idCheck = this._validateId(themeId, "Theme");
    if (!idCheck.ok) return idCheck;

    // Themes nutzen dieselbe Validierung wie Plugins, aber einen eigenen
    // Namensraum; die Fehlermeldungen nennen die Theme-ID.
    const validation = validatePluginLocalization(themeId, localization);
    if (!validation.valid) {
      return failure("invalid_catalogs", `Ungültige Theme-Kataloge: ${validation.errors.join("; ")}`, {
        errors: validation.errors
      });
    }

    const target = this._path.join(this.themesRoot, themeId);
    return this._writeScope(target, validation.catalogs);
  }

  /** @param {string} themeId */
  readThemeCatalogs(themeId) {
    const idCheck = this._validateId(themeId, "Theme");
    if (!idCheck.ok) return null;
    return this._readScope(this._path.join(this.themesRoot, themeId));
  }

  /** @param {string} themeId */
  removeTheme(themeId) {
    const idCheck = this._validateId(themeId, "Theme");
    if (!idCheck.ok) return idCheck;
    return this._removeScope(this._path.join(this.themesRoot, themeId), `theme-${themeId}`);
  }

  // ─────────────────────────────────────────────
  // Interne Helfer
  // ─────────────────────────────────────────────

  _validateId(id, label) {
    if (typeof id !== "string" || !PLUGIN_ID_PATTERN.test(id)) {
      return failure("invalid_id", `Ungültige ${label}-ID: ${String(id)}`);
    }
    return { ok: true };
  }

  _readCatalog(file, locale) {
    let raw;
    try {
      raw = this._fs.readFileSync(file, "utf8");
    } catch (error) {
      return { ok: false, errors: [`Datei nicht lesbar (${error.message})`] };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, errors: [`kein gültiges JSON (${error.message})`] };
    }

    const validation = validateCatalog(parsed, locale);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    return { ok: true, catalog: parsed };
  }

  _writeJsonAtomic(target, value) {
    this._fs.mkdirSync(this._path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${newId()}`;
    this._fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    this._fs.renameSync(temporary, target);
  }

  /**
   * Schreibt einen kompletten Katalog-Namensraum atomar.
   * @returns {{ok:boolean, backupPath?:string|null, code?:string, message?:string}}
   */
  _writeScope(targetDir, catalogs) {
    const temporary = `${targetDir}.staging-${newId()}`;
    const backup = `${targetDir}.backup-${stamp(this._now)}-${newId()}`;
    const hadPrevious = this._fs.existsSync(targetDir);

    try {
      this._fs.mkdirSync(temporary, { recursive: true });
      for (const [locale, catalog] of Object.entries(catalogs)) {
        this._writeJsonAtomic(this._path.join(temporary, `${locale}.json`), catalog);
      }

      if (hadPrevious) {
        this._fs.mkdirSync(this._path.dirname(backup), { recursive: true });
        this._fs.renameSync(targetDir, backup);
      }

      this._fs.renameSync(temporary, targetDir);

      return { ok: true, backupPath: hadPrevious ? backup : null };
    } catch (error) {
      try {
        this._fs.rmSync(temporary, { recursive: true, force: true });
      } catch { /* best effort */ }
      // Falls das Ziel bereits verschoben wurde, zurückholen.
      if (hadPrevious && !this._fs.existsSync(targetDir) && this._fs.existsSync(backup)) {
        try {
          this._fs.renameSync(backup, targetDir);
        } catch { /* siehe Meldung */ }
      }
      return failure("write_failed", `Kataloge konnten nicht geschrieben werden: ${error.message}`);
    }
  }

  _restoreScope(targetDir, backupPath) {
    if (typeof backupPath !== "string" || !this._fs.existsSync(backupPath)) {
      return failure("backup_missing", "Der vorherige Katalogzustand ist nicht mehr vorhanden.");
    }
    try {
      if (this._fs.existsSync(targetDir)) {
        this._fs.rmSync(targetDir, { recursive: true, force: true });
      }
      this._fs.renameSync(backupPath, targetDir);
      return { ok: true };
    } catch (error) {
      return failure("restore_failed", `Kataloge konnten nicht wiederhergestellt werden: ${error.message}`);
    }
  }

  _readScope(dir) {
    let entries;
    try {
      entries = this._fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    const catalogs = {};
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const locale = this._path.basename(entry.name, ".json");
      if (!LOCALE_PATTERN.test(locale)) continue;
      const result = this._readCatalog(this._path.join(dir, entry.name), locale);
      if (result.ok) catalogs[locale] = result.catalog;
      else this._warn(`${dir}/${entry.name}: ${result.errors.join("; ")}`);
    }

    return Object.keys(catalogs).length > 0 ? catalogs : null;
  }

  _removeScope(dir, prefix) {
    if (!this._fs.existsSync(dir)) return { ok: true, removed: false };
    const trash = this._path.join(this.root, "trash", `${prefix}-${stamp(this._now)}-${newId()}`);
    try {
      this._fs.mkdirSync(this._path.dirname(trash), { recursive: true });
      this._fs.renameSync(dir, trash);
    } catch (error) {
      return failure("remove_failed", `Kataloge konnten nicht entfernt werden: ${error.message}`);
    }
    try {
      this._fs.rmSync(trash, { recursive: true, force: true });
    } catch (error) {
      // Kontrollierte Entfernung: Der Papierkorb bleibt liegen und kann
      // manuell geleert werden; das ist kein Fehlerfall für den Aufrufer.
      this._warn(`Katalog-Papierkorb konnte nicht geleert werden: ${error.message}`);
    }
    return { ok: true, removed: true };
  }

  _listScopes(dir) {
    try {
      return this._fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.includes(".staging-") && !entry.name.includes(".backup-"))
        .map((entry) => entry.name)
        .filter((name) => PLUGIN_ID_PATTERN.test(name))
        .sort();
    } catch {
      return [];
    }
  }

  _warn(message) {
    if (typeof this._onWarning === "function") this._onWarning(message);
  }
}

module.exports = { LocalizationCatalogStore, PLUGIN_ID_PATTERN, LOCALE_PATTERN };
