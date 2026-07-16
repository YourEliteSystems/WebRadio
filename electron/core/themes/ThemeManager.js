const ThemeLoader = require("./ThemeLoader");
const StorageManager = require("../storage/StorageManager");

class ThemeManager {

    constructor() {

        this.themes = new Map();
        this.initialized = false;

    }

    //
    // Lifecycle
    //

    initialize() {

        if (this.initialized) {
            return;
        }

        this.loadThemes();

        this.initialized = true;

    }

    shutdown() {

        this.unloadThemes();

        this.themes.clear();

        this.initialized = false;

    }

    //
    // Theme Loading
    //

    async loadThemes() {

        const themes = ThemeLoader.discoverThemes(StorageManager.getThemePath());
        //console.log("Themes geladen:", themes);
        //console.log("Ist Array:", Array.isArray(themes));
        for (const theme of themes) {

            this.themes.set(
                theme.id,
                theme
            );

        }

    }

    unloadThemes() {

        for (const theme of this.themes.values()) {

            ThemeRuntime.stop(theme);

        }

    }

    //
    // Theme Control
    //

    enableTheme(id) {

        const theme = this.themes.get(id);

        if (!theme) {
            return false;
        }

        return ThemeRuntime.start(theme);

    }

    disableTheme(id) {

        const theme = this.themes.get(id);

        if (!theme) {
            return false;
        }

        return ThemeRuntime.stop(theme);

    }

    reloadTheme(id) {

        const theme = this.themes.get(id);

        if (!theme) {
            return false;
        }

        this.disableTheme(id);

        return this.enableTheme(id);

    }

    //
    // Getters
    //

    getTheme(id) {

        return this.themes.get(id);

    }

    getThemes() {

        return [...this.themes.values()];

    }

    hasTheme(id) {

        return this.themes.has(id);

    }

    isInitialized() {

        return this.initialized;

    }

}

module.exports = new ThemeManager();