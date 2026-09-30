# StreamManager

The `StreamManager` owns FFmpeg-based audio stream playback in the Electron main process.

It starts and stops the FFmpeg child process, converts its PCM output into IPC frames for the renderer AudioWorklet, and exposes process diagnostics — without leaking FFmpeg internals into the rest of the application.

---

# Responsibilities

The StreamManager is responsible for:

* Validating a stream URL and starting FFmpeg for it
* Stopping playback (idempotently)
* Restarting streams after a station change
* Escalating from `SIGTERM` to `SIGKILL` when a stopped process refuses to exit
* Forwarding PCM chunks to the renderer
* Parsing ICY metadata (`StreamTitle`) from FFmpeg's stderr
* Tracking stream diagnostics

The StreamManager does not implement UI, station discovery, volume control or player state.

---

# Architecture

The StreamManager works closely with:

- `RadioBrowserService` – provides stream URLs and station metadata
- `IPC / radioHandlers.js` – `radio:start`, `radio:stop`, `radio:getAudioDiagnostics`
- `RadioProvider` – the Unified Player adapter that calls `start()` / `stop()`
- `EventBus` – emits `play`, `stop` and `metadata`
- `Diagnostics` – reports stream failures and runtime counters

Audio path:

```text
FFmpeg (stdout, f32le / 48 kHz / stereo)
    ↓
StreamManager (main process)
    ↓  IPC "radio:pcm"
Renderer AudioWorklet
    ↓
GainNode → AudioContext
```

The main process never buffers or discards PCM: the AudioWorklet absorbs IPC and UI jitter, so dropping samples in the main process would cause audible dropouts.

---

# Stream Lifecycle

```text
start(url, station)
    ↓
Validate URL  ──invalid──►  { success:false, code:"MISSING_URL" }  (FFmpeg untouched)
    ↓ valid
stop()  (previous run, if any)
    ↓
Spawn FFmpeg → capture PID on "start"
    ↓
PCM chunks → renderer      stderr → ICY metadata
    ↓
stop()  →  SIGTERM  →  [5 s]  →  SIGKILL (only if the PID is provably alive)
    ↓
clear escalation timer on "end" OR "error"
```

---

# Process Lifecycle (SIGTERM / SIGKILL)

Stopping a stream is the only place where the StreamManager signals a process.

1. **Resolve state first.** `ffmpegCommand`, `ffmpegStream` and `ffmpegPid` are cleared immediately and a run token is incremented, so events that belong to the previous run (`data`, `stderr`, `end`, `error`) are ignored from that moment on.
2. **Send `SIGTERM`.** Skipped when the PID is already gone (`kill(pid, 0)` → `ESRCH`), in which case an informational line is logged instead.
3. **Arm the escalation timer (5 seconds).** The timer is bound by closure to *that* command and *that* PID. A later restart can therefore never be hit by a stale timer.
4. **Escalate only on proof.** When the timer fires, the PID is resolved again and probed with `kill(pid, 0)`. Only if the process is still alive is `SIGKILL` sent together with the warning `FFmpeg hat nicht auf SIGTERM reagiert, SIGKILL wird ausgeführt`. `ESRCH` produces an info line only; `EPERM` counts as alive.
5. **Clear the timer on `end` *and* on `error`.** fluent-ffmpeg emits `error` (not `end`) for a killed process, so listening for `end` alone would leave the timer armed.
6. **Release the PID when the process exits.** A finished PID is no longer referenced, so PID reuse cannot make an unrelated process look alive.

**Why no process groups:** fluent-ffmpeg calls `spawn(command, args, options)` without a shell and without `niceness` (the default is `0`, so the `nice` wrapper branch never applies). Exactly one child process is created and FFmpeg does not fork while streaming. `detached` / `kill(-pid)` would therefore have no effect and was deliberately not introduced.

---

# URL Validation

