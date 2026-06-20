const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const cache_file = path.join(app.getPath("userData"), "radiobrowser-servers.json");

const RADIO_MIRRORS = [
  "https://de1.api.radio-browser.info/json",
  "https://fi1.api.radio-browser.info/json"
];
const RADIO_HEADERS = { "User-Agent": "WebRadioApp/1.0" };

async function fetchServerList() {
  const res = await fetch("https://de1.api.radio-browser.info/json/servers");
  return await res.json();
}

async function getMirrors() {
  try {
    if (fs.existsSync(cache_file)) {
      const cache = JSON.parse(fs.readFileSync(cache_file, "utf8"));
      const age = Date.now() - cache.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        return cache.mirrors;
      }
    }
  } catch { }
  try {
    const servers = await fetchServerList();
      const mirrors =
      servers.map(
        s => `https://${s.name}/json`
      );
    fs.mkdirSync(path.dirname(cache_file), { recursive: true });
    fs.writeFileSync(cache_file, JSON.stringify({
      updated: Date.now(),
      servers: mirrors
    }));
    return mirrors;
  }catch(err) {
    console.warn("[RadioBrowser] Serverliste konnte nicht geladen werden. Err Message:", err.message);
  }
  return RADIO_MIRRORS;
}
async function radioFetch(path) {
  let lastError;
  const mirrors = await getMirrors();

  for (const base of mirrors) {
    try {
      const res = await globalThis.fetch(`${base}${path}`, {
        headers: RADIO_HEADERS,
        signal: AbortSignal.timeout(8000),   // 8 s Timeout pro Versuch
      });

      if (!res.ok) throw new Error(`Radio API ${res.status}`);
      return res.json();

    } catch (err) {
      console.warn(`[RadioBrowser] ${base} fehlgeschlagen:`, err.message);
      lastError = err;
      // kurze Pause vor dem nächsten Mirror
      await new Promise(r => setTimeout(r, 300));
    }
  }

  throw lastError;
}


function isUsableTag(tag) {
  const name = tag.name.trim();

  if (tag.stationcount < 5) return false;
  if (name.includes('"')) return false;
  if (name.startsWith("#")) return false;
  if (/^\d/.test(name)) return false;
  if (name.length > 40) return false;

  return true;
}

async function getCountries() {
  const countries = await radioFetch("/countries");

  return countries
    .filter(c => c.stationcount > 0)
    .sort((a, b) =>
      a.name.localeCompare(b.name, "de")
    );
}

async function getTags() {
  const tags = await radioFetch(
    "/tags?order=stationcount&reverse=true&limit=500"
  );

  return tags.filter(isUsableTag);
}

async function search(params) {

  const opts =
    typeof params === "string"
      ? { name: params }
      : (params || {});

  const query = new URLSearchParams();

  if (opts.name) {
    query.set("name", opts.name);
  }

  if (opts.country) {
    query.set("countrycode", opts.country);
  }

  if (opts.genre) {
    query.set("tag", opts.genre);
  }

  query.set("limit", "50");
  query.set("order", "votes");
  query.set("reverse", "true");

  return radioFetch(
    `/stations/search?${query.toString()}`
  );
}


module.exports = {
  getCountries,
  getTags,
  search
};