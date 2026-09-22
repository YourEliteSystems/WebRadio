# Capabilities & Plugin HTTP Environment

This chapter describes the current capability model, how plugin permissions relate to capabilities, and how the plugin HTTP environment is controlled by the core.

It is written for WebRadio **1.0.7-alpha.1**.

---

## Purpose

Capabilities are the core-controlled mechanism that decides what a plugin may do beyond basic permissions.

The critical rule for this release is simple:

- Plugins can **request** capabilities.
- Plugins **cannot grant** capabilities.
- Plugins **cannot extend** the security model.
- Plugins **cannot change** core enforcement.

If a capability is not known to the core, the request is rejected.

---

## Where Capabilities Fit

The overall decision flow is:

```text
Plugin
  ↓
Manifest Capabilities + Permissions
  ↓
Core Validation (PluginPermissions + CapabilityRegistry)
  ↓
Core Security Policy
  ↓
Capability Granted / Denied
  ↓
PluginContext / PluginAPI
  ↓
Controlled Runtime
```

This flow is enforced by the core. It is not optional and it is not reconfigurable by plugins.

---

## Capabilities vs Permissions

These are related but different concepts.

- **Permissions** control access to core services such as events, storage, settings, navigation, UI, player and notifications.
- **Capabilities** control more specific runtime behavior, especially HTTP-origin behavior and provider-specific access.

A capability may require a permission, but a permission does not automatically grant a capability.

For the current permission list, see the plugin manifest and Plugin API documentation.

---

## Known Capabilities (1.0.7-alpha.1)

The following capabilities are currently defined by the core:

- `http-origin`
- `local-assets`
- `external-origin`
- `youtube-iframe`
- `youtube-api`
- `player`

Unknown capabilities are always denied.

---

### http-origin

Allows a plugin to serve its own resources through the local plugin HTTP server.

This capability is localhost-only.

---

### local-assets

Allows a plugin to access its own local assets through the plugin HTTP environment.

It requires `http-origin`.

Access is restricted to the plugin root.

---

### external-origin

Allows a plugin to request specific external origins.

It requires `http-origin`.

External origins are not granted automatically. They must be explicitly allowed by the core for the requested capability.

---

### youtube-iframe

Allows a plugin to use the YouTube IFrame API.

It requires `external-origin`.

Only explicitly allowed YouTube-related origins are permitted.

---

### youtube-api

Allows a plugin to use the extended YouTube IFrame API.

It requires `youtube-iframe`.

The same allowed-origin rules apply.

---

### player

Allows a plugin to use the Unified Player API.

No external-origin access is implied by this capability.

---

## Capability Requirements

A capability can depend on another capability or permission.

Examples from the current implementation:

- `local-assets` requires `http-origin`
- `external-origin` requires `http-origin`
- `youtube-iframe` requires `external-origin`
- `youtube-api` requires `youtube-iframe`

If the required base capability or permission is missing, the capability is denied.

---

## Core Enforcement

The core decides:

- whether a capability is known
- whether the required permission/capability is present
- whether a requested origin is allowed for the granted capabilities
- whether capabilities are protected from plugin-side reconfiguration

The current implementation includes protected capabilities. A protected capability cannot be treated as a freely reconfigurable plugin concern. The exact set is defined by the core.

---

## Plugin HTTP Environment

Plugins with `http-origin` do not get unrestricted web access. They get a controlled local HTTP environment.

Current properties:

- The server listens only on `127.0.0.1`.
- The port is dynamically assigned.
- Only registered plugin paths are served.
- Path traversal is blocked. A requested file must stay inside the plugin root.
- CORS is restricted and tied to allowed origins.
- Only `GET` and `HEAD` are allowed.
- Origin validation is performed for plugin resource requests.
- The server is started and stopped by the core lifecycle.

---

### What the Plugin HTTP Environment Is Not

It is **not** a general-purpose proxy.

In particular:

- Plugins cannot open arbitrary external origins by themselves.
- Plugins cannot bypass the capability model.
- Plugins cannot serve files outside their own plugin directory.
- Plugins cannot override core CORS or origin rules.

The core controls which origins are allowed for which capabilities.

---

## Origin Control

Origin control is capability-based.

For capabilities that require explicit origins, the core checks whether the origin is allowed for that capability. If it is not, access is denied.

For localhost-only capabilities, external origins are not allowed.

This means the plugin HTTP environment is intentionally narrow. It is designed for plugin resources and for specific integrations such as MediaHub, not for general web access.

---

## MediaHub as the First Concrete Use Case

MediaHub is the first implemented example of this capability and HTTP model.

It uses:

- the plugin HTTP environment for its own resources
- the appropriate capabilities for YouTube integration
- the Unified Player API to report playback state
- core-controlled origin rules for external YouTube-related requests

MediaHub should be documented as an application of the generic system, not as a special core exception.

---

## Plugin Lifecycle and HTTP Server

The plugin HTTP server is part of the core lifecycle.

- It starts during application initialization.
- It serves only plugins that have been registered for HTTP serving.
- It stops during application shutdown.

Plugins do not own the HTTP server. They only participate in it after the core has granted the relevant capability and registered the plugin path.

---

## Security Boundaries

The capability model supports the following security boundaries in this release:

- plugin isolation through controlled API access
- localhost-only plugin HTTP serving
- path traversal protection
- origin validation for plugin resource requests
- restricted CORS behavior
- capability-based external origin rules
- core-controlled enforcement with no plugin-side override

This documentation does not claim more than the implementation provides.

---

## What Is Not Implemented Yet

The following are **not** part of 1.0.7-alpha.1:

- Plugin Store
- Theme Store
- Online package sources
- Remote plugin/theme installation from within the app
- Automatic plugin/theme updates
- Cloud synchronization

The capability system is the foundation for a future installer/store, but the store itself is not implemented.

---

## Related Documentation

- Plugin SDK
- Plugin API
- Plugin Manifest
- Architecture
- Update Architecture
- Security
