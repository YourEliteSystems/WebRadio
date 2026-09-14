const ThemeLoader = require("./ThemeLoader");
const eventBus = require("../eventBus");
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

    /**
     * Theme-Rescan: scannt Built-in und User-Theme-Verzeichnisse erneut
     * und führt den Zustand mit dem aktuellen Dateisystem-Zustand zusammen.
     *
     * Analog zu PluginManager.reloadPlugins()
     */
    reloadThemes() {
        const discovered = ThemeLoader.discoverThemes();

        const result = {
            success: true,
            added: [],
            removed: [],
            changed: [],
            unchanged: [],
            errors: []
        };

        const themeIdOf = (t) => t?.id;

        // Snapshot der aktuell geladenen Themes nach ID
        const currentThemes = new Map();
        for (const theme of this.themes.values()) {
            const id = themeIdOf(theme);
            if (id) currentThemes.set(id, theme);
        }

        // Snapshot der neu entdeckten Themes nach ID
        const discoveredThemes = new Map();
        for (const theme of discovered) {
            const id = themeIdOf(theme);
            if (!id) {
                logger.warn("Theme ohne ID beim Rescan übersprungen");
                continue;
            }
            discoveredThemes.set(id, theme);
        }

        // 1) Discovery-Scan: neue und geänderte Themes behandeln
        for (const [id, newTheme] of discoveredThemes) {
            const currentTheme = currentThemes.get(id);

            if (!currentTheme) {
                // Neues Theme
                this.themes.set(id, newTheme);
                result.added.push(id);
                logger.info(
                    `Theme neu geladen (Rescan): ${newTheme.name || id}`
                );
            } else {
                // Existierendes Theme: Prüfen ob sich etwas geändert hat
                const oldCss = currentTheme.css;
                const newCss = newTheme.css;
                const oldSource = currentTheme.source;
                const newSource = newTheme.source;

                if (oldCss !== newCss || oldSource !== newSource) {
                    this.themes.set(id, newTheme);
                    result.changed.push(id);
                    logger.info(
                        `Theme geändert (Rescan): ${newTheme.name || id}`
                    );
                } else {
                    result.unchanged.push(id);
                }
            }
        }

        // 2) Im aktuellen Lauf entfernte Themes aus der Registry löschen
        for (const [id, theme] of currentThemes) {
            if (!discoveredThemes.has(id)) {
                this.themes.delete(id);
                result.removed.push(id);
                logger.info(
                    `Theme entfernt (Rescan): ${theme?.name || id}`
                );
            }
        }

        // Falls einzelne Operationen Fehler verursacht haben: success = false
        if (result.errors.length > 0) {
            result.success = false;
        }

        // EventBus Event für interne Konsumenten
        eventBus.emit("themes:changed", result);

        logger.info(
            `Theme-Rescan abgeschlossen: ` +
            `${result.added.length} neu, ${result.removed.length} entfernt, ` +
            `${result.changed.length} geändert, ${result.unchanged.length} unverändert, ` +
            `${result.errors.length} Fehler`
        );

        return result;
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