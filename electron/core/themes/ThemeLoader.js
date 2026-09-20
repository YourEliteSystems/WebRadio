const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const ThemeValidator = require("./ThemeValidator");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ThemeLoader");

class ThemeLoader {

  constructor() {
    this.validator = new ThemeValidator();
  }

  getBuiltinThemesPath() {
    // Development: Projektverzeichnis themes/
    // Production: resources/themes (gepackt)
    if (!app || typeof app.isPackaged !== "boolean" || !app.isPackaged) {
      return path.join(process.cwd(), "themes");
    }

    // Production: resources/themes
    const resourcesPath = path.join(process.resourcesPath, "themes");
    if (fs.existsSync(resourcesPath)) {
      return resourcesPath;
    }

    // Fallback: Wenn keine built-in Themes existieren, leeren String zurückgeben
    return "";
  }

  getUserThemesPath() {
    // User-Verzeichnis: userData/themes
    return path.join(app.getPath("userData"), "themes");
  }

  getBuiltInThemes() {
    const builtinPath = this.getBuiltinThemesPath();
    if (builtinPath && fs.existsSync(builtinPath)) {
      return this.scanDirectory(builtinPath, "builtin");
    }
    return [];
  }

  discoverThemes() {
    const themes = [];

    // 1. Built-in Themes scannen
    const builtinPath = this.getBuiltinThemesPath();
    if (builtinPath && fs.existsSync(builtinPath)) {
      const builtinThemes = this.scanDirectory(builtinPath, "builtin");
      themes.push(...builtinThemes);
      logger.info(`[ThemeLoader] Built-in Themes aus ${builtinPath} geladen`);
    } else {
      logger.warn(`[ThemeLoader] Built-in Themes Pfad nicht gefunden: ${builtinPath}`);
    }

    // 2. User Themes scannen
    const userPath = this.getUserThemesPath();
    // User-Verzeichnis erstellen falls nicht vorhanden
    if (!fs.existsSync(userPath)) {
      try {
        fs.mkdirSync(userPath, { recursive: true });
        logger.info(`[ThemeLoader] User-Theme-Verzeichnis erstellt: ${userPath}`);
      } catch (err) {
        logger.error(`[ThemeLoader] Konnte User-Theme-Verzeichnis nicht erstellen: ${err.message}`);
      }
    }

    if (fs.existsSync(userPath)) {
      const userThemes = this.scanDirectory(userPath, "user");
      themes.push(...userThemes);
      logger.info(`[ThemeLoader] User Themes aus ${userPath} geladen`);
    }

    // 3. User Themes override Built-in Themes mit gleicher ID
    const themeMap = new Map();
    for (const theme of themes) {
      // User-Theme überschreibt Built-in Theme
      if (!themeMap.has(theme.id) || theme.source === "user") {
        themeMap.set(theme.id, theme);
      }
    }

    const finalThemes = [...themeMap.values()];
    logger.info(`[ThemeLoader] ${finalThemes.length} Themes gefunden (Built-in + User)`);
    return finalThemes;
  }

  scanDirectory(themesPath, source) {
    const themes = [];

    if (!fs.existsSync(themesPath)) {
      return themes;
    }

    const folders = fs.readdirSync(
      themesPath,
      { withFileTypes: true }
    );

    for (const folder of folders) {
      if (!folder.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(
        themesPath,
        folder.name,
        "theme.json"
      );

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      try {
        const manifest = JSON.parse(
          fs.readFileSync(manifestPath, "utf8")
        );

        const validation = this.validator.validate(manifest);
        if (!validation.valid) {
          logger.error(
            `[ThemeLoader] Fehler bei ${folder.name}:`,
            validation.errors
          );
          continue;
        }

        const cssFile = manifest.css || "style.css";

        themes.push({
          id: manifest.id || folder.name,
          name: manifest.name || folder.name,
          version: manifest.version || "1.0.0",
          author: manifest.author || "",
          description: manifest.description || "",
          preview: manifest.preview || "",
          css: path.join(
            themesPath,
            folder.name,
            cssFile
          ),
          source: source,
          path: path.join(themesPath, folder.name)
        });

      } catch (err) {
        logger.error(
          `[ThemeLoader] Fehler bei ${folder.name}`,
          err
        );
      }
    }

    return themes;
  }

}

module.exports = new ThemeLoader();