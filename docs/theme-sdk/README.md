# WebRadio Theme SDK

Welcome to the **WebRadio Theme SDK**.

This documentation explains everything you need to know to create custom themes for WebRadio.

Whether you want to make small visual adjustments or completely redesign the application, this guide will walk you through every part of the theming system.

The Theme SDK provides a stable and flexible foundation for creating beautiful, maintainable and future-proof themes.

---

# What is a Theme?

A theme changes the visual appearance of WebRadio without modifying the application's functionality.

Themes allow developers and designers to customize the application's look and feel while remaining fully compatible with the WebRadio Core.

Typical customizations include:

* Colors
* Typography
* Icons
* Spacing
* Borders
* Shadows
* Backgrounds
* Component styling

Themes should only affect presentation and never modify application logic.

---

# Why use the Theme SDK?

The Theme SDK provides a structured way to customize WebRadio.

Using the SDK ensures that your theme:

* integrates cleanly with the application,
* remains compatible with future versions,
* follows a consistent structure,
* uses officially supported styling variables,
* is easy to maintain and share.

Themes should never modify application source files directly.

Instead, they should rely on the public Theme SDK.

---

# How Themes Work

Each theme is stored inside its own directory.

WebRadio discovers installed themes during startup, validates the theme manifest and makes the theme available to the user.

Once selected, the theme's resources are loaded and applied to the application.

---

# Theme Loading Process

```text
Theme Folder

↓

Discovery

↓

Manifest Validation

↓

Asset Loading

↓

CSS Variables

↓

Theme Applied
```

Each theme follows the same loading process.

---

# What You Will Learn

This guide covers every aspect of theme development.

Topics include:

* Creating your first theme
* Understanding the theme manifest
* Organizing theme files
* CSS variables
* Component styling
* Assets
* Best practices
* Complete example themes

No knowledge of WebRadio internals is required.

---

# Requirements

Before creating themes, you should be familiar with:

* HTML
* CSS
* CSS Custom Properties (Variables)
* Basic directory structures

JavaScript knowledge is not required for most themes.

---

# Documentation Structure

The Theme SDK is organized into the following chapters.

```text
README

↓

Getting Started

↓

Theme Manifest

↓

Directory Structure

↓

CSS Variables

↓

Components

↓

Assets

↓

Best Practices

↓

Hello Theme

↓

FAQ
```

Each chapter builds upon the previous one.

For the best learning experience, it is recommended to read them in order.

---

# Design Philosophy

The Theme SDK follows a few important principles.

## Consistency

Themes should provide a consistent visual experience throughout the application.

---

## Maintainability

Themes should be easy to update as WebRadio evolves.

---

## Compatibility

Themes should rely only on documented variables and supported extension points.

---

## Flexibility

The Theme SDK is designed to support both simple color schemes and complete visual redesigns.

---

# Need Help?

If you encounter issues while developing a theme, consider the following resources:

* Theme SDK documentation
* Architecture documentation
* GitHub Issues
* GitHub Discussions

---

# Next Step

Continue with **Getting Started** to create your first WebRadio theme.
