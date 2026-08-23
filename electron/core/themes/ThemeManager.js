const ThemeLoader = require("./ThemeLoader");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ThemeManager");

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
        logger.info("ThemeManager initialisiert.");
    }

    shutdown() {
        this.themes.clear();
        this.initialized = false;
        logger.info("ThemeManager heruntergefahren.");
    }

    //
    // Theme Loading
    //

    loadThemes() {
        const themes = ThemeLoader.discoverThemes();
        
        for (const theme of themes) {
            this.themes.set(theme.id, theme);
        }
        
        logger.info(`${themes.length} Themes geladen.`);
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