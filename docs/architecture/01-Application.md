# Application

The `Application` class is the central entry point of WebRadio.

It coordinates the complete application lifecycle, initializes all core systems and ensures that every subsystem starts and stops in a predictable order.

Rather than allowing every component to initialize itself independently, WebRadio uses the `Application` class as a central orchestrator.

---

# Responsibilities

The Application is responsible for:

* Starting the application
* Initializing all core services
* Creating the main window
* Registering IPC handlers
* Loading themes
* Loading plugins
* Initializing diagnostics
* Registering media keys
* Creating the system tray
* Performing a clean shutdown

The Application **does not** implement the functionality of these systems itself.

Instead, it delegates every responsibility to the corresponding manager.

---

# Lifecycle

The Application has a simple lifecycle.

```text
Application

↓

start()

↓

Initialize Core Services

↓

Running

↓

shutdown()
```

Every component should assume that the Application controls its lifetime.

Components should never start themselves automatically.

---

# Startup Sequence

A simplified startup process is shown below.

```text
Application.start()

↓

StorageManager

↓

Diagnostics

↓

WindowManager

↓

IPC

↓

ThemeManager

↓

PluginManager

↓

Media Keys

↓

Tray

↓

Ready
```

Each step depends on the previous one being initialized successfully.

This guarantees a deterministic startup process.

---

# Why a Central Application?

Before introducing the Application class, startup logic was distributed across multiple files.

As the project grew, this became increasingly difficult to maintain.

By introducing a dedicated Application class:

* startup became easier to understand,
* initialization order became deterministic,
* debugging became simpler,
* shutdown became centralized,
* future extensions became easier.

The Application therefore acts as the foundation of the entire WebRadio architecture.

---

# Design Principles

The Application follows several important design principles.

## Single Responsibility

The Application coordinates the startup process.

It does **not** contain business logic.

---

## Delegation

Every subsystem is responsible for its own implementation.

The Application only tells each subsystem **when** it should start or stop.

---

## Predictable Initialization

All services are initialized in a predefined order.

This prevents race conditions and hidden dependencies.

---

## Extensibility

Adding a new subsystem should usually require only a single additional initialization step inside the Application.

No other subsystem should require modifications.

---

# Shutdown

The shutdown process mirrors the startup process.

Resources are released in a controlled order.

Typical shutdown tasks include:

* unregister media keys
* destroy tray
* stop plugins
* save pending data
* close diagnostics
* release application resources

A clean shutdown reduces the risk of corrupted user data and improves application stability.

---

# Best Practices

✔ Keep the Application lightweight.

✔ Never move business logic into the Application.

✔ Let managers own their own functionality.

✔ Keep the startup order deterministic.

✔ Initialize every subsystem only once.

✔ Shutdown should mirror startup whenever possible.

---

# Related Documentation

* Architecture
* StorageManager
* WindowManager
* PluginManager
* ThemeManager
* Diagnostics
* IPC
