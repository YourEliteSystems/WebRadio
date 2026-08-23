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

# Methods

## get()

Returns a stored value.

### Syntax

```javascript id="bp5ks9"
const value = await storage.get(key);
```

### Parameters

| Name | Type   | Description |
| ---- | ------ | ----------- |
| key  | String | Storage key |

### Returns

```javascript id="xw3mke"
Promise<any>
```

Returns `undefined` if the key does not exist.

---

## set()

Stores a value.

### Syntax

```javascript id="k8zv5m"
await storage.set(key, value);
```

### Parameters

| Name  | Type   | Description    |
| ----- | ------ | -------------- |
| key   | String | Storage key    |
| value | Any    | Value to store |

Existing values are overwritten.

---

## has()

Checks whether a key exists.

### Syntax

```javascript id="q5pmh7"
const exists = await storage.has(key);
```

### Returns

```javascript id="q7xep3"
Promise<Boolean>
```

---

## delete()

Removes a stored value.

### Syntax

```javascript id="m2wghk"
await storage.delete(key);
```

Returns successfully even if the key does not exist.

---

## clear()

Removes every stored value belonging to the current plugin.

### Syntax

```javascript id="p2mdvs"
await storage.clear();
```

Use with care.

---

## keys()

Returns every stored key.

### Syntax

```javascript id="rk0ep9"
const keys = await storage.keys();
```

### Returns

```javascript id="d6fxzg"
Promise<Array<String>>
```

---

## values()

Returns every stored value.

### Syntax

```javascript id="w0zn4h"
const values = await storage.values();
```

---

## entries()

Returns key/value pairs.

### Syntax

```javascript id="sh91yr"
const entries = await storage.entries();
```

### Returns

```javascript id="ps2yd7"
Promise<Array<[String, Any]>>
```

---

# Namespaces

Storage is automatically isolated.

```text id="f8yk32"
Plugin A

↓

Storage A

Plugin B

↓

Storage B
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
* Settings
* Logger

---

# Example

```javascript id="u9fphx"
await context.storage.set("volume", 75);

const volume = await context.storage.get("volume");

if (await context.storage.has("volume")) {

    context.logger.info(

        `Volume: ${volume}`

    );

}
```

---

# See Also

* PluginContext
* Settings
* Logger
* Application
