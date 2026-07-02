class ThemeValidator {

  validate(manifest = {}) {

    const errors = [];

    if (!manifest.name) {
      errors.push("Missing field: name");
    }

    if (
      manifest.id &&
      !/^[a-z0-9-_]+$/i.test(manifest.id)
    ) {
      errors.push(
        "Theme id contains invalid characters"
      );
    }

    if (
      manifest.version &&
      typeof manifest.version !== "string"
    ) {
      errors.push(
        "Version must be a string"
      );
    }

    if (
      manifest.css &&
      typeof manifest.css !== "string"
    ) {
      errors.push(
        "CSS file must be a string"
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };

  }

}

module.exports = ThemeValidator;