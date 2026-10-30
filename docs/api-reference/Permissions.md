# Permissions

The `Permissions` service defines which capabilities a plugin is allowed to access.

Permissions protect both the user and the WebRadio application by limiting plugin access to sensitive functionality.

Plugins should request only the permissions they actually require.

---

# Responsibilities

The Permissions service is responsible for:

* Defining plugin permissions (including the optional `media-control` permission)
* Validating requested permissions
* Restricting access to protected APIs
* Improving application security
* Informing users about plugin capabilities

Every plugin should follow the principle of least privilege.

---

# Permission Declaration

Permissions are declared inside the plugin manifest.

Example:

```json
{
    "permissions": [

        "storage",

        "notifications",

        "commands"

    ]
}
```

Plugins should only request permissions that are necessary.

---

# Permission Categories

WebRadio groups permissions into logical categories.

```text
Storage

Settings

Notifications

Commands

Menus

Windows

Events

Hooks

Network

Filesystem

Theme

Media

Clipboard

Developer
```

Additional permissions may be introduced in future SDK versions.

---

# Checking Permissions

Plugins may verify whether a permission is available.

### Syntax

```javascript
const allowed =

context.permissions.has("storage");
```

### Returns

```text
Boolean
```

---

# Methods

## has()

Checks whether a permission has been granted.

### Syntax

```javascript
context.permissions.has("notifications");
```

Returns:

```text
Boolean
```

---

## getPermissions()

Returns every granted permission.

### Syntax

```javascript
const permissions =

context.permissions.getPermissions();
```

Returns:

```text
Array<String>
```

---

## request()

Requests an optional permission.

### Syntax

```javascript
await context.permissions.request(

    "clipboard"

);
```

Whether runtime permission requests are supported depends on the current platform and application configuration.

---

## System media controls

The optional `media-control` permission, together with the `media-controls` capability, allows a plugin to read Unified Player state, subscribe to state changes, inspect supported actions, and request `play`, `pause`, `next`, or `previous`. It does not expose Electron objects, IPC, FFmpeg, or audio resources. Missing either declaration denies each media-controls API call. Example:

```json
{
  "permissions": ["media-control"],
  "capabilities": ["media-controls"]
}
```

See [Unified Player](./UnifiedPlayer.md#plugin-media-controls-api) for API methods, unsupported-action behavior, and platform limitations.

## Web sessions

The Web Session API adds **no permission**. It is controlled by the `web-session` and `web-session-media` capabilities plus the `webSessionOrigins` allowlist, because there is no existing permission that semantically covers an isolated browser session, and a broad `network` permission would grant far more than needed. Existing manifests without these capabilities keep their current behavior. Every `context.webSession` call re-checks the capability and origins; the plugin never receives cookies, headers or tokens. See [Capabilities & Plugin HTTP Environment](../plugin-sdk/13-Capabilities.md#web-session).

# Protected APIs

Some WebRadio services may require permissions.

Example mapping:

| Service       | Required Permission |
| ------------- | ------------------- |
| Storage       | storage             |
| Notifications | notifications       |
| Commands      | commands            |
| Menus         | menus               |
| Windows       | windows             |
| Network       | network             |
| Theme         | theme               |

Attempting to access a protected service without permission may result in an exception.

---

# Permission Flow

```text
Plugin Starts

↓

Read Manifest

↓

Validate Permissions

↓

Grant Allowed Permissions

↓

Initialize Plugin

↓

Protected APIs Available
```

Permissions are evaluated before the plugin becomes active.

---

# Security

Permissions help protect:

* User privacy
* User data
* Application stability
* Sensitive APIs
* Future extension points

Plugins should never attempt to bypass the permission system.

---

# Error Handling

If a plugin accesses a protected API without permission:

* Access is denied.
* The operation fails.
* The error is logged.
* The plugin continues running when possible.

Permission failures should be handled gracefully.

---

# Best Practices

✔ Request the minimum number of permissions.

✔ Explain why permissions are needed.

✔ Check permissions before performing protected operations.

✔ Handle denied permissions gracefully.

✔ Remove unused permissions from the manifest.

---

# Common Mistakes

Typical mistakes include:

* Requesting every available permission.
* Ignoring denied permissions.
* Assuming permissions are always granted.
* Accessing protected APIs directly.
* Failing silently when permission checks fail.

Plugins should always respect the permission model.

---

# Related APIs

The Permissions service commonly works together with:

* PluginContext
* Storage
* Commands
* Windows
* Notifications
* Application

Permissions define access to public SDK services.

---

# Example

```javascript
if (

    context.permissions.has(

        "notifications"

    )

) {

    context.notifications.info(

        "Plugin started."

    );

}
```

---

# See Also

* PluginContext
* Storage
* Commands
* Windows
* Notifications
* Application
