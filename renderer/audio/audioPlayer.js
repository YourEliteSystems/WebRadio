let audio = new Audio();
let isPlaying = false;

audio.addEventListener("play", () => isPlaying = true);
audio.addEventListener("pause", () => isPlaying = false);


audio.addEventListener("error", () => {
  alert("Stream konnte nicht geladen werden.");
});

audio.addEventListener("play", () => {
  isPlaying = true;
  updateMediaSession();
});
audio.addEventListener("pause", () => {
  isPlaying = false;
  updateMediaSession();
});

export function play(url, stationName = null) {
  if (url) audio.src = url;
  audio.play();
  nowPlaying = stationName || null;
  updateMediaSession();
  window.ipcRenderer.invoke("plugin-onPlay",{name: stationName, url});
}

export function pause() {
  audio.pause();
}

export function stop() {
  audio.pause();
  audio.currentTime = 0;
  nowPlaying = null;
  updateMediaSession();
  window.ipcRenderer.invoke("plugin-onStop");
}

export function togglePlayPause() {
  isPlaying ? pause() : audio.play();
}

function updateMediaSession() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = nowPlaying
      ? new MediaMetadata({
          title: nowPlaying,
          artist: "WebRadio",
          album: "",
          artwork: [
            { src: "assets/icons/tray.png", sizes: "64x64", type: "image/png" }
          ]
        })
      : null;

    navigator.mediaSession.setActionHandler("play", togglePlayPause);
    navigator.mediaSession.setActionHandler("pause", togglePlayPause);
    navigator.mediaSession.setActionHandler("stop", stop);
  }
}