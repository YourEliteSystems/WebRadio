"use strict";

class NavigationValidator {

    /**
     * Validiert eine Navigations-Section.
     * @param {Object} section 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validateSection(section = {}) {
        const errors = [];

        if (!section.id || typeof section.id !== "string" || section.id.trim() === "") {
            errors.push("Section 'id' fehlt oder ist ungültig.");
        }

        if (!section.label || typeof section.label !== "string" || section.label.trim() === "") {
            errors.push("Section 'label' fehlt oder ist ungültig.");
        }

        if (section.order !== undefined && typeof section.order !== "number") {
            errors.push("Section 'order' muss eine Zahl sein.");
        }

        if (section.collapsible !== undefined && typeof section.collapsible !== "boolean") {
            errors.push("Section 'collapsible' muss ein Boolean sein.");
        }

        if (section.expanded !== undefined && typeof section.expanded !== "boolean") {
            errors.push("Section 'expanded' muss ein Boolean sein.");
        }

        if (section.visible !== undefined && typeof section.visible !== "boolean") {
            errors.push("Section 'visible' muss ein Boolean sein.");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validiert ein Navigations-Item.
     * @param {Object} item 
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validateItem(item = {}) {
        const errors = [];

        if (!item.id || typeof item.id !== "string" || item.id.trim() === "") {
            errors.push("Item 'id' fehlt oder ist ungültig.");
        }

        // parent ist optional: wenn vorhanden, muss es ein valider String sein
        if (item.parent !== undefined && item.parent !== null && (typeof item.parent !== "string" || item.parent.trim() === "")) {
            errors.push("Item 'parent' muss ein gültiger String sein.");
        }

        if (!item.label || typeof item.label !== "string" || item.label.trim() === "") {
            errors.push("Item 'label' fehlt oder ist ungültig.");
        }

        if (item.order !== undefined && typeof item.order !== "number") {
            errors.push("Item 'order' muss eine Zahl sein.");
        }

        if (item.visible !== undefined && typeof item.visible !== "boolean") {
            errors.push("Item 'visible' muss ein Boolean sein.");
        }

        if (item.disabled !== undefined && typeof item.disabled !== "boolean") {
            errors.push("Item 'disabled' muss ein Boolean sein.");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

}

module.exports = new NavigationValidator();
