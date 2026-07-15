# Best Practices

Creating a beautiful theme is only part of the process.

A high-quality WebRadio theme should also be maintainable, performant, accessible and compatible with future versions of the application.

This chapter summarizes the recommended practices for professional theme development.

---

# Use the Official Theme Variables

Always customize WebRadio through the documented CSS variables.

✔ Recommended

```css
:root {

    --wr-color-primary: #3b82f6;

    --wr-color-background: #1b1b1b;

}
```

✘ Avoid

```css
.sidebar > div:nth-child(2) {

    background: red;

}
```

Internal selectors may change between releases.

---

# Keep Themes Modular

Avoid placing all styles inside a single file.

Instead, organize styles by purpose.

Example:

```text
styles/

├── buttons.css
├── cards.css
├── dialogs.css
├── inputs.css
├── layout.css
└── sidebar.css
```

Smaller stylesheets are easier to understand and maintain.

---

# Follow a Consistent Design Language

A professional theme should maintain consistency across the entire application.

Ensure that:

* Colors follow a common palette.
* Typography is consistent.
* Border radii match.
* Shadows use the same visual depth.
* Spacing is uniform.

Users notice inconsistencies immediately.

---

# Use Accessible Colors

Always verify that text remains readable.

Recommended practices:

* High contrast between text and background.
* Avoid relying on color alone.
* Test both bright and dark screens.
* Verify disabled states remain understandable.

Accessibility improves usability for everyone.

---

# Optimize Assets

Large assets slow down loading.

Recommendations:

* Compress PNG images.
* Prefer SVG for icons.
* Use modern formats such as WebP where appropriate.
* Remove unused files.

Smaller themes load faster and consume less memory.

---

# Support Different Screen Sizes

Themes should adapt gracefully to different window sizes.

Avoid:

* Fixed widths
* Fixed heights
* Absolute positioning where unnecessary

Responsive layouts provide a better user experience.

---

# Minimize Animations

Animations should enhance the interface without becoming distracting.

Good examples include:

* Button hover transitions
* Dialog fade-ins
* Menu animations

Avoid excessive movement or long animation durations.

---

# Test Every Component

Before publishing a theme, verify:

* Sidebar
* Player
* Settings
* Dialogs
* Cards
* Menus
* Notifications
* Plugin pages

A theme should feel complete across the entire application.

---

# Respect User Preferences

Themes should integrate naturally with user settings.

Examples include:

* Font scaling
* High contrast mode
* Reduced motion
* System appearance (Light/Dark)

Respecting user preferences improves accessibility.

---

# Use Semantic Versioning

Version your theme using Semantic Versioning.

Examples:

```text
1.0.0

1.1.0

1.2.3

2.0.0
```

Clear version numbers help users understand compatibility.

---

# Document Your Theme

Every public theme should include a README.

Suggested sections:

* Overview
* Installation
* Features
* Screenshots
* Compatibility
* License
* Changelog

Good documentation improves adoption and reduces support requests.

---

# Test Before Publishing

Before releasing a theme, verify:

* Manifest is valid.
* Theme loads correctly.
* Preview image is displayed.
* Fonts load correctly.
* Icons render correctly.
* Colors remain readable.
* Assets resolve correctly.

Testing ensures a professional experience.

---

# Theme Checklist

Before publishing, ensure your theme meets the following criteria:

```text
✓ Valid theme.json

✓ Semantic version

✓ Preview image included

✓ Organized directory structure

✓ Uses official CSS variables

✓ Responsive layout

✓ Accessible color contrast

✓ Optimized assets

✓ Documentation included

✓ Fully tested
```

---

# Design Philosophy

A great WebRadio theme should:

* Feel native to the application.
* Be visually consistent.
* Respect accessibility guidelines.
* Perform efficiently.
* Remain compatible with future WebRadio releases.

The best themes are those that users hardly notice—they simply feel natural.

---

# Future Recommendations

As the Theme SDK evolves, additional recommendations may include:

* Theme validation tools
* Automated accessibility checks
* Design token verification
* Theme linting
* Performance analysis

These tools will help maintain a high standard across the WebRadio theme ecosystem.

---

# Next Step

Continue with **Hello Theme** to build a complete example theme using everything introduced throughout this guide.
