# Theme

The `Theme` class represents a single WebRadio theme.

A theme defines the visual appearance of the application while leaving its functionality unchanged.

Themes are discovered, validated and managed by the `ThemeManager`.

---

# Responsibilities

A Theme is responsible for describing and providing all visual resources required by WebRadio.

Typical responsibilities include:

* Theme identification
* Theme metadata
* Visual styling
* CSS variables
* Assets
* Preview images
* Version information

Themes should only affect presentation.

Application logic belongs inside plugins.

---

# Theme Lifecycle

Every theme follows a simple lifecycle.

```text
Theme Directory

↓

Theme Discovery

↓

Manifest Validation

↓

Theme Registration

↓

Available

↓

Selected

↓

Applied

↓

Inactive
```

Only one theme is active at any given time.

---

# Theme Manifest

Every theme must provide a valid `theme.json`.

Example:

```json
{
    "id": "midnight",
    "name": "Midnight",
    "version": "1.0.0",
    "author": "WebRadio Team",
    "css": "variables.css"
}
```

The manifest uniquely identifies the theme.

---

# Properties

## id

Unique identifier.

Example:

```javascript
theme.id
```

Returns:

```text
String
```

---

## name

Display name shown inside WebRadio.

Example:

```javascript
theme.name
```

---

## version

Current theme version.

Example:

```javascript
theme.version
```

Semantic Versioning is recommended.

---

## author

Theme author.

Example:

```javascript
theme.author
```

---

## description

Short theme description.

Example:

```javascript
theme.description
```

---

## css

Entry stylesheet.

Example:

```javascript
theme.css
```

The stylesheet contains the theme's public CSS variables.

---

## preview

Preview image displayed by the Theme Manager.

Example:

```javascript
theme.preview
```

---

# Theme Assets

Themes may contain additional resources.

Examples include:

* Fonts
* Icons
* Wallpapers
* Images
* Logos

All assets should remain inside the theme directory.

---

# Theme Structure

Typical directory structure:

```text
MyTheme/

├── theme.json
├── variables.css
├── preview.png
│
├── styles/
│
└── assets/
```

This structure is recommended for all themes.

---

# Validation

Before a theme becomes available, the ThemeManager validates:

* Manifest
* Required fields
* CSS entry file
* Preview image
* Version format
* Theme identifier

Themes failing validation are not registered.

---

# Theme States

A theme may exist in one of the following states.

```text
Discovered

Validated

Registered

Available

Active

Inactive
```

Only validated themes can become active.

---

# Error Handling

If a theme cannot be loaded:

* The error is logged.
* The theme is skipped.
* Remaining themes continue loading.

A broken theme should never prevent WebRadio from starting.

---

# Best Practices

✔ Use Semantic Versioning.

✔ Include a preview image.

✔ Organize assets.

✔ Use only public CSS variables.

✔ Keep themes self-contained.

✔ Test on multiple screen sizes.

---

# Common Mistakes

Typical issues include:

* Missing manifest.
* Invalid JSON.
* Missing stylesheet.
* Broken asset paths.
* Duplicate theme identifiers.

Proper validation prevents these problems.

---

# Related APIs

The Theme class interacts with:

* ThemeManager
* ThemeLoader
* ThemeValidator
* Application

---

# Example

```javascript
const theme = {

    id: "midnight",

    name: "Midnight",

    version: "1.0.0"

};
```

This object represents a registered WebRadio theme.

---

# See Also

* ThemeManager
* ThemeLoader
* ThemeValidator
* Application
* Theme SDK
