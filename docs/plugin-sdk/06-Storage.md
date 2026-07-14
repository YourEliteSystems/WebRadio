# Storage

The WebRadio Plugin SDK provides a dedicated Storage API for storing persistent plugin data.

Each plugin receives its own isolated storage area, allowing data to be saved safely without interfering with other plugins or the WebRadio Core.

The Storage API should be used whenever a plugin needs to remember information between application launches.

---

# Why Storage?

Plugins often need to save information such as:

* User preferences
* Authentication tokens
* API keys
* Cached data
* Last connected server
* Recently used values
* Window state

Without persistent storage, this information would be lost every time WebRadio closes.

---

# Accessing Storage

The Storage API is available through the Plugin Context.

Example:

```javascript
async onEnable(context) {

    this.storage = context.storage;

}
```

The storage instance is unique for every plugin.

---

# Writing Data

Use `set()` to store a value.

```javascript
await context.storage.set(
    "volume",
    75
);
```

Values are automatically stored inside the plugin's private storage.

---

# Reading Data

Use `get()` to retrieve previously stored values.

```javascript
const volume =
    await context.storage.get(
        "volume"
    );
```

If the key exists, its value is returned.

---

# Default Values

A default value may be provided when reading data.

```javascript
const volume =
    await context.storage.get(
        "volume",
        50
    );
```

If the key does not exist, the default value is returned instead.

---

# Removing Data

Stored values can be removed individually.

```javascript
await context.storage.delete(
    "volume"
);
```

Removing a key permanently deletes its value.

---

# Checking for Existing Values

Plugins can determine whether a key already exists.

```javascript
const exists =
    await context.storage.has(
        "volume"
    );
```

The method returns either:

* `true`
* `false`

---

# Clearing Storage

All stored plugin data can be removed.

```javascript
await context.storage.clear();
```

This deletes every value belonging to the current plugin.

Other plugins remain unaffected.

---

# Supported Data Types

The Storage API supports common JavaScript data types.

Examples include:

```javascript
await context.storage.set("name", "WebRadio");

await context.storage.set("volume", 80);

await context.storage.set("enabled", true);

await context.storage.set("favorites", [
    "Station A",
    "Station B"
]);

await context.storage.set("settings", {

    theme: "Dark",

    notifications: true

});
```

Objects and arrays are serialized automatically.

---

# Isolation

Every plugin has its own storage namespace.

```text
Storage

├── Plugin A
│     └── settings.json
│
├── Plugin B
│     └── settings.json
│
└── Plugin C
      └── settings.json
```

Plugins cannot directly access each other's storage.

---

# Design Principles

## Isolation

Each plugin owns its own storage.

---

## Simplicity

Reading and writing data should require minimal code.

---

## Reliability

Stored data persists between application launches.

---

## Transparency

Plugins do not need to know where or how data is physically stored.

---

# Best Practices

✔ Store only plugin-specific data.

✔ Keep stored objects reasonably small.

✔ Use descriptive key names.

✔ Provide sensible default values.

✔ Remove obsolete data when it is no longer needed.

✔ Never store temporary runtime state unless persistence is required.

---

# Common Mistakes

Typical storage issues include:

* Storing unnecessary data.
* Using generic key names.
* Saving large binary files.
* Forgetting default values.
* Assuming data always exists.

The Storage API is intended for configuration and persistent plugin data, not for large file storage.

---

# Future Improvements

Future SDK versions may introduce additional features such as:

* Encrypted storage
* Automatic schema migration
* Transaction support
* Storage events
* Import and export functionality
* Cloud synchronization

These enhancements will remain compatible with existing plugins whenever possible.

---

# Next Step

Continue with **Events** to learn how plugins can react to changes inside WebRadio.
