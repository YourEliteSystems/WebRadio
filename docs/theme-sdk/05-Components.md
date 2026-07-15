# Components

The WebRadio Theme SDK allows themes to customize every major user interface component.

Each component uses the public CSS variables documented in the previous chapter.

Themes should style components using these variables instead of overriding internal implementation details whenever possible.

---

# Overview

The WebRadio interface consists of several major UI components.

```text
WebRadio

├── Window
├── Header
├── Sidebar
├── Navigation
├── Player
├── Content
├── Cards
├── Dialogs
├── Settings
├── Notifications
├── Menus
└── Footer
```

Each component follows the same design system.

---

# Application Window

The application window defines the overall appearance.

Typical properties include:

* Background
* Default text color
* Global font
* Accent color

Example:

```css
body {

    background: var(--wr-color-background);

    color: var(--wr-color-text);

    font-family: var(--wr-font-family);

}
```

---

# Header

The header contains:

* Application title
* Window controls
* Search
* Toolbar actions

Recommended variables:

```css
--wr-header-background

--wr-header-border

--wr-header-height

--wr-header-text
```

---

# Sidebar

The sidebar provides navigation throughout WebRadio.

It typically contains:

* Home
* Stations
* Favorites
* History
* Plugin Pages
* Settings

Recommended variables:

```css
--wr-sidebar-background

--wr-sidebar-width

--wr-sidebar-text

--wr-sidebar-active

--wr-sidebar-hover
```

---

# Navigation

Navigation elements should provide clear visual feedback.

States include:

* Default
* Hover
* Active
* Disabled

Themes should maintain sufficient contrast for all states.

---

# Player

The media player is one of the most frequently used interface elements.

Typical controls include:

* Play
* Pause
* Stop
* Volume
* Station information
* Album artwork

Recommended variables:

```css
--wr-player-background

--wr-player-border

--wr-player-button

--wr-player-button-hover

--wr-player-progress
```

---

# Content Area

The content area displays the primary application pages.

Examples include:

* Station browser
* Search
* Plugin pages
* Settings
* Dashboards

Recommended variables:

```css
--wr-content-background

--wr-content-padding
```

---

# Cards

Cards group related information.

Examples:

* Station cards
* Plugin cards
* Theme cards

Recommended variables:

```css
--wr-card-background

--wr-card-border

--wr-card-shadow

--wr-card-radius
```

---

# Buttons

Buttons should follow a consistent appearance.

Button states:

* Default
* Hover
* Active
* Disabled

Recommended variables:

```css
--wr-button-background

--wr-button-text

--wr-button-hover

--wr-button-active
```

---

# Inputs

Input components include:

* Text fields
* Search boxes
* Dropdowns
* Checkboxes
* Switches

Recommended variables:

```css
--wr-input-background

--wr-input-border

--wr-input-focus

--wr-input-text
```

---

# Dialogs

Dialogs display temporary content requiring user interaction.

Examples:

* Confirmation dialogs
* Plugin settings
* Import dialogs

Recommended variables:

```css
--wr-dialog-background

--wr-dialog-border

--wr-dialog-shadow
```

---

# Menus

Context menus and dropdown menus should integrate naturally with the rest of the theme.

Recommended variables:

```css
--wr-menu-background

--wr-menu-border

--wr-menu-hover
```

---

# Notifications

Notifications provide feedback to the user.

Recommended variables:

```css
--wr-notification-background

--wr-notification-text

--wr-notification-success

--wr-notification-warning

--wr-notification-error
```

---

# Footer

The footer may display:

* Playback information
* Status messages
* Application version

Recommended variables:

```css
--wr-footer-background

--wr-footer-border

--wr-footer-height
```

---

# Component Consistency

Every component should follow the same design language.

A theme should provide:

* Consistent spacing
* Consistent typography
* Consistent border radius
* Consistent shadows
* Consistent animations

A consistent interface improves usability.

---

# Best Practices

✔ Style components through public variables.

✔ Maintain visual consistency.

✔ Support light and dark themes.

✔ Keep spacing uniform.

✔ Use accessible color contrasts.

✔ Test every major component before publishing.

---

# Common Mistakes

Common styling problems include:

* Different border radii across components.
* Inconsistent spacing.
* Mixed shadow styles.
* Low contrast.
* Overly aggressive animations.

A professional theme should feel cohesive across the entire application.

---

# Future Components

Future versions of WebRadio may introduce additional customizable components, including:

* Visualizers
* Mini Player
* Equalizer
* Theme Marketplace
* Plugin Marketplace
* Dashboard Widgets
* Media Library
* Lyrics Panel

The Theme SDK will continue to expand while remaining backwards compatible.

---

# Next Step

Continue with **Assets** to learn how fonts, icons, images and other resources can be bundled with your theme.
