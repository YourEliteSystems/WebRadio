"use strict";

/**
 * HttpDownloader
 *
 * Sicherer Download für Plugin-Pakete:
 *  - ausschließlich HTTPS (HTTP nur mit `allowInsecure` in Tests)
 *  - jede Redirect-Stufe wird vollständig neu geprüft
 *  - Größenlimit bereits anhand `Content-Length` und während des Streams
 *  - harter Timeout und Abbruchmöglichkeit
 *  - SHA-256 wird beim Schreiben berechnet
 *  - die tatsächlich verbrauchte IP-Adresse wird beim Verbindungsaufbau
 *    geprüft (Schutz vor DNS-Rebinding)
 *  - unvollständige Dateien werden immer entfernt
 */

const crypto = require("crypto");
const dns = require("dns");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const UpdateSourcePolicy = require("./UpdateSourcePolicy");

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 45000;
const MAX_REDIRECTS = 3;

function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* best effort */ }
}

function safeLookup(options) {
  if (options.allowInsecure) return options.lookup;
  const lookup = options.lookup || dns.lookup;
  return (hostname, lookupOptions, callback) => {
    lookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
      if (error) return callback(error);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: lookupOptions.family }];
      if (list.length === 0) return callback(new Error("dns_failed"));
      for (const entry of list) {
        if (UpdateSourcePolicy.isPrivateAddress(entry.address)) {
          const blocked = new Error("private_address");
          blocked.code = "private_address";
          return callback(blocked);
        }
      }
      const first = list[0];
      // `all` deaktivieren, damit Node die Einzeladresse erwartet.
      return callback(null, first.address, first.family);
    });
  };
}

function requestOnce(targetUrl, options) {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === "https:" ? https : http;
    const requestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method: "GET",
      headers: {
        "User-Agent": options.userAgent,
        Accept: "application/octet-stream, application/zip, application/json;q=0.9",
        "Accept-Encoding": "identity"
      },
      lookup: safeLookup(options),
      timeout: options.timeoutMs
    };

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const request = transport.request(requestOptions, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        finish({ redirect: true, status, location: response.headers.location });
        return;
      }
      if (status !== 200) {
        response.resume();
        finish({ ok: false, code: "http_error", message: `Server antwortete mit HTTP ${status}.`, status });
        return;
      }

      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        response.destroy();
        finish({ ok: false, code: "too_large", message: "Paket überschreitet das Größenlimit." });
        return;
      }

      const hash = crypto.createHash("sha256");
      const stream = fs.createWriteStream(options.destination, { mode: 0o600 });
      let bytes = 0;

      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > options.maxBytes) {
          response.destroy();
          stream.destroy();
          cleanup(options.destination);
          finish({ ok: false, code: "too_large", message: "Paket überschreitet das Größenlimit." });
          return;
        }
        hash.update(chunk);
        stream.write(chunk);
      });

      response.on("end", () => {
        stream.end(() => {
          finish({
            ok: true,
            status,
            bytes,
            sha256: hash.digest("hex"),
            filePath: options.destination
          });
        });
      });

      response.on("error", (error) => {
        stream.destroy();
        cleanup(options.destination);
        finish({ ok: false, code: "download_failed", message: error.message });
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      cleanup(options.destination);
      finish({
        ok: false,
        code: error.code === "private_address" ? "private_address" : error.message === "timeout" ? "timeout" : "network_error",
        message: error.message === "timeout" ? "Zeitüberschreitung beim Download." : error.message
      });
    });

    if (options.signal) {
      const abort = () => request.destroy(new Error("aborted"));
      if (options.signal.aborted) abort();
      else options.signal.addEventListener("abort", abort, { once: true });
    }

    request.end();
  });
}

/**
 * Lädt eine Datei sicher herunter.
 *
 * @param {string} url
 * @param {string} destination
 * @param {Object} [options]
 * @returns {Promise<{ok:boolean, sha256?:string, bytes?:number, filePath?:string, code?:string, message?:string}>}
 */
async function download(url, destination, options = {}) {
  const settings = {
    maxBytes: DEFAULT_MAX_BYTES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    allowInsecure: false,
    userAgent: "WebRadio-PluginUpdater",
    ...options,
    destination
  };

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  cleanup(destination);

  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const policy = await UpdateSourcePolicy.validateSource(currentUrl, settings);
    if (!policy.ok) {
      cleanup(destination);
      return { ok: false, code: policy.code, message: policy.message };
    }

    const response = await requestOnce(currentUrl, settings);
    if (response.redirect) {
      if (hop === MAX_REDIRECTS) {
        cleanup(destination);
        return { ok: false, code: "too_many_redirects", message: "Zu viele Weiterleitungen." };
      }
      if (!response.location) {
        cleanup(destination);
        return { ok: false, code: "invalid_redirect", message: "Weiterleitung ohne Ziel." };
      }
      try {
        currentUrl = new URL(response.location, currentUrl).href;
      } catch {
        cleanup(destination);
        return { ok: false, code: "invalid_redirect", message: "Weiterleitungsziel ist ungültig." };
      }
      continue;
    }

    if (!response.ok) cleanup(destination);
    return response;
  }

  cleanup(destination);
  return { ok: false, code: "too_many_redirects", message: "Zu viele Weiterleitungen." };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_REDIRECTS,
  download
};
