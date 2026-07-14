# StorageManager

The `StorageManager` is responsible for managing all application data used by WebRadio.

It provides a centralized location for creating, accessing and maintaining directories and files required by the application and its extensions.

Rather than allowing every subsystem to create its own folders, all filesystem operations are coordinated through the StorageManager.

---

# Responsibilities

The StorageManager is responsible for:

* Creating the application data directory
* Creating required subdirectories
* Managing storage paths
* Providing filesystem locations
* Preparing plugin storage
* Preparing theme storage
* Managing log directories
* Managing crash report directories

The StorageManager does **not** handle application settings or business logic.

Its responsibility is limited to filesystem organization.

---

# Directory Structure

A typical WebRadio installation creates the following directory structure:

```text
WebRadio/

├── config/
├── plugins/
├── plugin-data/
├── themes/
├── logs/
├── crash/
├── reports/
├── packages/
└── cache/
```

Every directory has a dedicated purpose.

---

# Startup

The StorageManager is one of the first systems initialized during application startup.

```text
Application.start()

↓

StorageManager.initialize()

↓

Verify directories

↓

Create missing directories

↓

Storage Ready
```

This guarantees that every following subsystem has a valid storage location available.

---

# Why a Central StorageManager?

Without a centralized storage system, every component would have to:

* determine storage locations,
* create directories,
* verify paths,
* handle missing folders.

This would duplicate code across the project.

By introducing the StorageManager:

* directory management exists only once,
* filesystem paths remain consistent,
* maintenance becomes easier,
* plugins can rely on predefined locations.

---

# Directory Responsibilities

## config/

Stores application configuration files.

---

## plugins/

Contains installed plugins.

Each plugin has its own directory.

---

## plugin-data/

Contains persistent plugin data.

Plugins should never write data outside their own storage directory.

---

## themes/

Contains installed themes.

Each theme resides inside its own directory.

---

## logs/

Stores application log files.

Used by the Diagnostics subsystem.

---

## crash/

Stores crash dumps and crash reports.

---

## reports/

Contains generated diagnostic reports.

---

## packages/

Reserved for downloaded packages and future package management.

---

## cache/

Stores temporary data that may safely be recreated.

Applications should never depend on cached data.

---

# Design Principles

The StorageManager follows several architectural principles.

## Centralization

All filesystem paths originate from a single component.

---

## Predictability

Every installation uses the same directory structure.

---

## Isolation

Plugins should only access their own data directories.

Themes should remain read-only whenever possible.

---

## Extensibility

Adding new storage locations should require changes only inside the StorageManager.

---

# Best Practices

✔ Always request paths through the StorageManager.

✔ Never hardcode filesystem locations.

✔ Create directories only through the StorageManager.

✔ Keep plugin data separated from application data.

✔ Treat cache data as disposable.

---

# Related Documentation

* Architecture
* Application
* PluginManager
* ThemeManager
* Diagnostics
* Plugin SDK
