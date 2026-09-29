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

# Current Diagnostics Components (1.0.7-alpha.5)

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

# Renderer And Plugin HTTP Diagnostics

Two diagnostic surfaces exist for plugin loading problems.

## Optional renderer diagnostics

Setting the environment variable `WEBRADIO_RENDERER_DIAGNOSTICS=1` before starting the application enables additional main-process logging for the main window:

* `did-finish-load` and `did-fail-load`
* `preload-error`
* `render-process-gone`
* `console-message`, including content security policy violations

The output goes to the regular WebRadio log. Without the variable this code path is completely inactive, so it never adds noise to a normal start.

## Plugin HTTP request log

Every request against the plugin HTTP environment is logged with a distinct category, so a failing plugin script can be attributed to a concrete stage:

| Category | Meaning |
| --- | --- |
| `[served]` | File was found and returned |
| `[route-unregistered]` | No plugin HTTP route is registered for this path |
| `[unknown-plugin]` | Plugin is not registered for HTTP serving |
| `[file-missing]` | Requested file does not exist inside the plugin root, or is not a regular file (`404`) |
| `[file-unreadable]` | Path resolves outside the plugin root — traversal attempt (`403`), or the file exists but cannot be read (`500`, stack trace in log) |
| `[http-error]` | Request method is not supported (`405`, only `GET` and `HEAD`) |
| `[cors-rejected]` | Origin is not allowed for the requested resource |
| `[preflight]` | Answered `OPTIONS` request |

Each entry includes method, path, resolved absolute path, status, MIME type, size, origin and the emitted `Access-Control-Allow-Origin` value.

## Typical failure pattern

A renderer script that is reported as `Failed to load renderer script` while the plugin HTTP log shows **no** corresponding request indicates a content security policy rejection, not a server error: the script was discarded before the request. If a request is present, its category identifies the actual stage.

---

# Future Improvements

Potential future enhancements include:

* remote crash reporting UI
* startup timing analysis in a splash/settings UI
* plugin diagnostics
* theme diagnostics
* additional profiling surfaces

These are future or planned uses. They are not fully implemented in 1.0.7-alpha.5.

---

# Related Documentation

* Architecture
* Application
* StorageManager
* PluginManager
* ThemeManager
* IPC
* Update Architecture
