# Updater

The `Updater` subsystem is responsible for checking whether newer versions of WebRadio are available.

Its purpose is to inform users about updates while remaining independent from the application's core functionality.

---

# Responsibilities

The Updater subsystem is organized as a small core layer with supporting modules:

* **UpdateManager** – central orchestration, state and channel handling.
* **UpdateChannel** – stable/beta/alpha channel logic.
* **UpdateState** – current update state.
* **ProviderFactory** – selects the correct update provider for the detected runtime.
* **RuntimeDetector** – detects platform, architecture and packaging type.
* Platform-specific providers – Windows, Linux AppImage, unsupported.

The Updater is responsible for:

* Detecting the current runtime environment
* Selecting the appropriate update provider
* Checking for updates
* Comparing versions
* Notifying the user
* Handling release channels
* Managing update state

The Updater should never interfere with normal application operation.

---

# Lifecycle

```text
Application.start()

↓

Updater initialized

↓

User requests update check
or
Automatic check

↓

Version comparison

↓

Notify user
```

---

# Runtime Detection

Before checking for updates, the Updater determines the current runtime environment.

This includes:

* Operating system (Windows, Linux, macOS)
* Architecture (x64, arm64, arm, ia32)
* Packaging type (appimage, deb, arch, windows-installer, windows-portable, development)

This information is used to select the correct update provider.

---

# Provider Architecture

The Updater uses a provider-based architecture:

```text
UpdateManager

↓

RuntimeDetector

↓

ProviderFactory

↓

Selected Provider
```

Supported providers:

* **WindowsUpdateProvider** – wraps electron-updater for Windows builds.
* **LinuxAppImageUpdateProvider** – prepared for AppImageUpdate, currently GitHub fallback.
* **UnsupportedUpdateProvider** – used for deb, arch and other package types without automatic updates.

> macOS automatic updates are not implemented in 1.0.7-alpha.1.

---

# Update Process

A typical update workflow consists of:

1. Detect runtime environment.
2. Select update provider.
3. Request version information.
4. Compare installed version.
5. Determine update availability.
6. Notify the user.
7. Start update process when supported.

---

# Update Channels (1.0.7-alpha.1)

WebRadio supports three update channels:

* **alpha**
* **beta**
* **latest** (stable)

Channel and severity are different concepts.

* Channel controls which release stream is used (alpha / beta / latest).
* Severity describes the importance of a specific update (for example normal / important / critical).

The current channel is determined centrally, not per provider.

---

# Design Principles

## Independent

The application must remain fully functional even if update checks fail.

---

## Non-Blocking

Update checks should never delay application startup.

---

## Extensible

Future versions may support:

* Automatic downloads
* Background updates
* Release channels
* Rollback support
* Delta updates

---

# Best Practices

✔ Perform update checks asynchronously.

✔ Handle network failures gracefully.

✔ Never block the user interface.

✔ Notify users only when necessary.

✔ Keep provider selection separate from channel logic.

---

# Related Documentation

* Application
* Tray
* Diagnostics
* Runtime Detection
* Provider Architecture
* Update Architecture
