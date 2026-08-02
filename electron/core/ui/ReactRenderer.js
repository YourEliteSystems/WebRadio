const React = require("react");
const { createRoot } = require("react-dom/client");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("ReactRenderer");

class ReactRenderer {
    constructor() {
        this.roots = new Map(); // container -> root
    }

    render(Component, container, props = {}) {
        if (!container) {
            throw new Error("ReactRenderer: Container ist undefined");
        }

        if (!Component) {
            throw new Error("ReactRenderer: Component ist undefined");
        }

        // Falls bereits etwas gerendert wurde → ersetzen
        if (this.roots.has(container)) {
            this.unmount(container);
        }

        const root = createRoot(container);

        root.render(React.createElement(Component, props));

        this.roots.set(container, root);
    }

    unmount(container) {
        const root = this.roots.get(container);

        if (!root) return;

        try {
            root.unmount();
        } catch (err) {
            logger.error("ReactRenderer unmount error:", err);
        }

        this.roots.delete(container);
    }

    unmountAll() {
        for (const [container, root] of this.roots.entries()) {
            try {
                root.unmount();
            } catch (err) {
                logger.error("ReactRenderer unmountAll error:", err);
            }
        }

        this.roots.clear();
    }
}

module.exports = new ReactRenderer();