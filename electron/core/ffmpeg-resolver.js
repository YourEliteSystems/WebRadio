const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ffmpegStatic = require("ffmpeg-static");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("FFmpegResolver");

function getFFmpegPath() {
  // Auf Linux/MacOS zuerst systemweites FFmpeg prüfen
  if (process.platform !== "win32") {
    const systemFFmpeg = findSystemFFmpeg();
    if (systemFFmpeg) {
      logger.info(`Verwende systemweites FFmpeg: ${systemFFmpeg}`);
      return systemFFmpeg;
    }
  }

  // Fallback auf gebündeltes FFmpeg
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

  logger.info(`Verwende gebündeltes FFmpeg: ${ffmpegPath}`);
  return ffmpegPath;
}

function findSystemFFmpeg() {
  const possiblePaths = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg", // MacOS Apple Silicon
    "/usr/local/Cellar/ffmpeg", // MacOS Intel
  ];

  // Prüfe ob FFmpeg in PATH verfügbar
  try {
    const whichFFmpeg = execSync("which ffmpeg", { encoding: "utf-8" }).trim();
    if (whichFFmpeg && fs.existsSync(whichFFmpeg)) {
      logger.debug(`FFmpeg im PATH gefunden: ${whichFFmpeg}`);
      return whichFFmpeg;
    }
  } catch (error) {
    logger.debug("FFmpeg nicht im PATH gefunden");
  }

  // Prüfe häufige Installationspfade
  for (const ffmpegPath of possiblePaths) {
    if (fs.existsSync(ffmpegPath)) {
      logger.debug(`FFmpeg in Standardpfad gefunden: ${ffmpegPath}`);
      return ffmpegPath;
    }
  }

  return null;
}

module.exports = { getFFmpegPath, findSystemFFmpeg };