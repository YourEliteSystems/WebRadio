const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const storage = require("../storage");
const eventBus = require("../eventBus");

function registerThemeHandlers(isDev) {

  ipcMain.handle("theme:get", async () => {

    const themesPath = isDev
      ? path.join(__dirname, "../../../themes")
      : path.join(process.resourcesPath, "themes");

    if (!fs.existsSync(themesPath)) {
      return [];
    }

    const folders = fs.readdirSync(themesPath, {
      withFileTypes: true
    });

    const themes = [];

    for (const folder of folders) {

      if (!folder.isDirectory()) {
        continue;
      }

      const themeJsonPath = path.join(
        themesPath,
        folder.name,
        "theme.json"
      );

      if (!fs.existsSync(themeJsonPath)) {
        continue;
      }

      try {

        const data = JSON.parse(
          fs.readFileSync(themeJsonPath, "utf8")
        );

        const cssAbsPath = path.join(
          themesPath,
          folder.name,
          data.css
        );

        themes.push({
          id: folder.name,
          name: data.name,
          css: cssAbsPath
        });

      } catch (err) {

        console.error(
          `Theme konnte nicht geladen werden: ${folder.name}`,
          err
        );

      }
    }

    return themes;
  });

  ipcMain.handle("theme:getActive", () => {
    return storage.getSettings()?.theme || "";
  });

  ipcMain.handle("theme:setActive", (_, themeId) => {

    storage.updateSettings({
      theme: themeId
    });

    eventBus.emit("themechange", {
      theme: themeId
    });

    return true;
  });

}

module.exports = registerThemeHandlers;