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

## capabilities

Optional list of core capabilities the plugin requests. Capabilities are validated and granted by the core; a plugin cannot grant them itself. Unknown capabilities are rejected.

```json
{
    "capabilities": ["web-session", "web-session-media"]
}
```

See [Capabilities & Plugin HTTP Environment](13-Capabilities.md) for the current list and requirements.

---

## webSessionOrigins

Required when a plugin requests `web-session`, `web-session-media` or `encrypted-media`. Lists the exact HTTPS origins the plugin's isolated web session may load.

```json
{
    "capabilities": ["web-session", "web-session-media"],
    "webSessionOrigins": [
        "https://music.youtube.com",
        "https://accounts.google.com"
    ]
}
```

Rules:

* HTTPS only
* exact origin (scheme + host + optional port), no path, query or fragment
* no wildcards, no credentials
* origins are not added at runtime

A manifest that requests a web-session capability without valid origins is rejected during discovery and package validation.

---

# localization

Optional. Declares the plugin's own translations as data. WebRadio validates
them and provisions them under `userData/localization/plugins/<plugin-id>/`;
the runtime reads them only from there. Keys resolve as
`plugin.<plugin-id>.*`, and the plugin can access them through
`context.localization` (see [Localization](14-Localization.md)).

```json
{
    "localization": {
        "de-DE": { "settings": { "title": "Einstellungen" } },
        "en-US": { "settings": { "title": "Settings" } }
    }
}
```

Rules:

* supported locales only (`de-DE`, `en-US`)
* nested objects with non-empty string values
* maximum depth 6, maximum 2000 characters per value, maximum 20 locales
* the `plugin.` prefix is reserved for the plugin's own namespace
* translations are never executed as code

---

# update

Optional. Declares where WebRadio can find updates for this plugin.

```json
{
    "update": {
        "manifestUrl": "https://updates.example.com/mediahub/manifest.json",
        "channel": "stable"
    }
}
```

* `manifestUrl` must be HTTPS and point to a version 1 update manifest.
* `channel` is one of `stable`, `beta` or `alpha` and is only a default; users
  can choose a channel in the plugin settings.
* Without `manifestUrl`, the plugin is never checked for updates.

See [Plugin updates](../PLUGIN_UPDATES.md) for the manifest format, signing,
hosting and troubleshooting.

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
* Known capabilities and their prerequisites
* `webSessionOrigins` for web-session capabilities

Plugins with invalid manifests are rejected. Changes to `permissions`, `capabilities` or `webSessionOrigins` change the plugin fingerprint, so a rescan reloads the plugin with the new rights.

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