`start()` refuses to spawn FFmpeg when the URL does not match a URI scheme with `://` (for example `http://`, `https://`, `icy://`, `rtmp://`).

* The check runs **before** the currently running stream is stopped, so a bad request cannot kill working playback.
* No fallback URL is invented.
* The rejection is logged with run ID, PID, station and session ID (the URL itself is not logged) and returned as `{ success:false, error:{ code:"MISSING_URL" } }`.

---

# Public Behavior

## setMainWindow(window)

Stores the renderer window used for `radio:pcm` and `radio:metadata`. Registered once during IPC setup.

## start(url, station = null)

Starts playback for a stream URL. Returns a Promise resolving to:

| Result | Meaning |
| ------ | ------- |
| `{ success: true }` | FFmpeg spawned, PCM flow started, `play` emitted |
| `{ success: false, error: { code: "MISSING_URL" } }` | URL missing or without a URI scheme; nothing was started |
| `{ success: false, error: { code: "START_FAILED" } }` | fluent-ffmpeg could not open the output stream |

If a stream is already running, the current stream is stopped before the new one starts.

## stop()

Stops playback and cleans up the current FFmpeg process.

* **Idempotent:** repeated calls send no additional signal and never touch a new run's process.
* Always emits `stop` on the EventBus.
* Safe to call from `Application.shutdown()` while a stream is running.

## getDiagnostics()

Returns runtime diagnostics for the current stream:

| Field | Meaning |
| ----- | ------- |
| `ffmpegRunning` | whether a command is currently held |
| `ffmpegPid` | PID of the running process, or `null` |
| `currentStation` | station object of the current run |
| `chunksReceived` / `chunksSent` | PCM counters since the last start |
| `ffmpegStarts` | number of start attempts |
| `streamStartAt` / `lastDataAt` | timestamps of the last start and last PCM chunk |
| `msSinceLastData` | milliseconds since the last PCM chunk (read-stall detection) |

Exposed over IPC as `radio:getAudioDiagnostics`, combined with the AudioWorklet counters.

---

# Events

| EventBus event | Payload | Emitted when |
| -------------- | ------- | ------------ |
| `play` | `{ url, station }` | a stream started successfully |
| `stop` | – | `stop()` was called |
| `metadata` | `{ StreamTitle, Artist, Song }` | ICY metadata changed |

Renderer push channels: `radio:pcm` (PCM frames) and `radio:metadata`.

---

# Diagnostics

The StreamManager tracks lightweight diagnostics to help detect:

* streams that start but never deliver data (`msSinceLastData` growing without a new chunk)
* FFmpeg start failures
* premature stream termination
* station switches without cleanup

These diagnostics are intended for logging and user feedback, not for exposing raw FFmpeg output to the renderer.

---

# Error Handling

If a stream cannot be started:

* The reason is logged with run ID, PID, station and session ID
* The running stream is left untouched
* The caller receives a structured `{ success:false, error }` object

If FFmpeg fails during playback:

* Messages containing `SIGTERM` or `SIGKILL` are silenced, because they describe an intentional shutdown
* Every other FFmpeg error is logged
* Events from a superseded run are ignored entirely, so a stale process cannot log into the current session

---

# Best Practices

✔ Start only one stream at a time — `start()` always stops the previous run first.

✔ Never call `stop()` on a command object you obtained elsewhere; let the StreamManager own the lifecycle.

✔ Treat station changes as stop + start.

✔ Do not raise the 5-second escalation window: it is a safety net, not a tuning knob.

✔ Do not expose raw FFmpeg output directly to the UI.

✔ Read diagnostics on demand instead of polling in the PCM path.

✔ Keep stream failures from crashing the application.

---

# Related Documentation

* [Unified Player](./UnifiedPlayer.md)
* [RadioBrowserService](./RadioBrowserService.md)
* [IPC](../architecture/05-IPC.md)
* [Diagnostics](../architecture/04-Diagnostics.md)
