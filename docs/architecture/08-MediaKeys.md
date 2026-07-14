# MediaKeys

The `MediaKeys` subsystem provides global multimedia key support for WebRadio.

It allows users to control playback using dedicated hardware keys on keyboards, headsets or multimedia devices, even when the application is not focused.

The subsystem acts as a bridge between the operating system and the WebRadio playback engine.

---

# Responsibilities

The MediaKeys subsystem is responsible for:

* Registering global media shortcuts
* Receiving multimedia key events
* Forwarding playback commands
* Releasing shortcuts during shutdown

MediaKeys should never contain playback logic.

Instead, received events are forwarded to the appropriate application component.

---

# Supported Actions

Typical supported actions include:

* Play
* Pause
* Play / Pause
* Stop
* Next Station
* Previous Station
* Volume Up
* Volume Down
* Mute

Available actions may depend on the operating system.

---

# Lifecycle

```text
Application.start()

↓

registerMediaKeys()

↓

Listening

↓

User presses media key

↓

Forward event

↓

Application.shutdown()

↓

unregisterMediaKeys()
```

---

# Design Principles

## Global Access

Media keys remain available while the application is running.

---

## Lightweight

The subsystem only forwards events.

---

## Clean Shutdown

Every registered shortcut must be released before the application exits.

---

# Best Practices

✔ Register media keys only once.

✔ Always unregister shortcuts during shutdown.

✔ Keep event handlers lightweight.

✔ Delegate playback actions to the appropriate manager.

---

# Related Documentation

* Application
* WindowManager
* IPC
