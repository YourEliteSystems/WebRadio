const { net, app, shell } = require("electron");
const crypto = require("crypto");    // NEU
const fs = require("fs");            // NEU
const path = require("path");        // NEU
const LogManager = require("./diagnostics/logging/LogManager");

const logger = LogManager.getLogger("Updater");

const UPDATE_URL = "https://updates.yourelitesystems.de/webradio/latest.json";
const FALLBACK_URL = "https://raw.githubusercontent.com/YourEliteSystems/WebRadio/master/updates/latest.json";

let cachedUpdateInfo = null;

/**
 * Vergleicht zwei semver-Strings. Gibt true zurück wenn remote > local.
 */
function isNewerVersion(local, remote) {
  const parse = (v) => String(v).replace(/^v/, "").split(".").map(Number);
  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

/**
 * Holt latest.json vom Update-Server.
 * @returns {Promise<{version, releaseNotes, windows:{url,sha256}} | null>}
 */
async function fetchLatest() {
  const urls = [UPDATE_URL, FALLBACK_URL];
  for (const url of urls) {
    try {
      const response = await net.fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      return data;
    } catch (e) {
      logger.warn(`[Updater] Fetch fehlgeschlagen (${url}): ${e.message}`);
    }
  }
  return null;
}

/**
 * Prüft ob eine neue Version verfügbar ist.
 * @returns {Promise<{available: boolean, version?: string, releaseNotes?: string, url?: string} >}
 */
async function checkForUpdates() {
  try {
    const latest = await fetchLatest();
    if (!latest || !latest.version) {
      return { available: false };
    }

    const currentVersion = app.getVersion();
    const available = isNewerVersion(currentVersion, latest.version);

    if (available) {
      cachedUpdateInfo = latest;
      logger.info(`[Updater] Neue Version verfügbar: ${latest.version} (aktuell: ${currentVersion})`);
      return {
        available: true,
        version: latest.version,
        releaseNotes: latest.releaseNotes || "",
        url: latest.windows?.url || null
      };
    }

    logger.info(`[Updater] App ist aktuell (${currentVersion})`);
    return { available: false, version: currentVersion };

  } catch (err) {
    logger.error(`[Updater] Fehler beim Update-Check: ${err.message}`);
    return { available: false };
  }
}

/**
 * Lädt die Update-Datei herunter, prüft den SHA-256-Hash und startet die Installation.
 * Bricht ab und löscht die Datei, wenn der Hash nicht stimmt.
 * @returns {Promise<boolean>} true bei Erfolg, sonst false
 */
async function downloadAndInstall() {
  const info = cachedUpdateInfo;
  if (!info || !info.windows?.url || !info.windows?.sha256) {
    logger.error("[Updater] Keine gültigen Update-Informationen vorhanden.");
    return false;
  }

  const downloadUrl = info.windows.url;
  const expectedHash = info.windows.sha256;
  const tempDir = app.getPath("temp");
  const installerPath = path.join(tempDir, "WebRadio-Update.exe"); // oder .zip

  logger.info(`[Updater] Lade Update herunter: ${downloadUrl}`);

  return new Promise((resolve) => {
    const request = net.request(downloadUrl);
    const hash = crypto.createHash("sha256");
    const fileStream = fs.createWriteStream(installerPath);

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        logger.error(`[Updater] Download fehlgeschlagen (Status ${response.statusCode})`);
        fileStream.close();
        fs.unlink(installerPath, () => {});
        resolve(false);
        return;
      }

      response.on("data", (chunk) => {
        hash.update(chunk);
        fileStream.write(chunk);
      });

      response.on("end", () => {
        fileStream.end(() => {
          const actualHash = hash.digest("hex");

          if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
            logger.error("[Updater] Hash stimmt nicht! Update abgebrochen.");
            logger.error(`Erwartet: ${expectedHash}`);
            logger.error(`Berechnet: ${actualHash}`);
            fs.unlink(installerPath, (err) => {
              if (err) logger.error(`Konnte ungültige Datei nicht löschen: ${err.message}`);
              resolve(false);
            });
            return;
          }

          logger.info("[Updater] Hash OK. Starte Installation...");
          shell.openPath(installerPath).then(() => {
            resolve(true);
          }).catch((err) => {
            logger.error(`[Updater] Fehler beim Starten des Installers: ${err.message}`);
            resolve(false);
          });
        });
      });

      response.on("error", (err) => {
        logger.error(`[Updater] Fehler beim Download: ${err.message}`);
        fileStream.close();
        fs.unlink(installerPath, () => {});
        resolve(false);
      });
    });

    request.on("error", (err) => {
      logger.error(`[Updater] Netzwerkfehler: ${err.message}`);
      fileStream.close();
      fs.unlink(installerPath, () => {});
      resolve(false);
    });

    request.end();
  });
}

/**
 * Öffnet den externen Download-Link im Browser (Fallback).
 */
async function openDownloadPage() {
  const info = cachedUpdateInfo;
  if (info?.windows?.url) {
    await shell.openExternal(info.windows.url);
  } else {
    await shell.openExternal("https://github.com/YourEliteSystems/WebRadio/releases/latest");
  }
}

module.exports = { checkForUpdates, openDownloadPage, downloadAndInstall };