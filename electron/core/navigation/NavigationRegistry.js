"use strict";

const NavigationValidator = require("./NavigationValidator");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("NavigationRegistry");

class NavigationRegistry {

    constructor() {
        this.sections = new Map();
        this.items = new Map();
    }

    /**
     * Registriert eine Navigations-Section.
     * @param {Object} section 
     * @param {string|null} ownerPluginId 
     * @returns {Object} Registrierte Section
     */
    registerSection(section, ownerPluginId = null) {
        const validation = NavigationValidator.validateSection(section);
        if (!validation.valid) {
            const msg = `Ungültige Section-Definition (${section?.id || 'unknown'}):\n${validation.errors.join("\n")}`;
            logger.error(msg);
            throw new Error(msg);
        }

        const existing = this.sections.get(section.id);
        if (existing) {
            if (existing.ownerPluginId !== ownerPluginId) {
                const msg = `Section mit ID "${section.id}" existiert bereits und gehört "${existing.ownerPluginId || 'core'}".`;
                logger.warn(`[NavigationRegistry] ${msg}`);
                throw new Error(msg);
            }
            // Idempotente Aktualisierung durch denselben Owner
            const updated = {
                ...existing,
                ...section,
                ownerPluginId,
                updatedAt: Date.now()
            };
            this.sections.set(section.id, updated);
            logger.debug(`Section "${section.id}" aktualisiert von "${ownerPluginId || 'core'}".`);
            return updated;
        }

        const entry = {
            id: section.id,
            label: section.label,
            icon: section.icon || null,
            collapsible: section.collapsible ?? true,
            expanded: section.expanded ?? true,
            order: typeof section.order === "number" ? section.order : 100,
            visible: section.visible ?? true,
            ownerPluginId,
            createdAt: Date.now()
        };

        this.sections.set(section.id, entry);
        logger.info(`Section "${entry.id}" (${entry.label}) registriert von "${ownerPluginId || 'core'}".`);
        return entry;
    }

    /**
     * Registriert ein Navigations-Item (mit oder ohne übergeordnete Section).
     * @param {Object} item 
     * @param {string|null} ownerPluginId 
     * @returns {Object} Registriertes Item
     */
    registerItem(item, ownerPluginId = null) {
        const validation = NavigationValidator.validateItem(item);
        if (!validation.valid) {
            const msg = `Ungültige Item-Definition (${item?.id || 'unknown'}):\n${validation.errors.join("\n")}`;
            logger.error(msg);
            throw new Error(msg);
        }

        // Falls parent angegeben ist, muss die Ziel-Section existieren
        const parentId = item.parent || null;
        if (parentId && !this.sections.has(parentId)) {
            const msg = `Parent-Section "${parentId}" existiert nicht für Item "${item.id}".`;
            logger.error(`[NavigationRegistry] ${msg}`);
            throw new Error(msg);
        }

        const existing = this.items.get(item.id);
        if (existing) {
            if (existing.ownerPluginId !== ownerPluginId) {
                const msg = `Navigation-Item mit ID "${item.id}" existiert bereits und gehört "${existing.ownerPluginId || 'core'}".`;
                logger.warn(`[NavigationRegistry] ${msg}`);
                throw new Error(msg);
            }
            // Idempotente Aktualisierung durch denselben Owner
            const updated = {
                ...existing,
                ...item,
                parent: parentId,
                ownerPluginId,
                updatedAt: Date.now()
            };
            this.items.set(item.id, updated);
            logger.debug(`Item "${item.id}" aktualisiert von "${ownerPluginId || 'core'}".`);
            return updated;
        }

        const entry = {
            id: item.id,
            parent: parentId,
            label: item.label,
            icon: item.icon || null,
            route: item.route || item.id,
            order: typeof item.order === "number" ? item.order : 100,
            visible: item.visible ?? true,
            disabled: item.disabled ?? false,
            ownerPluginId,
            createdAt: Date.now()
        };

        this.items.set(item.id, entry);
        logger.info(`Item "${entry.id}" (${entry.label})${parentId ? ` unter "${parentId}"` : ' (Top-Level)'} registriert von "${ownerPluginId || 'core'}".`);
        return entry;
    }

