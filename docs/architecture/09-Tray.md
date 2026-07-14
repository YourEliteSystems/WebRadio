# Tray

The `Tray` subsystem manages WebRadio's integration with the operating system's notification area.

It allows users to access common application functions without opening the main window.

The tray icon provides quick access to playback controls, settings and application management.

---

# Responsibilities

The Tray subsystem is responsible for:

* Creating the system tray icon
* Managing the tray context menu
* Handling tray events
* Showing or hiding the main window
* Providing quick actions

The Tray subsystem does not implement application logic itself.

---

# Typical Context Menu

```text
WebRadio

──────────────

▶ Show Window

⚙ Settings

🔄 Check for Updates

❌ Exit
```

Additional entries may be added in future releases.

---

# Lifecycle

```text
Application.start()

↓

createTray()

↓

Tray Ready

↓

Application.shutdown()

↓

destroyTray()
```

---

# Design Principles

## Centralization

Only one tray instance should exist.

---

## Consistency

Tray actions should behave exactly like their window counterparts.

---

## Minimalism

The tray should expose only frequently used actions.

---

# Best Practices

✔ Create the tray only once.

✔ Destroy the tray during shutdown.

✔ Keep the menu simple.

✔ Delegate actions to managers.

---

# Related Documentation

* Application
* WindowManager
* Updater
