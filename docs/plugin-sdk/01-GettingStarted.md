# Getting Started

Welcome to plugin development for WebRadio.

In this guide you will create your first plugin and learn how WebRadio discovers and loads extensions.

By the end of this chapter you will have a working plugin that is recognized by the application.

---

# Before You Begin

Before creating your first plugin, make sure you have:

* WebRadio installed
* Access to the plugins directory
* Basic JavaScript knowledge
* A code editor (for example Visual Studio Code)

No modifications to the WebRadio Core are required.

---

# Plugin Directory

All plugins are located inside the application's plugin directory.

```text
plugins/

├── HelloWorld/
├── DiscordRPC/
├── LastFM/
└── ...
```

Each plugin is stored in its own folder.

---

# Creating Your First Plugin

Create a new directory inside the plugins folder.

```text
plugins/

└── HelloWorld/
```

This directory will contain everything required by your plugin.

---

# Create the Manifest

Every plugin requires a `manifest.json`.

Example:

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "My first WebRadio plugin.",
    "main": "index.js"
}
```

The manifest provides information that WebRadio uses to identify and load your plugin.

The manifest format is explained in detail in the next chapter.

---

# Create the Entry File

Create an `index.js` file.

This file is the plugin's entry point.

A minimal plugin looks like this:

```javascript
module.exports = {

    async onEnable(context) {

        console.log("Hello from WebRadio!");

    },

    async onDisable() {

        console.log("Goodbye!");

    }

};
```

When the plugin is enabled, WebRadio calls `onEnable()`.

When the plugin is disabled or the application closes, `onDisable()` is called.

---

# Project Structure

Your first plugin should now look like this:

```text
HelloWorld/

├── manifest.json
└── index.js
```

As your plugin grows, additional directories may be added.

---

# Starting WebRadio

Start WebRadio normally.

During startup, the PluginManager will:

1. Discover the plugin folder.
2. Read the manifest.
3. Validate the manifest.
4. Register the plugin.
5. Load the entry file.
6. Enable the plugin.

If everything is configured correctly, your plugin is now running.

---

# Verifying Your Plugin

A successful startup typically looks like this:

```text
Plugin discovered

↓

Manifest validated

↓

Plugin registered

↓

Plugin enabled
```

You should also see the message:

```text
Hello from WebRadio!
```

in the application log or developer console.

---

# Common Mistakes

The most common problems are:

* Missing `manifest.json`
* Invalid JSON syntax
* Incorrect `main` file
* Missing exported object
* JavaScript syntax errors

If WebRadio cannot load your plugin, check the diagnostics log for detailed information.

---

# Next Step

Congratulations!

You have created your first WebRadio plugin.

Continue with **Manifest** to learn about every field supported by `manifest.json`.