    /**
     * Aktualisiert ein bestehendes Item.
     * @param {string} id 
     * @param {Object} updates 
     * @param {string|null} ownerPluginId 
     */
    updateItem(id, updates = {}, ownerPluginId = null) {
        const item = this.items.get(id);
        if (!item) {
            throw new Error(`Item mit ID "${id}" wurde nicht gefunden.`);
        }

        if (ownerPluginId !== null && ownerPluginId !== "core" && item.ownerPluginId !== ownerPluginId) {
            throw new Error(`Keine Berechtigung: Item "${id}" gehört nicht zu "${ownerPluginId}".`);
        }

        if (updates.parent && !this.sections.has(updates.parent)) {
            throw new Error(`Parent-Section "${updates.parent}" existiert nicht.`);
        }

        const updated = {
            ...item,
            ...updates,
            id: item.id, // ID unveränderlich
            ownerPluginId: item.ownerPluginId,
            updatedAt: Date.now()
        };

        this.items.set(id, updated);
        logger.debug(`Item "${id}" aktualisiert.`);
        return updated;
    }

    /**
     * Entfernt ein Item anhand seiner ID.
     * @param {string} id 
     * @param {string|null} ownerPluginId 
     */
    removeItem(id, ownerPluginId = null) {
        const item = this.items.get(id);
        if (!item) return false;

        if (ownerPluginId !== null && ownerPluginId !== "core" && item.ownerPluginId !== ownerPluginId) {
            throw new Error(`Keine Berechtigung: Item "${id}" gehört nicht zu "${ownerPluginId}".`);
        }

        this.items.delete(id);
        logger.info(`Item "${id}" entfernt.`);
        return true;
    }

    /**
     * Entfernt eine Section und alle darin enthaltenen Items.
     * @param {string} id 
     * @param {string|null} ownerPluginId 
     */
    removeSection(id, ownerPluginId = null) {
        const section = this.sections.get(id);
        if (!section) return false;

        if (ownerPluginId !== null && ownerPluginId !== "core" && section.ownerPluginId !== ownerPluginId) {
            throw new Error(`Keine Berechtigung: Section "${id}" gehört nicht zu "${ownerPluginId}".`);
        }

        // Zugehörige Items entfernen
        for (const [itemId, item] of this.items) {
            if (item.parent === id) {
                this.items.delete(itemId);
            }
        }

        this.sections.delete(id);
        logger.info(`Section "${id}" und zugehörige Items entfernt.`);
        return true;
    }

    /**
     * Entfernt alle Einträge (Sections und Items), die einem bestimmten Plugin gehören.
     * @param {string} pluginId 
     */
    clearPlugin(pluginId) {
        let removedItemsCount = 0;
        let removedSectionsCount = 0;

        // 1. Items des Plugins entfernen
        for (const [id, item] of this.items) {
            if (item.ownerPluginId === pluginId) {
                this.items.delete(id);
                removedItemsCount++;
            }
        }

        // 2. Sections des Plugins entfernen (und ggf. darin verbliebene Items)
        for (const [id, section] of this.sections) {
            if (section.ownerPluginId === pluginId) {
                for (const [itemId, item] of this.items) {
                    if (item.parent === id) {
                        this.items.delete(itemId);
                        removedItemsCount++;
                    }
                }
                this.sections.delete(id);
                removedSectionsCount++;
            }
        }

        if (removedItemsCount > 0 || removedSectionsCount > 0) {
            logger.info(`Plugin "${pluginId}" bereinigt: ${removedSectionsCount} Sections, ${removedItemsCount} Items entfernt.`);
        }
    }

    /**
     * Gibt den vollständigen Navigationsbaum zurück:
     * - sections: sortierte Sections mit ihren sichtbaren Items
     * - topLevelItems: sortierte Items ohne Parent
     */
    getTree() {
        const sectionsList = [...this.sections.values()]
            .filter(sec => sec.visible !== false)
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
            .map(sec => ({
                ...sec,
                type: 'section',
                items: [...this.items.values()]
                    .filter(item => item.parent === sec.id && item.visible !== false)
                    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
            }));

        const topLevelItems = [...this.items.values()]
            .filter(item => (!item.parent || item.parent === null) && item.visible !== false)
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
            .map(item => ({
                ...item,
                type: 'item'
            }));

        return {
            sections: sectionsList,
            topLevelItems: topLevelItems
        };
    }

    getSection(id) {
        return this.sections.get(id) || null;
    }

    getItem(id) {
        return this.items.get(id) || null;
    }

    getAllSections() {
        return [...this.sections.values()]
            .filter(sec => sec.visible !== false)
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }

    getItemsBySection(sectionId) {
        return [...this.items.values()]
            .filter(item => item.parent === sectionId && item.visible !== false)
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }

    getTopLevelItems() {
        return [...this.items.values()]
            .filter(item => (!item.parent || item.parent === null) && item.visible !== false)
            .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    }

    clearAll() {
        this.sections.clear();
        this.items.clear();
    }

}

module.exports = new NavigationRegistry();
