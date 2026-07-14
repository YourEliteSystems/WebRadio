# WebRadio Plugin SDK

Welcome to the **WebRadio Plugin SDK**.

This documentation explains everything you need to know to develop plugins for WebRadio.

Whether you are creating your very first extension or building a complex integration, this guide will walk you through every part of the plugin development process.

The Plugin SDK is designed to provide a stable, consistent and easy-to-use interface between your plugin and the WebRadio Core.

---

# What are Plugins?

Plugins allow you to extend WebRadio without modifying the application's source code.

A plugin can add entirely new functionality while remaining independent from the core application.

Examples include:

* Music service integrations
* Discord Rich Presence
* Notification providers
* Audio visualizers
* Custom sidebar pages
* Settings pages
* Utility tools
* Developer tools
* External service integrations

The goal of the Plugin SDK is to make plugin development simple while keeping the WebRadio Core stable and maintainable.

---

# Why use the Plugin SDK?

The Plugin SDK provides a structured way to interact with WebRadio.

Using the SDK ensures that your plugin:

* integrates cleanly with the application,
* remains compatible with future versions,
* follows the same lifecycle as every other plugin,
* can safely access public APIs,
* remains isolated from the application core.

Plugins should never modify internal application components directly.

Instead, they should communicate through the public Plugin API.

---

# Plugin Lifecycle

Every plugin follows the same lifecycle.

```text
Plugin Folder

↓

Manifest Validation

↓

Registration

↓

Initialization

↓

Running

↓

Shutdown
```

Understanding this lifecycle is essential before developing plugins.

The following chapters explain every stage in detail.

---

# What you will learn

This guide covers every aspect of plugin development.

Topics include:

* Creating your first plugin
* Understanding the manifest
* Organizing project files
* Plugin lifecycle
* Plugin context
* Storage API
* Events
* Hooks
* User interface integration
* Best practices
* Example plugins

No previous knowledge of WebRadio internals is required.

---

# Requirements

Before developing plugins, you should be familiar with:

* JavaScript (ES2022 or newer)
* Node.js
* JSON
* Basic Electron concepts

Knowledge of the internal WebRadio architecture is helpful but not required.

---

# Documentation Structure

The Plugin SDK is organized into the following chapters.

```text
README

↓

Getting Started

↓

Manifest

↓

Project Structure

↓

Lifecycle

↓

Plugin Context

↓

Storage

↓

Events

↓

Hooks

↓

UI Integration

↓

Best Practices

↓

Hello World

↓

FAQ
```

Each chapter builds upon the previous one.

For the best learning experience, it is recommended to read them in order.

---

# Design Philosophy

The Plugin SDK follows a few important principles.

## Stability

Public APIs should remain stable whenever possible.

---

## Simplicity

Common tasks should require as little code as possible.

---

## Isolation

Plugins should operate independently and should not interfere with each other.

---

## Extensibility

The SDK is designed to grow alongside WebRadio without breaking existing plugins.

---

# Need Help?

If you encounter issues while developing a plugin, consider the following resources:

* Plugin SDK documentation
* Architecture documentation
* API Reference
* GitHub Issues
* GitHub Discussions

---

# Next Step

Continue with **Getting Started** to create your first WebRadio plugin.
