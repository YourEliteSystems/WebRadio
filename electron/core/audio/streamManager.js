const ffmpeg = require("fluent-ffmpeg");
const { randomUUID } = require("crypto");

const eventBus = require("../eventBus");
const { getFFmpegPath } = require("../ffmpeg-resolver");
const { parseTitle } = require("./metadataParser");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("StreamManager");

// SIGTERM → Timeout → SIGKILL. Der Eskalationszeitraum bleibt unverändert.
const KILL_TIMEOUT_MS = 5000;

// Jedes URI-Schema mit "://" (http, https, icy, rtmp, …) ist erlaubt.
// Leer, undefined oder Garbage werden abgelehnt – es wird bewusst KEINE
// künstliche Default-URL erfunden.
const URI_REGEX = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

function isKillMessage(message) {
  return typeof message === "string" &&
    (message.includes("SIGKILL") || message.includes("SIGTERM"));
}

/**
 * Ermittelt die PID eines FFmpeg-Prozesses.
 * fluent-ffmpeg hält "ffmpegProc" ab dem Spawn bis zum Ende – danach wird
 * das Feld gelöscht. Danach existiert kein Prozess (mehr), den man töten
 * müsste.
 */
function resolvePid(command) {
  const proc = command && command.ffmpegProc;
  return proc && typeof proc.pid === "number" ? proc.pid : null;
}

/**
 * Probe-Liveness ohne Signalversand.
 * ESRCH = Prozess nicht (mehr) vorhanden. EPERM = Prozess vorhanden,
 * gehört uns nur nicht – also lebendig.
 */
function isProcessAlive(pid) {
  if (pid == null) return false;
  if (typeof process.kill !== "function") return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== "ESRCH";
  }
}

