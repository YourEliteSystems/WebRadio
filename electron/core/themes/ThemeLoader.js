const fs = require("fs");
const path = require("path");

const ThemeValidator = require("./ThemeValidator");

class ThemeLoader {

  constructor(themesPath) {
    this.themesPath = themesPath;

    this.validator = new ThemeValidator();
  }

  discoverThemes() {

    if (!fs.existsSync(this.themesPath)) {
      return [];
    }

    const folders = fs.readdirSync(
      this.themesPath,
      { withFileTypes: true }
    );

    const themes = [];

    for (const folder of folders) {

      if (!folder.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(
        this.themesPath,
        folder.name,
        "theme.json"
      );

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, "utf8")
      );

      const validation = this.validator.validate(manifest);
      if(!validation.valid) {
        console.error(
          `[ThemeLoader] Fehler bei ${folder.name}:`,
          validation.errors
        );
        continue;
      }
      try {

        const manifest = JSON.parse(
          fs.readFileSync(manifestPath, "utf8")
        );

        const cssFile =
          manifest.css ||
          "variables.css";

        themes.push({
          id: manifest.id || folder.name,
          name: manifest.name || folder.name,
          version: manifest.version || "1.0.0",
          author: manifest.author || "",
          description: manifest.description || "",
          preview: manifest.preview || "",
          css: path.join(
            this.themesPath,
            folder.name,
            cssFile
          )
        });

      } catch (err) {

        console.error(
          `[ThemeLoader] Fehler bei ${folder.name}`,
          err
        );

      }

    }

    return themes;

  }

}

module.exports = new ThemeLoader();