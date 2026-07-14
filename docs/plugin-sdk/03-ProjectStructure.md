# Project Structure

A well-organized project structure makes plugins easier to develop, maintain and extend.

While WebRadio only requires a valid `manifest.json` and an entry file, following a consistent directory layout is strongly recommended.

This chapter describes the recommended project structure for WebRadio plugins.

---

# Minimal Plugin

The smallest possible plugin consists of only two files.

```text
HelloWorld/

├── manifest.json
└── index.js
```

This structure is suitable for small plugins or learning purposes.

---

# Recommended Structure

As plugins grow, organizing files into dedicated directories becomes important.

```text
MyPlugin/

├── manifest.json
├── index.js
│
├── assets/
│   ├── icons/
│   ├── images/
│   └── styles/
│
├── pages/
│
├── components/
│
├── services/
│
├── utils/
│
├── locales/
│
└── README.md
```

Each directory has a specific purpose.

---

# Directory Overview

## manifest.json

Contains the plugin metadata.

This file is required.

---

## index.js

The plugin entry point.

WebRadio loads this file when the plugin is enabled.

---

## assets/

Contains static resources such as:

* Icons
* Images
* CSS
* Fonts

Static assets should never contain application logic.

---

## pages/

Contains user interface pages provided by the plugin.

Examples:

* Sidebar pages
* Settings pages
* Information pages

---

## components/

Reusable UI components.

Keeping components separate improves readability and maintainability.

---

## services/

Contains business logic.

Examples:

* API clients
* Discord integration
* Last.fm communication
* Music providers

Services should remain independent from the user interface.

---

## utils/

Helper functions.

Typical examples include:

* Date formatting
* String utilities
* Helper methods
* Validation

---

## locales/

Translation files.

Example:

```text
locales/

├── en.json
├── de.json
└── fr.json
```

This allows plugins to support multiple languages.

---

## README.md

Optional documentation for the plugin.

Useful information may include:

* Features
* Installation
* Configuration
* License
* Known issues

---

# Example Project

```text
DiscordRPC/

├── manifest.json
├── index.js
│
├── assets/
│   └── discord.png
│
├── services/
│   └── DiscordService.js
│
├── utils/
│   └── Logger.js
│
└── README.md
```

This layout keeps responsibilities clearly separated.

---

# Design Principles

## Keep Responsibilities Separate

Each directory should contain only one type of resource.

---

## Keep Logic Modular

Avoid placing all code inside `index.js`.

Instead, split functionality into multiple files.

---

## Organize by Purpose

Group related files together.

Avoid deeply nested directory structures unless necessary.

---

# Best Practices

✔ Keep the project structure consistent.

✔ Separate UI from business logic.

✔ Store images inside `assets`.

✔ Place reusable code inside `utils`.

✔ Keep `index.js` as small as possible.

✔ Document your plugin with a README.

---

# Common Mistakes

Common organizational issues include:

* Large `index.js` files
* Mixing UI and business logic
* Random file placement
* Missing documentation
* Duplicate helper functions

Following a structured layout helps prevent these problems.

---

# Next Step

Continue with **Plugin Lifecycle** to learn how WebRadio discovers, loads, starts and stops plugins.
