const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { app } = require("electron");
const ffmpegStatic = require("ffmpeg-static");
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("FFmpegResolver");

/**
 * Liefert den absoluten Pfad zur FFmpeg-Binary.
 *
 * Reihenfolge der Auflösung:
 *   1) Systemweites FFmpeg (nur Linux/macOS, optional).
 *      Wird benutzt, falls vorhanden – so können Distributionen
 *      ihre eigene FFmpeg-Version aus dem Paket-Manager einsetzen.
 *
 *   2) Gebündeltes ffmpeg-static.
 *      Wird beim Build via asarUnpack aus dem ASAR-Archiv herausgelöst,
 *      damit das ELF-Binary tatsächlich ausgeführt werden kann.
 *
 * Der zurückgegebene Pfad ist auf Linux x86_64 stets die mitgelieferte
 * Binary – der Endanwender muss KEIN systemweites FFmpeg installieren.
 */
function getFFmpegPath() {
  // Auf Linux/macOS zuerst systemweites FFmpeg prüfen.
  if (process.platform !== "win32") {
    const systemFFmpeg = findSystemFFmpeg();
    if (systemFFmpeg) {
      logger.info(`Verwende systemweites FFmpeg: ${systemFFmpeg}`);
      return systemFFmpeg;
    }
  }

  // Fallback auf gebündeltes FFmpeg aus ffmpeg-static.
  let ffmpegPath = ffmpegStatic;

  if (!ffmpegPath) {
    logger.error("ffmpeg-static liefert keinen Pfad – FFmpeg ist nicht verfügbar.");
    return null;
  }

  logger.debug(`FFmpeg Path (raw): ${ffmpegPath}`);
  logger.debug(`Existiert: ${fs.existsSync(ffmpegPath)}`);

  // Wenn gepackt → ASAR-Korrektur. Electron packt Binaries aus app.asar
  // nach app.asar.unpacked aus, sobald sie via asarUnpack konfiguriert sind.
  if (ffmpegPath.includes("app.asar")) {
    ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
    logger.debug(`FFmpeg Path (unpacked): ${ffmpegPath}`);
  }

  // Linux: executable-Permission prüfen. Bei AppImages / .deb / .pkg.tar.zst
  // sollte das Bit bereits gesetzt sein. Fallback: sicherheitshalber setzen
  // (kein chmod 777, sondern gezielt nur das Owner-Execute-Bit).
  if (process.platform !== "win32") {
    try {
      const stat = fs.statSync(ffmpegPath);
      const ownerExec = stat.mode & 0o100;
      if (!ownerExec) {
        fs.chmodSync(ffmpegPath, stat.mode | 0o755);
        logger.info("FFmpeg execute-Bit gesetzt (chmod +x).");
      }
    } catch (err) {
      logger.warn(`Konnte execute-Bit nicht prüfen/setzen: ${err.message}`);
    }
  }

  logger.info(`Verwende gebündeltes FFmpeg: ${ffmpegPath}`);
  return ffmpegPath;
}

function findSystemFFmpeg() {
  // Wird nur unter Nicht-Windows genutzt.
  const possiblePaths = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg", // macOS Apple Silicon
    "/usr/local/Cellar/ffmpeg", // macOS Intel
  ];

  // Prüfe ob FFmpeg in PATH verfügbar ist.
  try {
    const whichFFmpeg = execSync("which ffmpeg", { encoding: "utf-8" }).trim();
    if (whichFFmpeg && fs.existsSync(whichFFmpeg)) {
      logger.debug(`FFmpeg im PATH gefunden: ${whichFFmpeg}`);
      return whichFFmpeg;
    }
  } catch (error) {
    logger.debug("FFmpeg nicht im PATH gefunden");
  }

  // Prüfe häufige Installationspfade.
  for (const ffmpegPath of possiblePaths) {
    if (fs.existsSync(ffmpegPath)) {
      logger.debug(`FFmpeg in Standardpfad gefunden: ${ffmpegPath}`);
      return ffmpegPath;
    }
  }

  return null;
}

/**
 * Hilfsfunktion für Diagnose / Logs.
 * Liefert den Pfad, an dem WebRadio produktiv nach Plugins / Themes sucht.
 * Plattformunabhängig über app.getPath("userData").
 */
function getUserDataPath() {
  if (app && typeof app.getPath === "function") {
    return app.getPath("userData");
  }
  return path.join(process.cwd(), "data");
}

module.exports = {
  getFFmpegPath,
  findSystemFFmpeg,
  getUserDataPath
};