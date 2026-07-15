# Hello Theme

Welcome to your first WebRadio theme.

This guide combines everything introduced throughout the Theme SDK into a complete, working example.

By the end of this chapter you will understand how a professional WebRadio theme is organized and how all parts work together.

---

# Project Structure

Our example follows the recommended directory layout.

```text id="mx93jd"
HelloTheme/

├── theme.json
├── variables.css
├── preview.png
│
├── styles/
│   ├── buttons.css
│   ├── cards.css
│   ├── sidebar.css
│   └── player.css
│
├── assets/
│   ├── fonts/
│   ├── icons/
│   └── images/
│
└── README.md
```

This structure scales well for both small and large themes.

---

# theme.json

```json id="gc84kp"
{
    "id": "hello-theme",
    "name": "Hello Theme",
    "version": "1.0.0",
    "author": "WebRadio Team",
    "description": "Example theme for the WebRadio Theme SDK.",
    "css": "variables.css",
    "preview": "preview.png",
    "license": "MIT",
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

---

# variables.css

```css id="bh0jru"
:root {

    --wr-color-primary: #3b82f6;

    --wr-color-background: #181818;

    --wr-color-surface: #242424;

    --wr-color-text: #ffffff;

    --wr-color-border: #3a3a3a;

    --wr-radius-medium: 8px;

    --wr-spacing-md: 12px;

    --wr-font-family: "Inter", sans-serif;

}
```

These variables define the foundation of the theme.

---

# Import Additional Styles

Keep the main stylesheet clean by importing component-specific styles.

```css id="lsh3oi"
@import "./styles/sidebar.css";
@import "./styles/buttons.css";
@import "./styles/cards.css";
@import "./styles/player.css";
```

---

# Sidebar Example

```css id="mjlwmv"
.sidebar {

    background:

        var(--wr-sidebar-background);

    color:

        var(--wr-sidebar-text);

}
```

---

# Button Example

```css id="dcjlwm"
.button {

    background:

        var(--wr-button-background);

    color:

        var(--wr-button-text);

    border-radius:

        var(--wr-radius-medium);

}
```

---

# Card Example

```css id="lgz5kh"
.card {

    background:

        var(--wr-card-background);

    border:

        1px solid

        var(--wr-card-border);

    box-shadow:

        var(--wr-card-shadow);

}
```

---

# Player Example

```css id="xmvnqp"
.player {

    background:

        var(--wr-player-background);

}
```

---

# Assets

Example asset structure:

```text id="j1nlgz"
assets/

├── fonts/

│   └── Inter.ttf

├── icons/

│   ├── play.svg

│   └── pause.svg

└── images/

    └── background.png
```

All resources remain self-contained inside the theme.

---

# Preview Image

Include a preview image to help users identify your theme.

Recommended specifications:

* PNG format
* 1280 × 720 pixels
* Current appearance of the application
* High quality

---

# Theme Loading

When WebRadio starts, the loading sequence is:

```text id="0d8ztl"
Theme discovered

↓

Manifest validated

↓

Assets loaded

↓

CSS variables applied

↓

Theme available

↓

User selects theme

↓

Theme activated
```

---

# What This Theme Demonstrates

This example includes:

* Valid manifest
* Organized directory layout
* CSS variables
* Modular stylesheets
* Assets
* Preview image
* Theme activation

It provides a solid foundation for real-world themes.

---

# Expanding Your Theme

You can extend your theme by adding:

* Additional component styles
* Custom fonts
* Icon packs
* Wallpapers
* Light and dark variants
* Accessibility improvements
* High contrast mode
* Responsive layouts

The Theme SDK is designed to scale from simple color themes to complete visual redesigns.

---

# Congratulations

You have created your first complete WebRadio theme.

You should now understand:

* Theme structure
* Theme manifest
* CSS variables
* Component styling
* Asset organization
* Best practices

You are now ready to build your own themes using the WebRadio Theme SDK.
