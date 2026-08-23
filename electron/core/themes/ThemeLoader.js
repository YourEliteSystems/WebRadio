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

  getThemesPath() {
    // Development: Projektverzeichnis themes/
    // Production: resources/themes (gepackt) oder userData/themes (user themes)
    if (!app || typeof app.isPackaged !== "boolean" || !app.isPackaged) {
      return path.join(process.cwd(), "themes");
    }

    // Production: Zuerst resources/themes prüfen, dann userData/themes
    const resourcesPath = path.join(process.resourcesPath, "themes");
    if (fs.existsSync(resourcesPath)) {
      return resourcesPath;
    }

    // Fallback: userData/themes
    const userDataPath = path.join(app.getPath("userData"), "themes");
    return userDataPath;
  }

  discoverThemes() {
    const themesPath = this.getThemesPath();

    if (!fs.existsSync(themesPath)) {
      logger.warn(`[ThemeLoader] Theme-Verzeichnis nicht gefunden: ${themesPath}`);
      return [];
    }

    const folders = fs.readdirSync(
      themesPath,
      { withFileTypes: true }
    );

    const themes = [];

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
          )
        });

      } catch (err) {
        logger.error(
          `[ThemeLoader] Fehler bei ${folder.name}`,
          err
        );
      }
    }

    logger.info(`[ThemeLoader] ${themes.length} Themes gefunden in ${themesPath}`);
    return themes;
  }

}

module.exports = new ThemeLoader();