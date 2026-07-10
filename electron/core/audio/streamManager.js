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
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async start(url) {
    ffmpeg.setFfmpegPath(getFFmpegPath());

    this.stop();

    this.lastTitle = null;

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
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        return;
      }

      const pcm = new Float32Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength / 4
      );

      this.mainWindow.webContents.send(
        "radio:pcm",
        pcm.buffer
      );
    });

    eventBus.emit("play", { url });
  }

  stop() {
    if (this.ffmpegCommand) {
      try {
        // WICHTIG: Erst killen, damit der Error-Handler das SIGTERM
        // Event abfangen kann. Danach Listener entfernen.
        this.ffmpegCommand.kill("SIGTERM");
        this.ffmpegCommand.removeAllListeners();
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

    eventBus.emit("stop");
  }

  handleMetadata(line) {
    if (!line.includes("StreamTitle")) {
      return;
    }

    const match = line.match(
      /StreamTitle[:=]\s*['"]?(.*?)['"]?$/
    );

    if (!match) {
      return;
    }

    const rawTitle = match[1].trim();

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

module.exports = new StreamManager();