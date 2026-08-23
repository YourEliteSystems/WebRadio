# Logger

The `Logger` service provides structured logging for plugins and the WebRadio Core.

It offers a consistent way to record informational messages, warnings, debugging output and errors.

Plugins should always use the Logger service instead of calling `console.log()` directly.

---

# Responsibilities

The Logger service is responsible for:

* Recording application events
* Reporting plugin activity
* Logging warnings
* Logging errors
* Supporting debugging
* Providing consistent log formatting

Using the Logger helps simplify debugging and improves diagnostics.

---

# Accessing the Logger

The Logger is available through the `PluginContext`.

Example:

```javascript id="r1kj6d"
const logger = context.logger;
```

Plugins should never create their own Logger instance.

---

# Log Levels

The Logger supports multiple log levels.

```text id="x5mrh2"
Debug

Info

Warn

Error

Fatal
```

Each level serves a different purpose.

---

# Methods

## debug()

Writes a debug message.

### Syntax

```javascript id="yk4t1p"
logger.debug("Loading stations...");
```

Use this method for development and troubleshooting.

---

## info()

Writes an informational message.

### Syntax

```javascript id="n8qz7v"
logger.info("Plugin started.");
```

Informational messages describe normal application behaviour.

---

## warn()

Writes a warning message.

### Syntax

```javascript id="cm4u9a"
logger.warn("Station metadata is incomplete.");
```

Warnings indicate recoverable situations.

---

## error()

Writes an error message.

### Syntax

```javascript id="q2ep6n"
logger.error(error);
```

Errors indicate failed operations.

---

## fatal()

Writes a critical error message.

### Syntax

```javascript id="p4vb8q"
logger.fatal("Plugin initialization failed.");
```

Fatal messages should only be used for unrecoverable failures.

---

# Message Formatting

Log messages should be concise and descriptive.

Recommended:

```javascript id="u6pm4k"
logger.info(

    "Station list refreshed."

);
```

Avoid:

```javascript id="v3jq8m"
logger.info("Done");
```

Descriptive messages are easier to understand during debugging.

---

# Error Logging

When logging errors, include the original Error object whenever possible.

Example:

```javascript id="t8mw6r"
try {

    await loadStations();

}

catch (error) {

    logger.error(error);

}
```

This preserves stack traces and additional error details.

---

# Debug Logging

Debug messages should provide useful development information without cluttering production logs.

Examples:

* Initialization progress
* Loaded resources
* API responses
* Performance information

---

# Best Practices

✔ Use the correct log level.

✔ Write descriptive messages.

✔ Log caught exceptions.

✔ Keep log output readable.

✔ Avoid excessive logging inside loops.

✔ Use debug messages for development only.

---

# Common Mistakes

Typical mistakes include:

* Using `console.log()` directly.
* Logging sensitive information.
* Logging every minor operation.
* Using `error()` for warnings.
* Writing unclear messages.

Good logging improves troubleshooting without overwhelming the log output.

---

# Related APIs

The Logger commonly works together with:

* PluginContext
* Storage
* Events
* Application

---

# Example

```javascript id="w7mk3n"
logger.info("Plugin started.");

logger.debug("Loading configuration...");

logger.warn("Configuration file not found.");

try {

    await initialize();

}

catch (error) {

    logger.error(error);

}
```

---

# See Also

* PluginContext
* Storage
* Events
* Application
