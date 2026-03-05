import { playStream, switchStream } from "./playerService.js";

export async function loadRadio() {
  const list = document.getElementById("radioList");
  const player = document.getElementById("audioElement");

  if (!list) {
    console.error("DOM-Elemente fehlen");
    return;
  }

  list.innerHTML = "Lade Sender…";

  const name =
    document.getElementById("searchInput")?.value;

  const stations = await window.api.searchRadio(name);

  list.innerHTML = "";

  stations.slice(0, 20).forEach(station => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.textContent = `${station.name} (${station.country})`;

    li.addEventListener("click", () => {
      if (!station.url_resolved) {
        console.warn("Kein Stream für", station.name);
        return;
      }
      playStream(station.url_resolved);
    });

    list.appendChild(li);
  });
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
