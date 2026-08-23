# WebRadio API Reference

Welcome to the WebRadio API Reference.

This documentation describes every public API available to plugin and theme developers.

Unlike the Plugin SDK and Theme SDK, which focus on learning and practical examples, the API Reference serves as the official technical specification for the WebRadio SDK.

---

# Purpose

The API Reference provides detailed information about every public class, interface and service exposed by WebRadio.

For each API you will find:

* Overview
* Responsibilities
* Constructors
* Properties
* Methods
* Parameters
* Return values
* Events
* Permissions
* Examples
* Best practices

This documentation is intended to be used alongside the Plugin SDK.

---

# Who Is This For?

The API Reference is intended for developers who already understand the basics of WebRadio development and need detailed information about a specific API.

If you are new to WebRadio development, it is recommended to complete the Plugin SDK before using this reference.

---

# API Categories

The WebRadio SDK is organized into several categories.

```text
Application

↓

Plugin System

↓

Theme System

↓

Storage

↓

Events

↓

Hooks

↓

Settings

↓

Commands

↓

Windows

↓

Menus

↓

Notifications

↓

Utilities
```

Each category is documented separately.

---

# Documentation Format

Every API document follows the same structure.

```text
Overview

Responsibilities

Constructor

Properties

Methods

Events

Permissions

Examples

Best Practices

Related APIs
```

Using a consistent format makes the documentation easier to navigate.

---

# Stability

Only documented APIs are considered public.

Plugins should never depend on:

* Internal classes
* Private methods
* Undocumented properties
* Internal implementation details

Using only public APIs ensures compatibility with future WebRadio releases.

---

# Versioning

Every documented API belongs to a specific WebRadio SDK version.

Future releases may introduce:

* New methods
* New services
* Additional events
* New extension points

Whenever possible, changes will remain backwards compatible.

---

# Code Examples

Most API documents include practical examples.

Example:

```javascript
const logger = context.logger;

logger.info("Plugin started.");
```

Examples are intentionally simple and focus on demonstrating the API.

---

# Conventions

Throughout this reference:

* JavaScript examples use modern syntax.
* Public classes use PascalCase.
* Methods use camelCase.
* Constants use UPPER_CASE.
* Event names use dot notation where applicable.

These conventions are used consistently across the entire SDK.

---

# Related Documentation

The API Reference complements the following documentation:

* Architecture
* Plugin SDK
* Theme SDK

Together, these documents provide a complete overview of WebRadio development.

---

# Next Step

Begin with **Application.md** to understand the central application lifecycle and the role of the Application class within WebRadio.
