const ffmpeg = require("fluent-ffmpeg");
const { randomUUID } = require("crypto");

const eventBus = require("../eventBus");
const { getFFmpegPath } = require("../ffmpeg-resolver");
const { parseTitle } = require("./metadataParser");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("StreamManager");

class StreamManager {
  constructor() {
    this.ffmpegCommand = null;
    this.ffmpegStream = null;
    this.mainWindow = null;
    this.lastTitle = null;
    this.ffmpegPid = null;
    this._killTimer = null;

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
    ffmpeg.setFfmpegPath(getFFmpegPath());

    this.stop();

    this.lastTitle = null;
    this.ffmpegPid = null;
    this._killTimer = null;
    this.currentStation = station;
    this.diag.chunksReceived = 0;
    this.diag.chunksSent = 0;
    this.diag.streamStartAt = Date.now();
    this.diag.lastDataAt = null;
    this.diag.ffmpegStarts++;

    this.ffmpegCommand = ffmpeg(url)
      .inputOptions(
        "-icy", "1",
        "-headers", "User-Agent: Mozilla/5.0",
        "-loglevel", "debug"
      )
      .audioChannels(2)
      .audioFrequency(48000)
      .format("f32le")
      .on("stderr", (line) => {
        this.handleMetadata(line);
      })
      .on("error", (err) => {
        if (
          err.message.includes("SIGKILL") ||
          err.message.includes("SIGTERM")
        ) {
          return;
        }

        logger.error(`FFmpeg Fehler: ${err.message}`);
      })
      .on("end", () => {
        logger.info("FFmpeg Stream beendet");
      });

    this.ffmpegStream = this.ffmpegCommand.pipe();

    this.ffmpegStream.on("data", (chunk) => {
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

    eventBus.emit("play", { url, station });
  }

  stop() {
    // Jeder Stop löscht oder überschreibt die Zeitpläne des vorherigen Laufs.
    // Sonst würde eine vorige 5s-SIGTERM-Sicherung noch in der Framezeit
    // laufen und einen nachfolgend neugestarteten Stream mit SIGKILL töten.
    if (this._killTimer != null) {
      clearTimeout(this._killTimer);
      this._killTimer = null;
    }

    const command = this.ffmpegCommand;
    let killed = false;
    let killTimer = null;

    if (command) {
      const terminate = (signal) => {
        if (killed) {
          return;
        }
        killed = true;

        // Linux/macOS: kill(pid, 0) prüft, ob der PID noch lebt, ohne ein Signal
        // zu versenden. Ein ESRCH-Fehler heißt: Prozess nicht gefunden/bereit.
        // Ein EPERM-Fehler heißt: Prozess ist vorhanden, aber nicht berechtigt.
        if (this.ffmpegPid != null && typeof process.kill === "function") {
          let alive = true;
          try {
            process.kill(this.ffmpegPid, 0);
          } catch (err) {
            alive = err.code !== "ESRCH";
          }

          if (!alive) {
            logger.info(`FFmpeg-Prozess (PID ${this.ffmpegPid}) ist bereits beendet`);
            this.ffmpegPid = null;
            return;
          }
        }

        try {
          command.kill(signal);
        } catch (err) {
          logger.warn(`Signal ${signal} an FFmpeg-Signal nicht gesendet: ${err.message}`);
        }
      };

      terminate('SIGTERM');

      killTimer = setTimeout(() => {
        if (!killed) {
          const stillRunning = this.ffmpegPid != null
            ? (() => {
                try {
                  process.kill(this.ffmpegPid, 0);
                  return true;
                } catch (err) {
                  return err.code !== "ESRCH";
                }
              })()
            : true;

          if (stillRunning) {
            logger.warn("FFmpeg hat nicht auf SIGTERM reagiert, SIGKILL wird ausgeführt");
            try {
              command.kill('SIGKILL');
            } catch (killErr) {
              logger.warn(`SIGKILL fehlgeschlagen: ${killErr.message}`);
            }
          }
        }
        this._killTimer = null;
      }, 5000); // 5 Sekunden Timeout

      this._killTimer = killTimer;

      const clearKillTimer = () => {
        if (this._killTimer === killTimer) {
          clearTimeout(killTimer);
        }
      };

      // Timeout aufräumen, wenn FFmpeg sauber beendet wird.
      command.once('end', clearKillTimer);
    }

    // Kommando und Stream-Handle einmalig und sicher aufräumen.
    this.ffmpegCommand = null;
    this.ffmpegPid = null;
    if (this.ffmpegStream) {
      try {
        this.ffmpegStream.removeAllListeners();
        this.ffmpegStream.destroy();
      } catch (err) {
        logger.warn(`Stream Destroy Fehler: ${err.message}`);
      }

      this.ffmpegStream = null;
    }

    this.diag.lastDataAt = null;

    eventBus.emit("stop");
  }

  // Gezielte Diagnose-Abfrage (kein dauerhaftes Polling/Logging im PCM-Pfad).
  // Kann über IPC radio:getAudioDiagnostics abgerufen werden.
  getDiagnostics() {
    return {
      ffmpegRunning: Boolean(this.ffmpegCommand),
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
    // wurde, falls der Regex es nicht komplett verarbeitet hat.
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
// Singleton-Instanz (wird von radioHandlers/Application genutzt) –
// plus named Export der Klasse für Tests und Dependency Injection.
const streamManagerInstance = new StreamManager();
streamManagerInstance._sessionId = randomUUID();
module.exports = streamManagerInstance;
module.exports.StreamManager = StreamManager;
