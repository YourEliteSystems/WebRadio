# StreamManager

The `StreamManager` manages FFmpeg-based audio stream playback.

It is responsible for starting, stopping, restarting and monitoring streams without exposing FFmpeg internals to the rest of the application.

---

# Responsibilities

The StreamManager is responsible for:

* Starting an audio stream from a stream URL
* Stopping playback
* Restarting streams after failures or station changes
* Tracking stream diagnostics
* Cleaning up FFmpeg processes and IPC listeners
* Reporting stream state to the application

The StreamManager does not implement UI or station discovery.

---

# Architecture

The StreamManager works closely with:

- `RadioBrowserService` – provides stream URLs and station metadata
- `IPC / radioHandlers.js` – exposes playback control to the renderer
- `Diagnostics` – reports stream failures and runtime counters

---

# Stream Lifecycle

A typical stream lifecycle looks like this:

```text
Select station
    ↓
Resolve stream URL
    ↓
Start FFmpeg
    ↓
Receive PCM data
    ↓
Send PCM to renderer
    ↓
Stop / restart / station change
    ↓
Clean up FFmpeg and listeners
```

---

# Public Behavior

## start
Starts playback for a given stream URL.

If a stream is already running, the StreamManager stops the current stream before starting the new one.

## stop
Stops playback and cleans up the current FFmpeg process.

Multiple stop calls should be handled safely.

## restart
Restarts the current stream without changing the station.

This is used after transient failures or when the renderer requests a replay.

## switchStation
Stops the current stream and starts a new station.

This is the preferred path for station changes.

## getDiagnostics
Returns runtime diagnostics for the current stream.

Typical diagnostics include:

* stream running state
* FFmpeg start attempts
* chunks received
* last data timestamp
* error context

---

# Diagnostics

The StreamManager tracks lightweight diagnostics to help detect:

* streams that start but never deliver data
* FFmpeg start failures
* premature stream termination
* station switches without cleanup

These diagnostics are intended for logging and user feedback, not for exposing internal FFmpeg details to the renderer.

---

# Error Handling

If a stream cannot be started:

* The error is logged
* The stream state is updated
* The renderer is informed that playback failed

If a stream fails during playback:

* the StreamManager stops the FFmpeg process cleanly
* playback state is updated
* a restart is only attempted when appropriate

---

# Best Practices

✔ Start only one stream at a time.

✔ Always clean up FFmpeg processes and listeners.

✔ Treat station changes as stop + start.

✔ Do not expose raw FFmpeg output directly to the UI.

✔ Track diagnostics lightly and consistently.

✔ Keep stream failures from crashing the application.

---

# Related Documentation

* Application
* RadioBrowserService
* IPC
* Diagnostics
* Radio Playback
