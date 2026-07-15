# Theme Manifest

Every WebRadio theme must contain a `theme.json` file.

The manifest provides all information required by the ThemeManager to discover, validate and load a theme.

Without a valid manifest, a theme cannot be loaded.

---

# Purpose

The theme manifest identifies your theme and tells WebRadio how it should be loaded.

It contains information such as:

* Theme ID
* Theme name
* Version
* Author
* Description
* Entry stylesheet
* Compatibility information

---

# Minimal Manifest

The smallest valid theme manifest looks like this:

```json
{
    "id": "my-theme",
    "name": "My Theme",
    "version": "1.0.0",
    "css": "variables.css"
}
```

This is enough for a simple theme.

---

# Complete Example

A more complete theme manifest may look like this:

```json
{
    "id": "midnight-blue",
    "name": "Midnight Blue",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "A modern dark theme for WebRadio.",
    "css": "variables.css",
    "preview": "preview.png",
    "homepage": "https://github.com/YourName/MidnightBlue",
    "license": "MIT",
    "keywords": [
        "dark",
        "modern",
        "blue"
    ],
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

Most fields are optional, but recommended.

---

# Manifest Fields

## id

A unique identifier for the theme.

Requirements:

* Lowercase letters
* Numbers
* Hyphens allowed
* Must remain stable after publishing

Example:

```text
midnight-blue
```

---

## name

The display name shown inside WebRadio.

Example:

```text
Midnight Blue
```

---

## version

The theme version following Semantic Versioning.

Examples:

```text
1.0.0
1.2.1
2.0.0
```

---

## author

The creator of the theme.

Example:

```text
John Doe
```

---

## description

A short explanation of the theme.

Keep descriptions concise and informative.

---

## css

The main stylesheet that WebRadio loads.

Example:

```text
variables.css
```

Only one entry stylesheet is required.

Additional CSS files may be imported from there.

---

## preview

An optional preview image shown inside the Theme Manager.

Example:

```text
preview.png
```

Recommended size:

* 1280 × 720 px
* PNG format

---

## homepage

An optional project homepage.

Usually a GitHub repository or project website.

---

## license

The license under which the theme is distributed.

Examples:

* MIT
* Apache-2.0
* GPL-3.0

---

## keywords

Optional searchable keywords.

Example:

```json
[
    "dark",
    "minimal",
    "blue"
]
```

Useful for future theme galleries.

---

## engines

Specifies compatible WebRadio versions.

Example:

```json
{
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

Future versions of WebRadio may use this information to prevent incompatible themes from loading.

---

# Validation

Before a theme is registered, the ThemeValidator verifies the manifest.

Validation includes:

* Required fields
* JSON syntax
* Duplicate theme IDs
* Version format
* CSS file exists
* Compatibility information

Themes with invalid manifests are rejected.

---

# Best Practices

✔ Use meaningful IDs.

✔ Follow Semantic Versioning.

✔ Include a preview image.

✔ Keep descriptions short.

✔ Always specify an author.

✔ Include a license.

✔ Never change the theme ID after publishing.

---

# Common Mistakes

Typical manifest problems include:

* Missing `id`
* Missing `css`
* Invalid JSON
* Duplicate IDs
* Missing stylesheet
* Incorrect version format

These errors are reported by the Diagnostics subsystem.

---

# Future Fields

Future versions of WebRadio may introduce additional manifest fields such as:

* Theme category
* Accent color
* Supported modes (Light/Dark)
* Font packs
* Wallpaper support
* Minimum SDK version
* Theme dependencies

The manifest format is designed to evolve while remaining backwards compatible whenever possible.

---

# Next Step

Continue with **Directory Structure** to learn how a WebRadio theme should be organized.
