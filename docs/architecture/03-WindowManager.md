# WindowManager

The `WindowManager` is responsible for creating, managing and controlling all application windows within WebRadio.

Instead of allowing different parts of the application to create Electron windows independently, every window is managed through a single central component.

This ensures a consistent user experience and keeps all window-related logic in one place.

---

# Responsibilities

The WindowManager is responsible for:

* Creating the main application window
* Managing secondary windows
* Opening the settings window
* Tracking window instances
* Restoring previous window state
* Handling window events
* Managing window lifecycle

The WindowManager does **not** contain application logic.

Its responsibility is limited to window management.

---

# Lifecycle

The WindowManager is initialized by the Application during startup.

```text
Application.start()

↓

WindowManager.initialize()

↓

Create Main Window

↓

Application UI Ready
```

Additional windows are created only when requested.

---

# Why a Central WindowManager?

Electron allows windows to be created from anywhere.

While this works for small applications, it quickly becomes difficult to maintain as projects grow.

By introducing a dedicated WindowManager:

* all windows are managed consistently,
* duplicate code is avoided,
* debugging becomes easier,
* future windows can be added without changing unrelated code.

---

# Managed Windows

A typical WebRadio installation may include:

```text
Main Window

↓

Settings Window

↓

Future Windows
    ├── About
    ├── Plugin Manager
    ├── Theme Manager
    ├── Diagnostics
    └── Developer Tools
```

The WindowManager is responsible for tracking every active window.

---

# Window State

The WindowManager may restore window properties between sessions, including:

* Window size
* Window position
* Maximized state
* Fullscreen state

This provides a consistent user experience across application restarts.

---

# Design Principles

## Single Responsibility

The WindowManager manages windows only.

Business logic belongs elsewhere.

---

## Centralization

All Electron BrowserWindows should be created through the WindowManager.

---

## Extensibility

Adding a new window should require only minimal changes.

The WindowManager should remain the single entry point for creating windows.

---

## Predictability

Every window follows the same creation process and lifecycle.

---

# Best Practices

✔ Never create BrowserWindows outside the WindowManager.

✔ Keep window configuration centralized.

✔ Reuse helper methods whenever possible.

✔ Track every window instance.

✔ Clean up event listeners when windows are closed.

---

# Related Documentation

* Architecture
* Application
* IPC
* ThemeManager
* PluginManager
* Diagnostics
