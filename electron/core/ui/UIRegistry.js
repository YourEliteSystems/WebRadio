class UIRegistry {

    constructor() {
        this.items = new Map();
    }

    register(item) {

        this.items.set(
            item.id,
            item
        );

    }

    unregister(id) {

        this.items.delete(id);

    }

    get(id) {

        return this.items.get(id);

    }

    getAll() {

        return [...this.items.values()];

    }

    getByType(type) {

        return this.getAll().filter(
            item => item.type === type
        );

    }

    clearPlugin(pluginId) {

        for (const [id, item] of this.items) {

            if (item.pluginId === pluginId) {
                this.items.delete(id);
            }

        }

    }

}

module.exports = new UIRegistry();