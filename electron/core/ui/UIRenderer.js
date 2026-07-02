const HtmlRenderer = require("./HtmlRenderer");
const ReactRenderer = require("./ReactRenderer");

class UIRenderer {

    constructor() {

        this.renderers = new Map();

        this.register(
            "html",
            HtmlRenderer
        );

        this.register(
            "react",
            ReactRenderer
        );

    }

    register(name, renderer) {

        this.renderers.set(
            name,
            renderer
        );

    }

    render(item, container) {

        const renderer =
            this.renderers.get(item.renderer);

        if (!renderer) {
            throw new Error(
                `Renderer "${item.renderer}" existiert nicht.`
            );
        }

        renderer.render(
            item,
            container
        );

    }

}

module.exports = new UIRenderer();