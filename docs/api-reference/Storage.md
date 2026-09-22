# Storage

The `Storage` service provides persistent data storage for plugins.

Each plugin receives its own isolated storage area through the `PluginContext`.

The Storage API is designed to be simple, reliable and independent from the underlying storage implementation.

Plugins should never access files directly for persistent plugin data.

---

# Responsibilities

The Storage service is responsible for:

* Persisting plugin data
* Reading stored values
* Updating existing values
* Removing stored values
* Managing plugin-specific storage
* Abstracting the storage backend

Every plugin has its own isolated storage namespace.

---

# Accessing Storage

Storage is available through the `PluginContext`.

Example:

```javascript id="n4tw3h"
const storage = context.storage;
```

Plugins should never instantiate the Storage service themselves.

---

# Methods (1.0.7-alpha.1)

The current plugin-facing Storage API provides synchronous access to a plugin's isolated storage file.

### get()

Returns a stored value.

### Syntax

```javascript id="bp5ks9"
const value = storage.get(key);
```

#### Parameters

| Name | Type   | Description |
| ---- | ------ | ----------- |
| key  | String | Storage key |

#### Returns

```javascript id="xw3mke"
any
```

Returns `undefined` if the key does not exist.

---

### set()

Stores a value.

### Syntax

```javascript id="k8zv5m"
storage.set(key, value);
```

#### Parameters

| Name  | Type   | Description    |
| ----- | ------ | -------------- |
| key   | String | Storage key    |
| value | Any    | Value to store |

Existing values are overwritten.

---

### has()

Checks whether a key exists.

### Syntax

```javascript id="q5pmh7"
const exists = storage.has(key);
```

#### Returns

```javascript id="q7xep3"
Boolean
```

---

### delete()

Removes a stored value.

### Syntax

```javascript id="m2wghk"
storage.delete(key);
```

Returns successfully even if the key does not exist.

---

### exists()

Checks whether the plugin storage file exists.

### Syntax

```javascript id="p2mdvs"
const exists = storage.exists();
```

#### Returns

```javascript id="d6fxzg"
Boolean
```

---

### read()

Returns the full plugin storage object.

### Syntax

```javascript id="w0zn4h"
const data = storage.read();
```

#### Returns

```javascript id="sh91yr"
Object
```

---

### write()

Replaces the full plugin storage object.

### Syntax

```javascript id="sh91yr"
storage.write(data);
```

#### Parameters

| Name | Type   | Description         |
| ---- | ------ | ------------------- |
| data | Object | New storage content |

---

### remove()

Removes a key from the plugin storage object.

### Syntax

```javascript id="sh91yr"
storage.remove(key);
```

---

### clear()

Removes the plugin storage file entirely.

### Syntax

```javascript id="sh91yr"
storage.clear();
```

Use with care.

> **Note:** In WebRadio 1.0.7-alpha.1, Storage is not async and does not expose `keys()`, `values()` or `entries()`.


---

# Isolation

Storage is automatically isolated per plugin.

```text id="f8yk32"
Plugin A

↓

Plugin Storage A

Plugin B

↓

Plugin Storage B
```

Plugins cannot access another plugin's storage.

---

# Data Types

The Storage API supports common JavaScript data types.

Examples include:

* String
* Number
* Boolean
* Object
* Array
* null

Values should be serializable.

---

# Error Handling

Storage operations may fail if:

* Data cannot be written.
* The storage backend is unavailable.
* Serialization fails.

Errors should always be handled gracefully.

---

# Best Practices

✔ Store only plugin-specific data.

✔ Keep values reasonably small.

✔ Prefer structured objects over many individual keys.

✔ Validate stored data before use.

✔ Handle missing values safely.

✔ Use meaningful key names.

---

# Common Mistakes

Typical problems include:

* Storing temporary runtime data.
* Saving large binary files.
* Assuming keys always exist.
* Ignoring failed storage operations.
* Using generic key names.

Persistent storage should remain clean and predictable.

---

# Related APIs

The Storage service commonly works together with:

* PluginContext
* Logger

---

# Example (1.0.7-alpha.1)

```javascript id="u9fphx"
if (!context.storage.exists()) {

    context.storage.set("volume", 75);

}

const volume = context.storage.get("volume");

if (context.storage.has("volume")) {

    context.logger.info(`Volume: ${volume}`);

}
```

---

# See Also

* PluginContext
* Logger
* Application

> In WebRadio 1.0.7-alpha.1, `context.storage` does not expose async methods and does not include `keys()`, `values()` or `entries()`.
