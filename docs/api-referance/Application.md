# Application

The `Application` class is the central entry point of WebRadio.

It is responsible for initializing the application, coordinating all core services and managing the application lifecycle.

Every major subsystem is initialized through the `Application` class.

---

# Responsibilities

The Application class coordinates the startup and shutdown of WebRadio.

Typical responsibilities include:

* Initialize configuration
* Initialize storage
* Initialize logging
* Initialize themes
* Initialize plugins
* Initialize events
* Create application windows
* Manage lifecycle events
* Shutdown services

The Application acts as the central coordinator of the entire system.

---

# Lifecycle

A typical startup sequence looks like this:

```text id="s2t8vh"
Application

↓

Initialize Storage

↓

Initialize Logger

↓

Initialize Configuration

↓

Initialize ThemeManager

↓

Initialize PluginManager

↓

Register Core Services

↓

Create Windows

↓

Application Ready
```

Each subsystem is initialized in a defined order to ensure dependencies are available.

---

# Constructor

## Syntax

```javascript id="h81yrp"
const app = new Application();
```

The constructor prepares the application instance but does not automatically start it.

---

# Methods

## start()

Starts the complete WebRadio application.

### Syntax

```javascript id="cwkm4v"
await application.start();
```

### Description

The `start()` method initializes all required services and launches the application.

---

## shutdown()

Gracefully shuts down the application.

### Syntax

```javascript id="cx7d4q"
await application.shutdown();
```

### Description

This method stops services, unloads plugins and releases allocated resources.

---

## initializeStorage()

Initializes the Storage subsystem.

This method is executed during startup before any subsystem requires file access.

---

## initializeLogger()

Initializes the logging system.

The logger becomes available to all subsequent services.

---

## initializeThemes()

Discovers, validates and loads available themes.

Themes are registered before the user interface is created.

---

## initializePlugins()

Discovers and loads all installed plugins.

Each plugin is validated before activation.

---

## createWindows()

Creates the application's windows.

Typical windows include:

* Main Window
* Settings Window
* Future auxiliary windows

---

# Events

The Application lifecycle may expose events such as:

```text id="n9p2mk"
application.starting

application.ready

application.shutdown

application.error
```

These events allow plugins to react to major lifecycle stages.

---

# Error Handling

If a subsystem fails during startup:

* The error is logged.
* Startup may stop or continue depending on severity.
* Critical failures prevent the application from launching.

Graceful error handling improves stability.

---

# Best Practices

✔ Keep startup logic inside the Application class.

✔ Initialize services in a predictable order.

✔ Release resources during shutdown.

✔ Avoid performing unrelated work directly inside `start()`.

✔ Delegate responsibilities to dedicated managers.

---

# Related APIs

The Application class interacts closely with:

* PluginManager
* ThemeManager
* Storage
* Logger
* Events
* Windows

These services together form the WebRadio Core.

---

# Example

```javascript id="8q5xnf"
const application = new Application();

await application.start();
```

The Application initializes the complete WebRadio environment and prepares it for user interaction.

---

# See Also

* PluginManager
* ThemeManager
* Storage
* Logger
* Events
* Windows
