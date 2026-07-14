# ThemeManager

The `ThemeManager` is responsible for discovering, validating, loading and managing all themes available to WebRadio.

Themes allow users to customize the appearance of the application without modifying the core application.

The ThemeManager provides a centralized interface for theme management and ensures that every theme follows the same loading process.

---

# Responsibilities

The ThemeManager is responsible for:

* Discovering installed themes
* Loading theme manifests
* Validating themes
* Registering themes
* Applying themes
* Managing the active theme
* Providing theme information to the application

The ThemeManager does **not** implement the visual appearance itself.

Its responsibility is limited to theme management.

---

# Architecture

The ThemeManager coordinates several specialized components.

```text
ThemeManager

├── ThemeLoader
├── ThemeValidator
├── ThemeRegistry
└── ThemeRuntime
```

Each component performs a specific task during the theme lifecycle.

---

# Theme Lifecycle

Every theme follows the same loading process.

```text
Discover Theme Folder

↓

Read theme.json

↓

Validate Manifest

↓

Register Theme

↓

Theme Available

↓

Apply Theme
```

If validation fails, the theme is skipped and an error is written to the diagnostics log.

---

# Theme Discovery

During application startup, the ThemeLoader scans the configured themes directory.

Each subdirectory represents one theme.

Example:

```text
themes/

├── Default/
│   ├── theme.json
│   ├── variables.css
│   └── preview.png
│
├── Dark/
│   ├── theme.json
│   ├── variables.css
│   └── preview.png
│
└── Light/
```

Only directories containing a valid `theme.json` file are considered themes.

---

# Theme Validation

Before a theme becomes available, it is validated.

Validation includes checks such as:

* Required manifest fields
* Theme identifier
* Theme name
* Version
* CSS file
* Manifest structure

Invalid themes are ignored to prevent runtime errors.

---

# Theme Registration

After successful validation, the ThemeManager registers the theme.

Registered themes become available to the user interface.

The registry acts as the central collection of all installed themes.

---

# Applying Themes

Only one theme can be active at a time.

Changing the active theme updates the application's visual appearance without restarting WebRadio whenever possible.

The ThemeManager coordinates the activation process and ensures that the selected theme is applied consistently.

---

# Why a ThemeManager?

Without a dedicated ThemeManager:

* every window would need its own loading logic,
* theme validation would be duplicated,
* switching themes would become inconsistent,
* maintenance would become increasingly difficult.

A centralized ThemeManager ensures a predictable and extensible workflow.

---

# Design Principles

## Centralization

All theme-related operations are performed through the ThemeManager.

---

## Validation First

Every theme is validated before it is registered.

---

## Extensibility

New theme features should be implemented without changing the loading process.

---

## Separation of Responsibilities

Theme discovery, validation, registration and runtime behavior are handled by separate components.

---

# Best Practices

✔ Always include a valid `theme.json`.

✔ Keep theme assets inside the theme directory.

✔ Validate themes before registration.

✔ Never modify application files directly.

✔ Use CSS variables whenever possible.

✔ Treat themes as independent packages.

---

# Related Documentation

* Architecture
* Application
* StorageManager
* PluginManager
* Theme SDK
* Theme Manifest
* Theme Runtime
