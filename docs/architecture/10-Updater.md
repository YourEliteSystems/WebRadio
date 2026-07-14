# Updater

The `Updater` subsystem is responsible for checking whether newer versions of WebRadio are available.

Its purpose is to inform users about updates while remaining independent from the application's core functionality.

---

# Responsibilities

The Updater is responsible for:

* Checking for updates
* Comparing versions
* Notifying the user
* Preparing future update workflows

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

# Update Process

A typical update workflow consists of:

1. Request version information.
2. Compare installed version.
3. Determine update availability.
4. Notify the user.
5. Start update process (future).

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

---

# Related Documentation

* Application
* Tray
* Diagnostics
