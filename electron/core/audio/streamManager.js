const ffmpeg = require("fluent-ffmpeg");

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
    if (this.ffmpegCommand) {
      try {
        // Reihenfolge ist entscheidend:
        // 1. Alle eigenen Listener entfernen
        // 2. No-op Error-Handler einhängen – verhindert uncaughtException,
        //    weil fluent-ffmpeg's endCB async nach dem Kill noch
        //    self.emit('error') aufruft (Zeile 543 in processor.js)
        // 3. Erst dann killen
        this.ffmpegCommand.removeAllListeners();
        this.ffmpegCommand.on('error', () => {});
        this.ffmpegCommand.kill('SIGTERM');
      } catch (err) {
        logger.warn(`Fehler beim Beenden von FFmpeg: ${err.message}`);
      }

      this.ffmpegCommand = null;
    }

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
const streamManagerInstance = new StreamManager();
module.exports = streamManagerInstance;
module.exports.StreamManager = StreamManager;
