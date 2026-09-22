# 📖 WebRadio Architecture Guide

**Version:** 3.0
**Applies to:** WebRadio v1.0.7-alpha.1+

---

# Introduction

Welcome to the WebRadio Architecture Guide.

This document provides an overview of WebRadio's internal architecture and explains how the application's core components work together.

Unlike a traditional API reference, this guide focuses on the design decisions behind the project. It explains not only *how* WebRadio works, but also *why* it is built this way.

Understanding the architecture makes it significantly easier to contribute to the project, develop plugins, create themes or extend existing functionality.

---

# Design Philosophy

WebRadio is built around a simple philosophy:

> **Keep the core small, modular and maintainable while allowing functionality to grow through extensions.**

Every major component has a clearly defined responsibility.

Instead of creating tightly coupled systems, WebRadio separates features into independent modules that communicate through well-defined interfaces.

This approach provides several advantages:

* Better maintainability
* Easier testing
* Improved scalability
* Cleaner source code
* Simpler debugging
* Better support for plugins and themes

---

# High-Level Architecture

The application starts from a single entry point.

```text
main.js
    │
    ▼
Application
```

The `Application` class is responsible for initializing and managing every core subsystem.

Rather than placing startup logic inside `main.js`, all initialization is delegated to the `Application` class. This keeps the entry point small and makes the startup sequence predictable.

---

# Core Components

The Application initializes each subsystem in a defined order.

```text
Application
    │
    ├── StorageManager
    ├── Diagnostics
    ├── WindowManager
    ├── IPC
    ├── PluginManager
    ├── ThemeManager
    ├── Media Keys
    ├── Tray
    └── Updater

Supporting core modules:
    │
    ├── StreamManager (FFmpeg stream handling)
    ├── RadioBrowserService (station discovery)
    ├── RuntimeDetector (platform & packaging detection)
    ├── UpdateProviderFactory (provider selection)
    ├── NavigationManager (plugin-driven navigation)
    ├── ThemeManager (theme detection and activation)
    ├── PluginManager (plugin lifecycle)
    └── Diagnostics (logging and crash reporting)
```

Each subsystem is responsible for a single area of the application.

No component should perform responsibilities that belong to another subsystem.

---

# Core Module Overview

WebRadio distinguishes between high-level managers and supporting core modules.

## Managers (high-level)

* **Application** – orchestrates startup and shutdown.
* **StorageManager** – persists application and plugin data.
* **WindowManager** – manages main window and lifecycle.
* **IPC** – exposes a controlled bridge between main and renderer.
* **PluginManager** – discovers and controls plugins.
* **ThemeManager** – detects and applies themes.
* **UpdateManager** – coordinates update checks and provider selection.
* **Tray** – exposes system tray integration.
* **Diagnostics** – collects logs, runtime info and crash context.

## Supporting core modules (newer additions)

* **StreamManager** – starts and controls FFmpeg-based audio streams.
* **RadioBrowserService** – fetches station lists and metadata from the Radio Browser API.
* **RuntimeDetector** – detects platform, architecture and packaging type at runtime.
* **ProviderFactory** – selects the correct update provider for the detected runtime.
* **NavigationManager** – manages sidebar and plugin-driven navigation entries.
* **ThemeAPI / ThemeHandlers** – bridges theme selection and activation from UI to core.
* **RadioHandlers / UpdaterHandlers** – expose radio playback and update operations via IPC.

---

# Why an Application Class?

One of the biggest architectural decisions in WebRadio was introducing a dedicated `Application` class.

Instead of scattering initialization logic throughout multiple files, all startup and shutdown operations are centralized.

This provides several benefits:

* One clear application lifecycle
* Easier debugging
* Predictable startup order
* Simpler maintenance
* Better separation of responsibilities

The `Application` acts as the central coordinator of the entire desktop application.

---

# Startup Lifecycle

A simplified startup sequence looks like this:

```text
Application.start()

↓

Initialize Storage

↓

Initialize Diagnostics

↓

Create Main Window

↓

Register IPC

↓

Load Themes

↓

Load Plugins

↓

Initialize Update Manager

↓

Initialize Stream and Radio services

↓

Register Media Keys

↓

Create System Tray

↓

Application Ready
```

Every subsystem is initialized only once and in a predefined order.

The update and radio subsystems are initialized after the plugin and theme layer so that the application can make platform-specific and plugin-aware runtime decisions.

---

# Separation of Responsibilities

WebRadio follows the **Single Responsibility Principle**.

Each component has exactly one primary purpose.

For example:

* **StorageManager** manages application data.
* **PluginManager** manages plugins.
* **ThemeManager** manages themes.
* **WindowManager** manages application windows.
* **Diagnostics** collects logs and crash information.

Keeping these responsibilities separate makes the application easier to extend without introducing unwanted dependencies.

---

# Extensibility

WebRadio was designed to grow without modifying its core.

New functionality should be implemented using:

* Plugins
* Themes
* Public APIs

Whenever possible, contributors should avoid changing the core unless new infrastructure is required.

This philosophy keeps updates stable while allowing the community to extend the application.

---

# Runtime Services

In addition to managers, WebRadio uses several core runtime services:

* **StreamManager** – manages FFmpeg-based playback.
* **RadioBrowserService** – searches and caches station metadata.
* **RuntimeDetector** – detects platform, architecture and packaging type.
* **ProviderFactory** – selects the correct update provider.
* **NavigationManager** – manages sidebar and plugin navigation.

---

# Next Steps

The following documents describe each subsystem in detail:

* Application
* Plugin System
* Theme System
* Update Architecture
* Storage
* Diagnostics
* IPC
* API Reference
* StreamManager
* RadioBrowserService

Each guide builds upon the concepts introduced in this document.
