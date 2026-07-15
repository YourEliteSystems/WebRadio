# CSS Variables

The WebRadio Theme SDK uses CSS Custom Properties (CSS Variables) to expose its visual design system.

Instead of styling individual elements directly, themes should override the officially supported CSS variables.

This approach provides a stable, maintainable and future-proof theming experience.

---

# Why CSS Variables?

CSS variables make themes:

* Easier to maintain
* Easier to update
* More consistent
* Compatible with future WebRadio releases

Themes should avoid targeting internal selectors whenever possible.

---

# Variable Structure

The Theme SDK groups variables into logical categories.

```text
Theme Variables

├── Colors
├── Typography
├── Spacing
├── Borders
├── Shadows
├── Layout
├── Components
├── Animations
└── Z-Index
```

---

# Colors

Colors define the application's appearance.

Example:

```css
:root {

    --color-primary: #3b82f6;

    --color-secondary: #64748b;

    --color-success: #22c55e;

    --color-warning: #f59e0b;

    --color-danger: #ef4444;

}
```

---

# Background Colors

Application backgrounds.

```css
:root {

    --color-background;

    --color-surface;

    --color-surface-alt;

    --color-sidebar;

    --color-header;

    --color-footer;

}
```

---

# Text Colors

Typography colors.

```css
:root {

    --color-text;

    --color-text-muted;

    --color-text-inverse;

    --color-link;

}
```

---

# Border Colors

```css
:root {

    --color-border;

    --color-border-light;

    --color-border-focus;

}
```

---

# Typography

Fonts and text appearance.

```css
:root {

    --font-family;

    --font-size-small;

    --font-size-normal;

    --font-size-large;

    --font-size-title;

    --font-weight-normal;

    --font-weight-bold;

}
```

---

# Border Radius

Rounded corners.

```css
:root {

    --radius-small;

    --radius-medium;

    --radius-large;

    --radius-round;

}
```

---

# Spacing

Global spacing values.

```css
:root {

    --spacing-xs;

    --spacing-sm;

    --spacing-md;

    --spacing-lg;

    --spacing-xl;

}
```

These values should be reused throughout the entire theme.

---

# Shadows

Elevation effects.

```css
:root {

    --shadow-small;

    --shadow-medium;

    --shadow-large;

}
```

---

# Layout

General layout dimensions.

```css
:root {

    --sidebar-width;

    --header-height;

    --footer-height;

    --content-padding;

}
```

---

# Buttons

Button appearance.

```css
:root {

    --button-background;

    --button-hover;

    --button-active;

    --button-text;

}
```

---

# Inputs

Input controls.

```css
:root {

    --input-background;

    --input-border;

    --input-focus;

    --input-text;

}
```

---

# Cards

Cards and panels.

```css
:root {

    --card-background;

    --card-border;

    --card-shadow;

}
```

---

# Scrollbars

Scrollbar styling.

```css
:root {

    --scrollbar-background;

    --scrollbar-thumb;

    --scrollbar-thumb-hover;

}
```

---

# Animations

Animation timing.

```css
:root {

    --transition-fast;

    --transition-normal;

    --transition-slow;

}
```

---

# Z-Index

Layer ordering.

```css
:root {

    --z-dropdown;

    --z-dialog;

    --z-tooltip;

    --z-notification;

}
```

---

# Example Theme

```css
:root {

    --color-primary: #1e88e5;

    --color-background: #181818;

    --color-surface: #242424;

    --color-text: #ffffff;

    --radius-medium: 8px;

    --spacing-md: 12px;

}
```

Changing only these variables can dramatically alter the appearance of WebRadio.

---

# Best Practices

✔ Prefer variables over fixed values.

✔ Reuse spacing variables.

✔ Maintain sufficient color contrast.

✔ Keep naming consistent.

✔ Support both light and dark themes where possible.

✔ Avoid overriding internal selectors.

---

# Common Mistakes

Common issues include:

* Hardcoded colors.
* Duplicate variable definitions.
* Ignoring spacing variables.
* Inconsistent typography.
* Low contrast combinations.

Using the official variables ensures themes remain compatible with future versions of WebRadio.

---

# Future Variables

As WebRadio evolves, additional variables may be introduced for:

* Charts
* Media controls
* Visualizers
* Widgets
* Plugin pages
* Notification center
* Theme marketplace

New variables will always be additive to preserve compatibility.

---

# Next Step

Continue with **Components** to learn how the different parts of the WebRadio interface use these variables.
