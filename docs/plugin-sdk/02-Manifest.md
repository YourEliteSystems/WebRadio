# Plugin Manifest

Every WebRadio plugin must contain a `manifest.json` file.

The manifest describes your plugin and provides the information required by the PluginManager to discover, validate and load it.

Without a valid manifest, a plugin cannot be loaded.

---

# Purpose

The manifest serves as the identity card of your plugin.

It tells WebRadio:

* What the plugin is called
* Which version it is
* Who created it
* Which file should be executed
* Which WebRadio version it supports
* Additional metadata

---

# Minimal Manifest

The smallest valid manifest looks like this:

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "main": "index.js"
}
```

This is sufficient for a simple plugin.

---

# Complete Example

A more complete manifest might look like this:

```json
{
    "id": "discord-rpc",
    "name": "Discord Rich Presence",
    "version": "1.2.0",
    "author": "Your Name",
    "description": "Displays the current station in Discord.",
    "main": "index.js",
    "homepage": "https://github.com/YourName/DiscordRPC",
    "license": "MIT",
    "keywords": [
        "discord",
        "rpc",
        "music"
    ],
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

Not every field is required.

---

# Manifest Fields

## id

A unique identifier.

Requirements:

* lowercase letters
* numbers
* hyphens allowed
* must remain stable

Example:

```text
discord-rpc
```

---

## name

Human-readable plugin name.

Example:

```text
Discord Rich Presence
```

---

## version

Plugin version following Semantic Versioning.

Example:

```text
1.0.0
1.2.4
2.0.0
```

---

## author

The plugin author.

Example:

```text
John Doe
```

---

## description

A short description of the plugin.

Keep descriptions concise and informative.

---

## main

The plugin entry point.

Example:

```text
index.js
```

The PluginRuntime loads this file during startup.

---

## homepage

Optional project homepage.

Usually a GitHub repository.

---

## license

The software license.

Examples:

* MIT
* Apache-2.0
* GPL-3.0

---

## keywords

A list of searchable keywords.

Useful for future plugin marketplaces.

---

## engines

Defines compatibility with WebRadio versions.

Example:

```json
{
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

Future versions of the PluginManager may use this field to prevent incompatible plugins from loading.

---

# Validation

Before a plugin is registered, the PluginValidator verifies the manifest.

Validation includes:

* Required fields
* JSON syntax
* Version format
* Duplicate IDs
* Entry file
* Compatibility

Plugins with invalid manifests are rejected.

---

# Best Practices

✔ Use meaningful IDs.

✔ Follow Semantic Versioning.

✔ Keep descriptions short.

✔ Always provide an author.

✔ Update the version for every release.

✔ Do not change the plugin ID after publishing.

---

# Common Mistakes

Typical manifest errors include:

* Missing `id`
* Missing `main`
* Invalid JSON
* Duplicate plugin IDs
* Incorrect version format
* Wrong entry file

These errors are reported by the Diagnostics subsystem.

---

# Future Fields

Future versions of WebRadio may introduce additional manifest fields, including:

* Permissions
* Dependencies
* Optional Dependencies
* Minimum API Version
* Icon
* Screenshots
* Categories
* Repository Information

The manifest format is designed to evolve while remaining backwards compatible whenever possible.

---

# Next Step

Continue with **Project Structure** to learn how a WebRadio plugin should be organized.
