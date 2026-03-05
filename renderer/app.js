//import { GENRES, COUNTRIES, searchStations } from "./services/radioService.js";
import { play } from "./audio/audioPlayer.js";
import {
  addFavorite,
  getFavorites,
  loadFavorites 
} from "./services/favoriteService.js";
import { addHistory, loadHistory } from "./services/historyService.js";
import { initPlayer, getAnalyser, stopStream, playStream, setVolume, switchStream } from "./services/playerService.js";

import { loadRadio } from "./services/radioService.js";
console.log("radioAPI:", window.radioAPI);

await initPlayer();

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

function onStationClick(station) {
  playStream(station.url_resolved);
}

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

function renderStations(stations) {
  const list = document.getElementById("stations");
  list.innerHTML = "";

  stations.forEach(s => {
    const li = document.createElement("li");

    const fav = isFavorite(s.stationuuid) ? "★" : "☆";

    li.innerHTML = `
      <strong>${s.name}</strong> (${s.country})
      <button data-id="${s.stationuuid}">${fav}</button>
    `;

    li.onclick = () => {
      playStream(s.url_resolved);
      setNowPlaying(s.name);
      addHistory({
        id: s.stationuuid,
        name: s.name,
        country: s.country,
        streamUrl: s.url_resolved,
        favicon: s.favicon
      });
      loadHistory();
    };

    li.querySelector("button").onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(s);
      loadFavorites();
    };

    list.appendChild(li);
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