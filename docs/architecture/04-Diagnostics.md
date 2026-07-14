# Diagnostics

The Diagnostics subsystem is responsible for monitoring the health, stability and reliability of WebRadio.

It provides centralized logging, crash handling and diagnostic reporting capabilities.

The goal of the Diagnostics subsystem is to help developers identify, investigate and resolve issues as quickly as possible.

---

# Responsibilities

The Diagnostics subsystem is responsible for:

* Application logging
* Crash detection
* Crash reporting
* Health monitoring
* Diagnostic reports
* Error tracking
* Startup diagnostics

Diagnostics should provide visibility into the internal state of the application without affecting normal operation.

---

# Components

The Diagnostics subsystem consists of multiple specialized components.

```text
Diagnostics

├── LogManager
├── CrashHandler
├── CrashReportManager
└── HealthCheck
```

Each component focuses on a specific responsibility.

---

# LogManager

The LogManager is responsible for recording application events.

Typical examples include:

* Application startup
* Application shutdown
* Plugin loading
* Theme loading
* IPC registration
* Errors and warnings

Logs provide valuable information when investigating problems.

---

# CrashHandler

The CrashHandler is responsible for detecting unexpected application failures.

Examples include:

* Unhandled exceptions
* Unhandled promise rejections
* Renderer crashes
* Fatal runtime errors

The CrashHandler attempts to capture useful information before the application terminates.

---

# CrashReportManager

The CrashReportManager is responsible for collecting and storing crash information.

Typical report contents:

* Timestamp
* Error message
* Stack trace
* Application version
* Operating system information

Crash reports are stored separately from normal logs.

---

# HealthCheck

The HealthCheck component verifies that important application systems are operating correctly.

Examples:

* Storage availability
* Plugin system status
* Theme system status
* IPC availability

Health checks can help identify configuration problems before they cause failures.

---

# Startup Lifecycle

Diagnostics is initialized early during application startup.

```text
Application.start()

↓

StorageManager

↓

Diagnostics

↓

WindowManager

↓

Remaining Systems
```

Initializing diagnostics early ensures that startup problems can be recorded.

---

# Why a Dedicated Diagnostics System?

Many applications simply write messages directly to the console.

While this may be sufficient during early development, it becomes difficult to manage as the project grows.

A dedicated Diagnostics subsystem provides:

* Centralized logging
* Consistent error handling
* Structured crash reporting
* Improved troubleshooting
* Better maintainability

---

# Design Principles

## Centralization

All logging and diagnostic information should flow through the Diagnostics subsystem.

---

## Reliability

Diagnostics should continue operating even when other systems encounter problems.

---

## Low Impact

Diagnostic operations should have minimal impact on application performance.

---

## Extensibility

New diagnostic providers can be added without changing existing components.

---

# Best Practices

✔ Use LogManager instead of direct console output.

✔ Log important lifecycle events.

✔ Capture unhandled errors whenever possible.

✔ Generate structured crash reports.

✔ Keep diagnostic information useful but concise.

---

# Future Improvements

Potential future enhancements include:

* Remote crash reporting
* Performance metrics
* Startup timing analysis
* Plugin diagnostics
* Theme diagnostics
* Telemetry integration

---

# Related Documentation

* Architecture
* Application
* StorageManager
* PluginManager
* ThemeManager
* IPC
