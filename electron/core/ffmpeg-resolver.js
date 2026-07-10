const fs = require("fs");
const path = require("path");
const ffmpegStatic = require("ffmpeg-static");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("FFmpegResolver");

function getFFmpegPath() {
  let ffmpegPath = ffmpegStatic;
  
  logger.debug(`FFmpeg Path: ${ffmpegPath}`);
  logger.debug(`Existiert: ${fs.existsSync(ffmpegPath)}`);

  // Wenn gepackt → app.asar Fix
  if (ffmpegPath.includes("app.asar")) {
    ffmpegPath = ffmpegPath.replace(
      "app.asar",
      "app.asar.unpacked"
    );
  }

  return ffmpegPath;
}

module.exports = { getFFmpegPath };