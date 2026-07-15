# Hello World

Welcome to your first complete WebRadio plugin.

This guide combines everything introduced throughout the Plugin SDK into a single, functional example.

By the end of this chapter you will understand how a complete plugin is organized and how the different SDK components work together.

---

# Project Structure

Our example plugin uses the recommended directory layout.

```text
HelloWorld/

├── manifest.json
├── index.js
│
├── assets/
│   └── icon.svg
│
├── pages/
│   └── HelloWorld.jsx
│
├── settings/
│   └── Settings.jsx
│
└── README.md
```

---

# manifest.json

```json
{
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "author": "WebRadio Team",
    "description": "Example plugin for the WebRadio Plugin SDK.",
    "main": "index.js",
    "license": "MIT",
    "engines": {
        "webradio": ">=1.1.0"
    }
}
```

---

# index.js

```javascript
module.exports = {

    async onEnable(context) {

        this.context = context;

        context.logger.info(
            "Hello World enabled."
        );

        await context.storage.set(
            "enabled",
            true
        );

        context.events.on(
            "stationChanged",
            this.onStationChanged
        );

        context.ui.registerPage({

            id: "hello",

            title: "Hello World",

            icon: "home",

            component: "./pages/HelloWorld.jsx"

        });

    },

    async onDisable() {

        this.context.events.off(
            "stationChanged",
            this.onStationChanged
        );

        this.context.logger.info(
            "Hello World disabled."
        );

    },

    onStationChanged(station) {

        console.log(
            station.name
        );

    }

};
```

---

# Example Page

```javascript
export default function HelloWorld() {

    return (

        <div>

            <h1>Hello WebRadio</h1>

            <p>
                Your first plugin page.
            </p>

        </div>

    );

}
```

---

# What This Plugin Demonstrates

This example demonstrates:

* Plugin loading
* Manifest validation
* Plugin lifecycle
* Logger
* Storage
* Events
* UI registration
* React integration

Although simple, it represents the basic structure used by most real-world plugins.

---

# Startup Sequence

```text
WebRadio starts

↓

Plugin discovered

↓

Manifest validated

↓

Plugin loaded

↓

onEnable()

↓

Register page

↓

Register events

↓

Plugin running
```

---

# Shutdown Sequence

```text
Application closes

↓

onDisable()

↓

Remove events

↓

Release resources

↓

Plugin unloaded
```

---

# Expanding the Plugin

From this point you can continue extending your plugin by adding:

* Settings pages
* Dialogs
* Hooks
* Notifications
* External APIs
* Custom services
* Localization
* Additional UI components

The Plugin SDK is designed to scale from small utility plugins to large feature-rich extensions.

---

# Congratulations

You have now completed your first WebRadio plugin.

You should now understand:

* Project layout
* Plugin lifecycle
* Manifest
* Storage
* Events
* Hooks
* UI integration
* Plugin Context

From here you are ready to build your own plugins using the complete WebRadio Plugin SDK.