class StreamManager {
  constructor() {
    this.ffmpegCommand = null;
    this.ffmpegStream = null;
    this.mainWindow = null;
    this.lastTitle = null;
    this.ffmpegPid = null;

    // Lauf-Token: Wird bei jedem Start und jedem Stop inkrementiert. Events
    // eines veralteten Laufs (data/stderr/end/error) prüfen dagegen und
    // bleiben stumm – veraltete Prozesse können den aktuellen Lauf nicht
    // mehr stören.
    this._runId = 0;

    // Referenz auf den zuletzt armierten Eskalationstimer. Ein noch
    // laufender Timer eines Vorgängerlaufs bleibt aktiv (er ist über seinen
    // Closure-Parameter an dessen Kommando gebunden) und wird deshalb hier
    // nicht abgebrochen – er kann den neuen Stream ohnehin nicht treffen.
    this._killTimer = null;

    // Eskalationszeitraum SIGTERM → SIGKILL. Instanzfeld, damit Tests den
    // realen Ablauf ohne 5s-Wartezeit abbilden können; der Produktivwert
    // bleibt unverändert.
    this.killTimeoutMs = KILL_TIMEOUT_MS;

    // Pro-Kommando-Zustand (WeakMap, damit beendete Kommandos nicht
    // referenziert werden): stopRequested, finished, killTimer.
    this._commandState = new WeakMap();

    this._sessionId = randomUUID();

    // Leichtgewichtige Diagnose-Zähler – kein Logging und kein Polling im
    // PCM-Pfad, Abruf nur bei Bedarf über getDiagnostics().
    this.diag = {
      chunksReceived: 0,
      chunksSent: 0,
      ffmpegStarts: 0,
      streamStartAt: null,
      lastDataAt: null
    };
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async start(url, station = null) {
    const cleanUrl = typeof url === "string" ? url.trim() : "";

    if (!URI_REGEX.test(cleanUrl)) {
      // Kein FFmpeg-Start ohne belastbare Quelle – aber mit vollständiger
      // Diagnose, damit der Auslöser im Log nachvollziehbar bleibt.
      logger.warn(
        `StreamManager.start() ohne gültige Stream-URL abgebrochen. ${this._buildDiagnostics("start")}`
      );
      return {
        success: false,
        error: { code: "MISSING_URL", message: "start() ohne gültige Stream-URL aufgerufen" }
      };
    }

    ffmpeg.setFfmpegPath(getFFmpegPath());

    // Vorherigen Lauf beenden, bevor der Zustand des neuen geschrieben wird.
    this.stop();

    this.lastTitle = null;
    this.ffmpegPid = null;
    this.currentStation = station;
    this.diag.chunksReceived = 0;
    this.diag.chunksSent = 0;
    this.diag.streamStartAt = Date.now();
    this.diag.lastDataAt = null;
    this.diag.ffmpegStarts++;

    const runId = ++this._runId;
    const state = { stopRequested: false, finished: false, killTimer: null };

    // Läuft der Prozess beendet, wird der Eskalationstimer sofort
    // aufgelöst. Wichtig: fluent-ffmpeg emittiert bei einem gekillten
    // Prozess "error" (nicht "end") – deshalb werden BEIDE Ereignisse
    // beobachtet. Nur "end" zu hören war der Grund, warum der Timer nie
    // abgebrochen wurde.
    const finalize = () => {
      state.finished = true;

      // Nur der laufende Prozess darf die PID freigeben: Ist die PID
      // beendet, darf sie nicht mehr für Liveness-Checks verwendet werden,
      // weil eine PID-Wiederverwendung sonst einen fremden Prozess als
      // „lebendig“ ausweisen und mit SIGTERM/SIGKILL treffen würde.
      if (this.ffmpegCommand === command && this.ffmpegPid != null) {
        this.ffmpegPid = null;
      }

      if (state.killTimer != null) {
        clearTimeout(state.killTimer);
        if (this._killTimer === state.killTimer) {
          this._killTimer = null;
        }
        state.killTimer = null;
      }
    };

    const command = ffmpeg(cleanUrl)
      .inputOptions(
        "-icy", "1",
        "-headers", "User-Agent: Mozilla/5.0",
        "-loglevel", "debug"
      )
      .audioChannels(2)
      .audioFrequency(48000)
      .format("f32le")
      .on("start", () => {
        // Prüfung VOR dem runId-Guard: Wurde gestoppt, bevor der Spawn
        // stattfand, gehört dieser Prozess bereits zum abgebrochenen Lauf
        // und muss trotzdem beendet werden.
        if (state.stopRequested && !state.finished) {
          this._sendSignal(command, "SIGTERM");
          this._armEscalation(command, state);
          return;
        }

        if (runId !== this._runId) return;

        this.ffmpegPid = resolvePid(command);
      })
      .on("stderr", (line) => {
        if (runId !== this._runId) return;
        this.handleMetadata(line);
      })
      .on("error", (err) => {
        const message = (err && err.message) || String(err);
        if (isKillMessage(message)) return;
        if (runId !== this._runId) return;
        logger.error(`FFmpeg Fehler: ${message}`);
      })
      .on("end", () => {
        finalize();
        if (runId !== this._runId) return;
        logger.info("FFmpeg Stream beendet");
      })
      .on("error", finalize);

    this._commandState.set(command, state);

    this.ffmpegCommand = command;

    try {
      this.ffmpegStream = command.pipe();
    } catch (err) {
      this.ffmpegCommand = null;
      finalize();
      logger.error(`FFmpeg-Stream konnte nicht gestartet werden: ${err.message}`);
      return { success: false, error: { code: "START_FAILED", message: err.message } };
    }

    const stream = this.ffmpegStream;

    stream.on("data", (chunk) => {
      // Veralteter Lauf: Der Stream wurde bereits ersetzt oder gestoppt.
      if (runId !== this._runId || this.ffmpegStream !== stream) {
        return;
      }

      // Kein künstlicher Puffer und KEIN Verwerfen von PCM im Main-Prozess:
      // Der AudioWorklet (Renderer) absorbiert IPC-/UI-Jitter. Verworfenes
      // PCM wäre echter Datenverlust → hörbare Aussetzer.
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return;
      }

      this.diag.chunksReceived++;
      this.diag.lastDataAt = Date.now();

      if (chunk.byteLength % 4 !== 0) {
        logger.warn(`PCM-Chunk übersprungen (ungerade Byte-Länge): ${chunk.byteLength}`);
        return;
      }

      try {
        const pcm = new Float32Array(
          chunk.buffer,
          chunk.byteOffset,
          chunk.byteLength / 4
        );
        this.mainWindow.webContents.send("radio:pcm", pcm.buffer);
        this.diag.chunksSent++;
      } catch (err) {
        logger.warn(`PCM Send-Fehler: ${err.message}`);
      }
    });

    eventBus.emit("play", { url: cleanUrl, station });

    return { success: true };
  }

  stop() {
    const command = this.ffmpegCommand;
    const stream = this.ffmpegStream;
    const pid = this.ffmpegPid;

    // Instanzzustand sofort und endgültig lösen: Ab hier gehören alle
    // eingehenden Events (data/stderr/end/error) nicht mehr zu diesem Lauf.
    this.ffmpegCommand = null;
    this.ffmpegStream = null;
    this.ffmpegPid = null;
    this._runId += 1;

    // Referenz zurücksetzen. Ein laufender Eskalationstimer eines
    // Vorgängerlaufs bleibt bewusst aktiv – er prüft bei Auslösung seine
    // eigene PID und würde nur den bereits gestoppten Prozess treffen.
    this._killTimer = null;

    const state = command ? this._commandState.get(command) || null : null;

    if (stream) {
      try {
        // Auch die internen Handler von fluent-ffmpeg ("close"/"error" auf
        // dem Zielstream) müssen weg: Sonst würde fluent-ffmpeg nach dem
        // Destroy einen zweiten Kill plus "Output stream closed"-Fehler
        // nachschieben. Ein eigener, stiller Error-Handler bleibt hängen,
        // weil ein Event "error" ohne Listener den Prozess beenden würde.
        stream.removeAllListeners();
        stream.on("error", () => {});
        stream.destroy();
      } catch (err) {
        logger.warn(`Stream Destroy Fehler: ${err.message}`);
      }
    }

    if (command) {
      if (state) {
        state.stopRequested = true;
      }

      if (pid != null && !isProcessAlive(pid)) {
        // Bereits beendet – kein zweiter Signalversand, keine Eskalation.
        logger.info(`FFmpeg-Prozess (PID ${pid}) ist bereits beendet`);
      } else {
        this._sendSignal(command, "SIGTERM");

        // Eskalation nur mit bekannter PID: Ohne PID ist kein Prozess
        // nachweisbar vorhanden, und der "start"-Handler armiert den
        // Timer nach, sobald der Spawn tatsächlich stattfindet.
        if (pid != null) {
          this._armEscalation(command, state);
        }
      }
    }

    this.diag.lastDataAt = null;

    eventBus.emit("stop");
  }

