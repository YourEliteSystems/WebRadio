# Directory Structure

A well-organized directory structure makes themes easier to develop, maintain and distribute.

While WebRadio only requires a valid `theme.json` and a primary stylesheet, following a consistent layout is strongly recommended.

This chapter describes the recommended project structure for WebRadio themes.

---

# Minimal Theme

The smallest possible theme consists of only two files.

```text
MyTheme/

├── theme.json
└── variables.css
```

This structure is suitable for simple color themes and learning purposes.

---

# Recommended Structure

As themes become more advanced, additional assets should be organized into dedicated directories.

```text
MyTheme/

├── theme.json
├── variables.css
├── preview.png
│
├── assets/
│   ├── fonts/
│   ├── icons/
│   ├── images/
│   └── wallpapers/
│
├── styles/
│   ├── components.css
│   ├── layout.css
│   ├── animations.css
│   └── utilities.css
│
└── README.md
```

Each directory has a specific purpose.

---

# Directory Overview

## theme.json

Contains the theme metadata.

This file is required.

---

## variables.css

The main stylesheet loaded by WebRadio.

It defines the theme's design tokens such as colors, spacing and typography.

Example:

```css
:root {

    --color-primary: #3b82f6;

}
```

---

## preview.png

A preview image displayed inside the Theme Manager.

Recommended size:

* 1280 × 720 pixels
* PNG format

The preview should accurately represent the theme.

---

## assets/

Contains static resources used by the theme.

Examples include:

* Fonts
* Icons
* Images
* Wallpapers

Static assets should not contain styling logic.

---

## styles/

Contains optional additional stylesheets.

Examples include:

* Component styles
* Layout rules
* Animations
* Utility classes

These files may be imported from `variables.css`.

Example:

```css
@import "./styles/components.css";
@import "./styles/layout.css";
```

---

## README.md

Optional documentation describing the theme.

A README may include:

* Features
* Installation
* Screenshots
* Compatibility
* License

Well-documented themes are easier to maintain and share.

---

# Example Project

```text
MidnightBlue/

├── theme.json
├── variables.css
├── preview.png
│
├── assets/
│   ├── icons/
│   └── fonts/
│
├── styles/
│   ├── buttons.css
│   ├── sidebar.css
│   └── player.css
│
└── README.md
```

This structure keeps responsibilities clearly separated.

---

# Design Principles

## Organize by Purpose

Group related files together.

Avoid placing all CSS inside a single large file.

---

## Keep Assets Separate

Fonts, icons and images should always remain inside the `assets` directory.

---

## Keep Styles Modular

Split large stylesheets into smaller, focused files.

This improves readability and maintainability.

---

## Document Your Theme

Include a README whenever possible.

Documentation helps users understand your design decisions and installation requirements.

---

# Best Practices

✔ Keep filenames descriptive.

✔ Use lowercase names.

✔ Separate variables from component styles.

✔ Store fonts inside `assets/fonts`.

✔ Keep preview images up to date.

✔ Organize large themes into multiple stylesheets.

---

# Common Mistakes

Common organizational issues include:

* One extremely large CSS file.
* Mixing assets with stylesheets.
* Missing preview images.
* Poorly named files.
* Deeply nested directory structures.

A clean structure makes themes easier to update and debug.

---

# Future Improvements

Future versions of the Theme SDK may introduce additional directories such as:

```text
assets/

├── sounds/
├── cursors/
├── illustrations/
└── branding/
```

These additions can be adopted without affecting existing themes.

---

# Next Step

Continue with **CSS Variables** to learn how WebRadio exposes its complete visual design system through CSS Custom Properties.
