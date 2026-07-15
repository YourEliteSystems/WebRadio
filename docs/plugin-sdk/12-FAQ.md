# Frequently Asked Questions (FAQ)

This chapter answers the most common questions about developing plugins for WebRadio.

If your plugin does not work as expected, you will likely find the answer here.

---

# My plugin is not loaded.

### Possible causes

* `manifest.json` is missing.
* The manifest contains invalid JSON.
* The `main` file does not exist.
* The plugin directory is incorrect.
* The plugin failed validation.

### Solution

Verify that your project looks like this:

```text
MyPlugin/

├── manifest.json
└── index.js
```

Check the Diagnostics log for additional error information.

---

# My plugin does not appear in WebRadio.

### Possible causes

* Invalid plugin ID
* Duplicate plugin ID
* Plugin initialization failed
* JavaScript syntax error

### Solution

Review the application log and ensure the plugin starts without exceptions.

---

# Why is `onEnable()` never called?

`onEnable()` is only executed after:

* the plugin has been discovered,
* the manifest has been validated,
* the plugin has been successfully loaded.

Any error before these steps prevents initialization.

---

# Why is `onDisable()` never called?

`onDisable()` is only called if the plugin was successfully enabled.

Plugins that fail during initialization are never started.

---

# Can plugins communicate with each other?

Direct communication between plugins is discouraged.

Instead, plugins should communicate through:

* Events
* Hooks
* Future public SDK APIs

This keeps plugins loosely coupled and easier to maintain.

---

# Can I access WebRadio internals?

No.

Plugins should only use the public Plugin Context.

Accessing internal classes such as:

* Application
* WindowManager
* StorageManager
* PluginManager

is unsupported and may break in future versions.

---

# Where should plugin settings be stored?

Persistent configuration belongs in the Storage API.

Do not create your own configuration files unless absolutely necessary.

---

# Can I create multiple pages?

Yes.

A plugin may register multiple UI pages, provided the UI API supports them.

---

# Can I use React?

Yes.

WebRadio's plugin UI is designed to support React components.

Plugins should keep components modular and self-contained.

---

# Should I use `console.log()`?

For debugging, `console.log()` is acceptable.

For production plugins, prefer:

```javascript
context.logger.info(...)

context.logger.warn(...)

context.logger.error(...)
```

This keeps logs consistent with the rest of WebRadio.

---

# How do I support multiple languages?

Store translations inside a dedicated `locales/` directory.

Example:

```text
locales/

├── en.json
├── de.json
└── fr.json
```

Future SDK versions may provide localization helpers.

---

# How do I store API tokens?

Store tokens through the Storage API.

Never hardcode secrets inside your source code.

Future SDK versions may support encrypted storage.

---

# My plugin slows down WebRadio.

Possible reasons include:

* Heavy work inside `onEnable()`
* Blocking the UI thread
* Large synchronous file operations
* Excessive event listeners

Move expensive operations to asynchronous tasks whenever possible.

---

# How do I report SDK bugs?

Before reporting an issue:

* Verify you are using the latest SDK.
* Check the documentation.
* Review the Diagnostics log.
* Search existing GitHub issues.

If the problem persists, create a bug report including:

* WebRadio version
* Plugin version
* Operating system
* Error message
* Reproduction steps

---

# Plugin Development Checklist

Before publishing a plugin, verify:

```text
✓ Manifest is valid

✓ Plugin loads correctly

✓ onEnable() executes

✓ onDisable() cleans resources

✓ Storage works

✓ Events are removed

✓ UI behaves correctly

✓ Logger is used

✓ Documentation included

✓ Plugin tested
```

---

# Need More Help?

Additional resources include:

* Plugin SDK
* Architecture Documentation
* API Reference
* GitHub Issues
* GitHub Discussions

These resources are the best starting point for solving plugin development problems.

---

# Congratulations

You have completed the WebRadio Plugin SDK.

You should now understand:

* Plugin architecture
* Plugin lifecycle
* Manifest format
* Project structure
* Storage API
* Event API
* Hook API
* UI integration
* Best practices

You are now ready to build powerful extensions for WebRadio.