  /** Sendet ein Signal an den Prozess des übergebenen Kommandos. */
  _sendSignal(command, signal) {
    try {
      command.kill(signal);
    } catch (err) {
      logger.warn(`Signal ${signal} an FFmpeg nicht gesendet: ${err.message}`);
    }
  }

  /**
   * Schaltet die SIGTERM→SIGKILL-Eskalation für EIN konkretes Kommando.
   * Timer und PID gehören ausschließlich zu diesem Lauf – ein späterer
   * Neustart kann deshalb niemals getroffen werden.
   */
  _armEscalation(command, state) {
    if (!state || state.finished || state.killTimer != null) {
      return;
    }

    const timer = setTimeout(() => {
      state.killTimer = null;
      if (this._killTimer === timer) {
        this._killTimer = null;
      }

      if (state.finished) return;

      const livePid = resolvePid(command);
      if (livePid == null) {
        // Kein Prozess (mehr) vorhanden – nichts zu eskalieren.
        return;
      }

      if (!isProcessAlive(livePid)) {
        logger.info(`FFmpeg-Prozess (PID ${livePid}) ist bereits beendet`);
        return;
      }

      logger.warn("FFmpeg hat nicht auf SIGTERM reagiert, SIGKILL wird ausgeführt");
      this._sendSignal(command, "SIGKILL");
    }, this.killTimeoutMs);

    state.killTimer = timer;
    this._killTimer = timer;
  }

  // Gezielte Diagnose-Abfrage (kein dauerhaftes Polling/Logging im PCM-Pfad).
  // Kann über IPC radio:getAudioDiagnostics abgerufen werden.
  getDiagnostics() {
    return {
      ffmpegRunning: Boolean(this.ffmpegCommand),
      ffmpegPid: this.ffmpegPid,
      currentStation: this.currentStation,
      chunksReceived: this.diag.chunksReceived,
      chunksSent: this.diag.chunksSent,
      ffmpegStarts: this.diag.ffmpegStarts,
      streamStartAt: this.diag.streamStartAt,
      lastDataAt: this.diag.lastDataAt,
      // Millisekunden seit dem letzten PCM-Chunk (Stream-Read-Stall-Erkennung)
      msSinceLastData: this.diag.lastDataAt ? Date.now() - this.diag.lastDataAt : null
    };
  }

  /**
   * Baut eine nachvollziehbare Diagnose für einen abgelehnten Start.
   * Enthält Lauf-/Prozess-/Session-Daten ohne die URL selbst zu loggen.
   */
  _buildDiagnostics(method) {
    const stationName = this.currentStation?.name || "keine";
    return `Diagnose: ${method}() abgelehnt, runId=${this._runId}, pid=${this.ffmpegPid ?? "kein"}, station=${stationName}, sessionId=${this._sessionId}`;
  }

  handleMetadata(line) {
    if (!line.includes("StreamTitle")) {
      return;
    }

    const match = line.match(
      /StreamTitle[:=]\s*['"]?(.*?)['"]?;?\s*$/
    );

    if (!match) {
      return;
    }

    let rawTitle = match[1].trim();
    // Bereinige ein überflüssiges abschließendes Semikolon,
    // das vom ICY-Format (`StreamTitle='A - B';`) mitgegeben
    // wurde, falls die Regex es nicht komplett verarbeitet hat.
    rawTitle = rawTitle.replace(/['"]+$/g, "").replace(/;+$/g, "").trim();

    if (!rawTitle || rawTitle === this.lastTitle) {
      return;
    }

    this.lastTitle = rawTitle;

    const { artist, song } = parseTitle(rawTitle);

    const metadata = {
      StreamTitle: rawTitle,
      Artist: artist,
      Song: song
    };

    if (
      this.mainWindow &&
      !this.mainWindow.isDestroyed()
    ) {
      this.mainWindow.webContents.send(
        "radio:metadata",
        metadata
      );
    }

    eventBus.emit("metadata", metadata);
  }
}

// Singleton-Instanz (wird von radioHandlers/Application genutzt) –
// plus named Export der Klasse für Tests und Dependency Injection.
const streamManagerInstance = new StreamManager();
module.exports = streamManagerInstance;
module.exports.StreamManager = StreamManager;
