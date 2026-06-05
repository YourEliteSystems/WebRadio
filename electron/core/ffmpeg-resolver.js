const fs = require("fs");
const path = require("path");
const ffmpegStatic = require("ffmpeg-static");

function getFFmpegPath() {
  let ffmpegPath = ffmpegStatic;
    console.log("FFmpeg Path:", ffmpegPath);
    console.log("Existiert:", fs.existsSync(ffmpegPath));
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