# WebRadio Roadmap

This roadmap outlines the long-term vision and planned development of WebRadio.

It is intended to provide transparency for contributors, users and plugin developers by communicating the current direction of the project.

The roadmap is not a guarantee of future functionality. Priorities may change as the project evolves.

---

# Vision

WebRadio aims to become a modern, extensible and cross-platform desktop radio player built around a stable Plugin SDK and Theme SDK.

The project's primary goals are:

* Excellent developer experience
* High extensibility
* Stable public APIs
* Modern architecture
* Strong documentation
* Long-term maintainability
* Open Source collaboration

---

# Current Status

Current Version

```text
v1.0.7-alpha.5
```

Current Release Stage

```text
Alpha
```

Project Status

```text
Active Development
```

---

# Current Milestone

## Version 1.0.7 (alpha)

Implemented in the current development line:

* Unified Player (PlayerManager, Provider system, RadioProvider, MediaHubProvider)
* Plugin System (PluginManager, PluginLoader, PluginRuntime, PluginContext, PluginAPI)
* Capability System (CapabilityRegistry, validation and enforcement)
* Plugin HTTP Environment (core-controlled localhost HTTP server for plugins)
* Update Channels (alpha / beta / latest with centralized channel detection)
* Theme System (ThemeManager, ThemeLoader, ThemeValidator, built-in and user themes)
* Diagnostics (BootupDiagnostics, crash reports, logging)
* Plugin SDK, Theme SDK and API Reference documentation

Still in progress:

* Documentation consistency across all chapters
* Examples and tutorials

Status:

```text
████████████████░░░░ 80%
```

---

# Explicitly Not Implemented (v1.0.7-alpha.5)

The following features are **not** part of the current release. The Capability System is designed as the foundation for them, but the features themselves do not exist yet:

* Plugin Store / Marketplace
* Theme Store
* Online package sources
* Remote plugin or theme installation from within the app
* Automatic plugin or theme updates
* Cloud synchronization

> The Capability System allows a future installer to show a permission and security overview based on a plugin manifest. The installer and store themselves are **not implemented**.

---

# Upcoming Milestones

## v1.1 — Extension & Package Architecture

The focus of v1.1 is to establish a clean, generic foundation for managing plugins and themes without requiring Core changes for individual extensions.

### Plugin & Package Management

* Generic Package Loader
* Package Validator
* Package Registry
* Package Installer
* Local package source
* App-bundled and user-installed packages
* User package directories under the WebRadio user data directory
* Legacy `plugin.json` and `theme.json` compatibility
* Generic install / update / remove lifecycle
* Plugin activation and deactivation
* Plugin version and runtime status
* Package lifecycle events
* Permission enforcement before exposing plugin capabilities

### Plugin Updates

* Installed plugin version information
* Available-version information
* Plugin update handling
* Dedicated plugin update management
* Foundation for future "Update all" functionality
* Preparation for rollback-safe updates where practical

### Future Package Sources

The architecture should allow additional package sources without changing the Core package system:

* Local source
* GitHub source
* HTTP source
* Future WebRadio package/store source

Remote stores and automatic online updates remain future functionality and are **not** part of the initial v1.1 implementation.

### SDK & Documentation

* Continue stabilizing the public Plugin SDK
* Document package and lifecycle APIs
* Keep Core generic and independent of individual community plugins
* Preserve backward compatibility wherever practical

---

## v1.2

### User Experience

* Improved Settings
* Better Theme Support
* Better Plugin Management
* Performance Improvements

### SDK

* Additional Plugin APIs
* Theme API extensions

---

## v1.3

### Platform

* Linux improvements
* macOS improvements
* Windows improvements

### Features

* Synchronization
* Enhanced Radio Browser
* Metadata improvements

---

# Long-Term Goals

* Stable SDK
* Stable Theme API
* Plugin Marketplace
* Automatic Plugin Updates
* Automatic Theme Updates
* Cloud Synchronization
* Multiple Audio Backends
* Localization
* Accessibility Improvements
* Performance Optimization

---

# Documentation Progress

```text
README                ██████████ 100%

Architecture          ██████████ 100%

Plugin SDK            ██████████ 100%

Theme SDK             ██████████ 100%

API Reference         ██████████ 100%

Examples              ░░░░░░░░░░   0%

Tutorials             ░░░░░░░░░░   0%
```

---

# Development Principles

WebRadio follows these principles:

* Documentation First
* Stable Public APIs
* Backward Compatibility whenever possible
* Security by Default
* Plugin Isolation
* Theme Isolation
* Clean Architecture
* Open Development

---

# Contributing

Community contributions are always welcome.

Before contributing, please read:

* CONTRIBUTING.md
* CODE_OF_CONDUCT.md
* SECURITY.md

---

# Future Ideas & Waiting List

The following ideas are intentionally kept on the roadmap and are **not immediate development tasks**.

### Community Extensions

* Further integration of complex third-party/community plugins with the stable Plugin SDK
* Community plugin compatibility testing against the finalized package architecture
* Community theme compatibility testing against the finalized package architecture

### Platform & Product Ideas

* Mobile Companion App
* Cloud Profiles
* Web Interface
* Integrated Equalizer
* Streaming Tools
* Visualizations
* Community Plugin Marketplace
* Community Theme Marketplace

These ideas are exploratory or waiting-list items and have no immediate release target unless explicitly moved into an upcoming milestone.

---

# Feedback

Suggestions, feature requests and bug reports are welcome through GitHub Issues and Discussions.

The roadmap evolves together with the project and the community.
