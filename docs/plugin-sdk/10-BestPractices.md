# Best Practices

Writing a working plugin is only the beginning.

A well-designed plugin should be reliable, maintainable, performant and compatible with future WebRadio releases.

This chapter summarizes the recommended practices for developing high-quality plugins.

---

# Keep Plugins Modular

Avoid placing all logic inside `index.js`.

Instead, split your plugin into smaller modules with clear responsibilities.

Example:

```text id="9yapxg"
MyPlugin/

├── index.js
├── services/
├── components/
├── pages/
├── utils/
└── assets/
```

Smaller modules are easier to understand, test and maintain.

---

# Use the Public SDK

Always interact with WebRadio through the Plugin Context.

✔ Good

```javascript id="q0rz1h"
context.storage.set(...)

context.events.on(...)
```

✘ Avoid

```javascript id="4zzh0d"
application.windowManager...

application.storage...

application.pluginManager...
```

Internal APIs may change without notice.

---

# Keep Startup Fast

`onEnable()` should complete quickly.

Avoid:

* Long network requests
* Large file operations
* Heavy calculations

If necessary, perform expensive work asynchronously after initialization.

---

# Clean Up Resources

Everything created during `onEnable()` should be cleaned up during `onDisable()`.

Typical resources include:

* Event listeners
* Timers
* Intervals
* Network connections
* File watchers

Leaving resources active after shutdown may cause memory leaks.

---

# Handle Errors Gracefully

Unexpected errors should never crash the plugin.

Example:

```javascript id="8cv1lk"
try {

    await connect();

}
catch (error) {

    context.logger.error(error);

}
```

Always assume external services may fail.

---

# Keep the UI Responsive

Avoid blocking the user interface.

Long-running tasks should execute asynchronously.

Examples include:

* Downloads
* API requests
* File processing
* Database operations

---

# Store Only Necessary Data

The Storage API is intended for plugin data.

Avoid storing:

* Large binary files
* Temporary runtime objects
* Cache data that can easily be regenerated

Store only information that must persist.

---

# Respect User Settings

Plugins should never ignore user preferences.

Examples include:

* Theme selection
* Language
* Notifications
* Privacy options

Whenever possible, integrate naturally with the user's existing configuration.

---

# Support Future Versions

Plugins should be written with compatibility in mind.

Avoid relying on undocumented behavior.

Instead, use only officially documented APIs.

---

# Write Meaningful Logs

Logging helps diagnose problems.

Good examples include:

```text id="tstixq"
Plugin initialized

Connected to Discord

Loaded 12 stations

Settings saved
```

Avoid excessive logging during normal operation.

---

# Follow Semantic Versioning

Every release should update the version number appropriately.

Examples:

```text id="h3mjlwm"
1.0.0

1.1.0

1.1.1

2.0.0
```

Semantic Versioning makes compatibility easier to understand.

---

# Write Documentation

Every public plugin should include a README.

Typical sections include:

* Installation
* Features
* Configuration
* License
* Known Issues

Good documentation reduces support requests.

---

# Keep Dependencies Minimal

Only include dependencies that are truly required.

Fewer dependencies mean:

* Smaller plugins
* Faster startup
* Fewer security risks
* Easier maintenance

---

# Test Before Publishing

Before releasing a plugin, verify that:

* The manifest is valid.
* The plugin starts correctly.
* The plugin shuts down cleanly.
* Errors are handled gracefully.
* Settings persist correctly.
* UI elements render correctly.

Testing improves both stability and user experience.

---

# Plugin Checklist

Before publishing, ensure that your plugin:

```text id="mjlwmg"
✓ Valid manifest

✓ Stable ID

✓ Semantic version

✓ Clean project structure

✓ Uses Plugin Context

✓ Cleans resources

✓ Handles errors

✓ Responsive UI

✓ Documentation included

✓ Tested
```

---

# Design Philosophy

A good plugin should:

* Feel like part of WebRadio.
* Respect the user's environment.
* Remain stable.
* Be easy to maintain.
* Continue working across future releases whenever possible.

---

# Next Step

Continue with **Hello World** to build a complete example plugin using the concepts introduced throughout this guide.
