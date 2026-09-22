# Settings

The `Settings` service provides access to plugin configuration managed by WebRadio.

Unlike the Storage service, which is intended for arbitrary persistent data, the Settings service is designed specifically for user-configurable options.

Settings are managed by WebRadio and may be exposed through the application's Settings interface.

---

# Responsibilities

The Settings service is responsible for:

* Reading plugin settings
* Updating configuration values
* Providing default values
* Validating user input
* Persisting configuration changes

Settings represent user preferences rather than application state.

---

# Accessing Settings

The Settings service is available through the `PluginContext`.

Example:

```javascript id="bt4h2x"
const settings = context.settings;
```

Plugins should never create their own Settings instance.

---

# Methods (1.0.7-alpha.1)

The current plugin-facing Settings API provides synchronous access to selected global settings.

### get()

Returns the current value of a setting.

#### Syntax

```javascript id="x1z8pf"
const language = settings.get("language");
```

#### Parameters

| Name | Type   | Description        |
| ---- | ------ | ------------------ |
| key  | String | Setting identifier |

#### Returns

```javascript id="e9cp7q"
any
```

If the setting does not exist, `undefined` may be returned.

---

### set()

Updates a setting.

#### Syntax

```javascript id="r4m8ya"
settings.set("language", "en");
```

#### Parameters

| Name  | Type   | Description        |
| ----- | ------ | ------------------ |
| key   | String | Setting identifier |
| value | Any    | New value          |

Changes are persisted automatically.

---

### has()

Checks whether a setting exists.

#### Syntax

```javascript id="z7p4dw"
const exists = settings.has("language");
```

#### Returns

```javascript id="p6ax8g"
Boolean
```

---

### delete()

Removes a setting.

#### Syntax

```javascript id="w3m7kt"
settings.delete("language");
```

---

> **Note:** In WebRadio 1.0.7-alpha.1, the plugin-facing Settings API does not expose `reset()`, `resetAll()` or `getDefaults()`.


---

# Settings Scope (1.0.7-alpha.1)

The plugin-facing Settings API gives plugins access to selected global settings, not to a separate per-plugin settings namespace.

That means:

* plugins should use settings for shared configuration values where appropriate
* plugins should still use Storage for plugin-specific persistent data
* plugins should not assume a built-in per-plugin settings UI or defaults system

---

# Data Types (1.0.7-alpha.1)

Settings commonly store:

* String
* Number
* Boolean
* Array
* Object

Values should be serializable.

---

# Validation

Plugins should validate values before saving them.

Example:

```javascript id="d2mk7n"
if (volume < 0 || volume > 100) {

    throw new Error(

        "Volume must be between 0 and 100."

    );

}
```

Validation helps prevent invalid configurations.

---

# Error Handling

Settings operations may fail if:

* Validation fails.
* The storage backend is unavailable.
* A value cannot be serialized.

Plugins should handle these situations gracefully.

---

# Best Practices

✔ Provide default values inside the plugin when needed.

✔ Validate user input.

✔ Use descriptive setting names.

✔ Group related settings logically.

✔ Store only configuration values.

✔ Keep settings backwards compatible when possible.

---

# Common Mistakes

Typical mistakes include:

* Storing runtime state.
* Using cryptic setting names.
* Omitting default values.
* Ignoring validation.
* Changing setting names between releases without migration.

Settings should remain stable across plugin updates.

---

# Related APIs

The Settings service commonly works together with:

* PluginContext
* Storage
* Logger

---

# Example (1.0.7-alpha.1)

```javascript id="v9nq2e"
const autoplay = context.settings.get("autoplay");

if (autoplay) {

    context.logger.info("Autoplay enabled.");

}
```

---

# See Also

* PluginContext
* Storage
* Logger
* Application
