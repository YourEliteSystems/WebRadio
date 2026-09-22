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

# Current Diagnostics Components (1.0.7-alpha.1)

The Diagnostics subsystem provides:

* centralized logging through `LogManager`
* crash handling through `CrashHandler`
* structured crash reporting through `CrashReportManager`
* bootup diagnostics through `BootupDiagnostics`
* crash dump writing with sensitive-data sanitization through `CrashDumpWriter`
* a diagnostics store and manager interface through `DiagnosticsStore` / `DiagnosticsManager`
* optional memory profiling through `MemoryProfiler`

Some profiler components, such as CPU and process profiling, are prepared but disabled in this release.

---

# Bootup Diagnostics

Bootup diagnostics measure and expose startup behavior.

This includes:

* startup timing
* boot state exposure
* bootup hook markers for initialization stages

Bootup diagnostics are implemented and used by the current application. They are not only a future UI feature.

---

# Crash Dump Sanitization

Crash dumps are written with security cleanup of sensitive data where applicable.

This is intentional and implemented, not aspirational.

---

# Future Improvements

Potential future enhancements include:

* remote crash reporting UI
* startup timing analysis in a splash/settings UI
* plugin diagnostics
* theme diagnostics
* additional profiling surfaces

These are future or planned uses. They are not fully implemented in 1.0.7-alpha.1.

---

# Related Documentation

* Architecture
* Application
* StorageManager
* PluginManager
* ThemeManager
* IPC
* Update Architecture
