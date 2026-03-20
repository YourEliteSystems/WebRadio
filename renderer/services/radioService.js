import { playStream, switchStream } from "./playerService.js";

export async function loadRadio() {
  const grid = document.getElementById("radioGrid");
  const player = document.getElementById("audioElement");

  if (!grid) {
    console.error("DOM-Elemente fehlen");
    return;
  }

  grid.innerHTML = "Lade Sender…";

  const name =
    document.getElementById("searchInput")?.value;

  const stations = await window.api.searchRadio(name);

  grid.innerHTML = "";

  stations.slice(0, 20).forEach(station => {
    const card = document.createElement("div");
    card.className = "stationCard";

    const logo = document.createElement("img");
    logo.className = "stationLogo";

    logo.src = station.favicon || "../assets/default-logo.png";

    logo.onerror = () => {
      logo.src = "../assets/default-logo.png";
    };

    const title = document.createElement("div");
    title.className = "stationName";
    title.textContent = station.name;

    const country = document.createElement("div");
    country.className = "stationCountry";
    country.textContent = station.country || "Unbekannt";

    card.appendChild(logo);
    card.appendChild(title);
    card.appendChild(country);


    card.addEventListener("click", () => {
      if (!station.url_resolved) {
        console.warn("Kein Stream für", station.name);
        return;
      }
      //playStream(station.url_resolved);
      switchStream(station.url_resolved);
      window.analytics.trackEvent("Station Switched", { station: station.name });
      setNowPlaying(station);
    });

    grid.appendChild(card);
  });
}

const logoCache = {};

async function fetchLogo(name){

  if(logoCache[name]) return logoCache[name];

  const res = await fetch(
    `https://de1.api.radio-browser.info/json/stations/byname/${encodeURIComponent(name)}`
  );

  const data = await res.json();

  const logo = data[0]?.favicon || null;

  logoCache[name] = logo;

  return logo;

}


function playStation(station, player) {
  if (!station.url_resolved) {
    console.error("Keine Stream-URL:", station.name);
    return;
  }

  player.pause();
  player.src = station.url_resolved;
  player.load();

  player
    .play()
    .then(() => {
      console.log("▶️ Playing:", station.name);
    })
    .catch(err => {
      console.error("❌ Playback error:", err);
    });
}

function setNowPlaying(station){

  document.getElementById("np-station").textContent =
    station.name;

  document.getElementById("np-logo").src =
    station.favicon || "../assets/default-logo.png";

}