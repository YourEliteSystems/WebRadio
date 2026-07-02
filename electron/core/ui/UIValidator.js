const VALID_TYPES = [
    "page"
];

const VALID_RENDERERS = [
    "html",
    "react"
];

class UIValidator {

    validate(item = {}) {

        const errors = [];

        if (!item.id)
            errors.push("id fehlt");

        if (!item.type)
            errors.push("type fehlt");

        if (!VALID_TYPES.includes(item.type))
            errors.push(`Ungültiger Typ: ${item.type}`);

        if (!item.title)
            errors.push("title fehlt");

        if (!item.renderer)
            errors.push("renderer fehlt");

        if (!VALID_RENDERERS.includes(item.renderer))
            errors.push(`Ungültiger Renderer: ${item.renderer}`);

        if (
            item.renderer === "html" &&
            typeof item.render !== "function"
        ) {
            errors.push("HTML Renderer benötigt render()");
        }

        if (
            item.renderer === "react" &&
            !item.component
        ) {
            errors.push("React Renderer benötigt component");
        }

        return {
            valid: errors.length === 0,
            errors
        };

    }

}

module.exports = new UIValidator();