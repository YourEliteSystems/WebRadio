import {
  addFavorite,
  getFavorites,
  loadFavorites 
} from "./services/favoriteService.js";
import { addHistory, loadHistory } from "./services/historyService.js";
import { initPlayer, getAnalyser, stopStream, playStream, setVolume, switchStream } from "./services/playerService.js";

import { loadRadio } from "./services/radioService.js";
//console.log("radioAPI:", window.radioAPI);

window.addEventListener('error', (event) => {
  window.sentry.captureException(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  window.sentry.captureException(event.reason);
});

await initPlayer();
loadThemes();

document.getElementById("openSettings")
  .addEventListener("click", () => {
    window.api.openSettings();
    window.analytics.trackEvent("Settings Opened");
  });

document.addEventListener("DOMContentLoaded", () => {
  if (window.radioAPI?.onMetadata) {
    window.radioAPI.onMetadata(meta => {
      if (meta.StreamTitle) {
        const titleEl = document.getElementById("np-title");
        if (titleEl) {
          titleEl.textContent = meta.StreamTitle;
        }
      }
      eventBus.emit("metadata", meta);
    });
  }
});

document.getElementById("btnMinimize")
  .addEventListener("click", () => {
    window.windowControls.minimize();
    window.analytics.trackEvent("Window Minimized");
});
document.getElementById("btnMaximize")
  .addEventListener("click", () => {
    window.windowControls.maximize();
    window.analytics.trackEvent("Window Maximized");
});

document.getElementById("btnClose")
  .addEventListener("click", () => {
    window.windowControls.close();
    window.analytics.trackEvent("App Closed");
});


async function loadThemes() {
  const themes = await window.themeAPI.getThemes();
  const selector = document.getElementById("themeSelector");
  selector.innerHTML = "";
  for (const theme of themes) {
    const option = document.createElement("option");
    option.value = theme.css;
    option.textContent = theme.name;
    selector.appendChild(option);
  }
  if(themes.length > 0) {
    setTheme(themes[1].css);
  }
}

function setTheme(cssPath) {
  let link = document.getElementById("theme-style");
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "theme-style";
    document.head.appendChild(link);
  }
  link.href = cssPath;
}

document.getElementById("themeSelector").addEventListener("change", (e) => {
  setTheme(e.target.value);
});
document.addEventListener("DOMContentLoaded", () => {
  //loadRadio();
  document.getElementById("searchBtn")
    .addEventListener("click", loadRadio);

  document.getElementById("stopBtn")
    .addEventListener("click", stopStream);

});
const vol =document.getElementById("volume");

vol.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  setVolume(val);
});
initVisualizer();

document.getElementById("searchBtn").addEventListener("click", loadRadio);
document.getElementById("loadFav")
  .addEventListener("click", loadFavorites);
  document.getElementById("loadHistory")
  .addEventListener("click", loadHistory);

async function loadRadios() {
  const query = document.getElementById("search").value;
  const country = document.getElementById("countryFilter").value;
  const genre = document.getElementById("genreFilter").value;

  const stations = await searchStations(query, country, genre);
  renderStations(stations.slice(0, 50));
};

const radioGrid = document.getElementById("radioGrid");

function renderStations(stations) {
  radioGrid.innerHTML = "";

  stations.forEach(s => {
    const card = document.createElement("div");
    card.className = "stationcard";

    card.onclick = () => {
      playStream(s.url_resolved);
    };

    const logo = document.createElement("img");
    logo.className = "logo";
    logo.src = station.logo;

    const name = document.createElement("div");
    name.className = "stationName";
    name.textContent = station.name;
    radioGrid.appendChild(card);
  });
}


function toggleFavorite(station) {
  if (isFavorite(station.stationuuid)) {
    removeFavorite(station.stationuuid);
  } else {
    addFavorite({
      id: station.stationuuid,
      ...station
    });
  }
}


window.media.onPlayPause(() => {
  togglePlayPause();
});


window.media.onStop(() => {
  stop();
  setNowPlaying(null);
});


function initVisualizer() {
  const canvas = document.getElementById("vu");
  const ctx = canvas.getContext("2d");
  const analyser = getAnalyser();

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = dataArray[i] / 255 * canvas.height;
      ctx.fillStyle = `rgb(${i}, 0, 255)`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
  draw();
}