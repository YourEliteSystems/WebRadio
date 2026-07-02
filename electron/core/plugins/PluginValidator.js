class PluginValidator {

    validate(manifest) {

        const errors = [];

        if (!manifest.id)
            errors.push("id fehlt");

        if (!manifest.name)
            errors.push("name fehlt");

        if (!manifest.version)
            errors.push("version fehlt");

        if (!manifest.main)
            errors.push("main fehlt");

        return {
            valid: errors.length === 0,
            errors
        };

    }

}

module.exports = new PluginValidator();