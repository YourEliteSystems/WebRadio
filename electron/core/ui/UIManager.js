const UIRegistry = require("./UIRegistry");
const UIValidator = require("./UIValidator");

class UIManager {

    register(item, plugin = {}) {

        const validation = UIValidator.validate(item);

        if (!validation.valid) {
            throw new Error(
                `UI-Element ungültig:\n${validation.errors.join("\n")}`
            );
        }

        if (UIRegistry.get(item.id)) {
            throw new Error(
                `UI-Element "${item.id}" ist bereits registriert.`
            );
        }

        UIRegistry.register({
            ...item,

            pluginId: plugin.id ?? null,
            source: plugin.source ?? "core",
            version: plugin.version ?? "1.0.0",
            createdAt: Date.now()
        });

    }

    unregister(id) {

        UIRegistry.unregister(id);

    }

    unregisterPlugin(pluginId) {

        UIRegistry.clearPlugin(pluginId);

    }

    get(id) {

        return UIRegistry.get(id);

    }

    getAll() {

        return UIRegistry.getAll();

    }

    getByType(type) {

        return UIRegistry.getByType(type);

    }

}

module.exports = new UIManager();