"use strict";

/**
 * PluginHttpServer – Lokaler HTTP-Server für Plugin-Ressourcen.
 *
 * Erweitert um Capability-System:
 * - Capabilities steuern, welche externen Origins erlaubt sind
 * - Core kontrolliert alle Zugriffsregeln
 * - Keine Plugin-ID-Sonderfälle
 */

const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const LogManager = require("../diagnostics/logging/LogManager");
const PluginPermissions = require("./PluginPermissions");

const logger = LogManager.getLogger("PluginHttpServer");

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map":  "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2"
});

// Ausschließlich Loopback-Bindung. Der Plugin-Server darf niemals auf
// 0.0.0.0 oder einer extern erreichbaren Netzwerkschnittstelle lauschen.
const LOOPBACK_HOST = "127.0.0.1";

// Erlaubte Methoden für tatsächliche Plugin-Ressourcen.
const ALLOWED_RESOURCE_METHODS = ["GET", "HEAD"];

// Origin-Werte, die keinen echten, serialisierbaren Origin darstellen.
// Der Renderer läuft in einem file://-/opaken Kontext. Solche Requests
// dürfen niemals per Echo beantwortet werden, weil die Echokopie kein
// gültiger CORS-Origin ist und den Modul-Import blockieren würde.
const OPAQUE_ORIGIN_VALUES = Object.freeze(["null", "file://", "file:"]);

/**
 * Normalisiert den Origin-Header. Liefert null, wenn kein (verwertbarer)
 * Origin-Header vorhanden ist.
 */
function normalizeOriginHeader(originHeader) {
  if (typeof originHeader !== "string") return null;
  const value = originHeader.trim();
  return value === "" ? null : value;
}

/**
 * Prüft, ob der Request aus einem lokalen/opaken Kontext kommt
 * (kein Origin-Header, Origin: null oder file://-Origin).
 */
function isOpaqueOrLocalOrigin(origin) {
  if (origin === null) return true;
  return OPAQUE_ORIGIN_VALUES.includes(origin.toLowerCase());
}

class PluginHttpServer {
  constructor() {
    this._server  = null;
    this._port    = null;
    this._plugins = new Map();
  }

  async start() {
    if (this._server) {
      logger.warn("PluginHttpServer läuft bereits");
      return;
    }

    this._server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    await new Promise((resolve, reject) => {
      // Dynamische Portvergabe (0) + ausschließlich Loopback-Bindung.
      this._server.listen(0, LOOPBACK_HOST, () => {
        this._port = this._server.address().port;
        logger.info(`PluginHttpServer gestartet auf http://${LOOPBACK_HOST}:${this._port}`);
        resolve();
      });
      this._server.once("error", reject);
    });
  }

  async stop() {
    if (!this._server) return;

    await new Promise((resolve) => {
      this._server.close(() => {
        logger.info("PluginHttpServer beendet");
        resolve();
      });
    });

    this._server = null;
    this._port   = null;
  }

  getUrl() {
    if (!this._server || !this._port) return null;
    return `http://${LOOPBACK_HOST}:${this._port}`;
  }

  getPort() {
    return this._port;
  }

  /**
   * Liefert die aktuell gebundene Adresse (nur Loopback erlaubt).
   * Wird u. a. von Tests genutzt, um die Bindung zu verifizieren.
   */
  getAddress() {
    if (!this._server) return null;
    const address = this._server.address();
    return address ? address.address : null;
  }

  servePlugin(pluginId, pluginPath, capabilities = []) {
    const resolved = path.resolve(pluginPath);
    if (!fs.existsSync(resolved)) {
      logger.warn(`servePlugin(${pluginId}): Pfad existiert nicht: ${resolved}`);
      return;
    }
    this._plugins.set(pluginId, {
      root: resolved,
      capabilities: capabilities
    });
    logger.info(`Plugin registriert für HTTP: ${pluginId} → ${resolved}`);
  }

  unservePlugin(pluginId) {
    this._plugins.delete(pluginId);
    logger.info(`Plugin aus HTTP entfernt: ${pluginId}`);
  }

  getPluginUrl(pluginId, relativePath) {
    if (!this._port) return null;
    const normalised = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    return `http://${LOOPBACK_HOST}:${this._port}/plugins/${pluginId}/${normalised}`;
  }

  canAccessOrigin(pluginId, origin) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      return { allowed: false, reason: "Plugin not registered" };
    }
    return PluginPermissions.isOriginAllowed(plugin.capabilities, origin);
  }

  getPluginCapabilities(pluginId) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) return [];
    return plugin.capabilities || [];
  }

  /**
   * Ermittelt die CORS-Header für eine Antwort.
   *
   * - Kein/opaker Origin (file://-Renderer, `Origin: null`, kein Header):
   *   `Access-Control-Allow-Origin: *`. Das ist der vorgesehene, lokale
   *   Plugin-Modul-Kontext. Ein Echo des Rohwerts (`file://`, `null`) wäre
   *   kein gültiger CORS-Origin und würde den Modul-Import blockieren.
   * - Gültiger externer Origin: Der zuvor capability-geprüfte Origin wird
   *   zurückgegeben (plus `Vary: Origin`, damit Antworten korrekt gecacht
   *   werden).
   *
   * `Cross-Origin-Resource-Policy: cross-origin` macht explizit, dass die
   * Antwort von anderen Origins (u. a. dem opaken file://-Kontext des
   * Renderers) konsumiert werden darf. Die eigentliche Zugangskontrolle
   * bleibt die Origin-/Capability-Prüfung vor dem Ausliefern.
   */
  _buildCorsHeaders(corsOrigin, { preflight = false } = {}) {
    const headers = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Origin, Accept, Content-Type",
      "Cross-Origin-Resource-Policy": "cross-origin"
    };

    if (corsOrigin !== "*") {
      headers["Vary"] = "Origin";
    }

    if (preflight) {
      headers["Access-Control-Max-Age"] = "600";
    }

    return headers;
  }

  /**
   * Prüft die Origin-Policy für einen Request.
   *
   * Nur echte, externe Origins werden capability-basiert validiert.
   * Fehlende/opake Origins stammen aus dem lokalen Renderer-Kontext
   * (file://) und werden ausschließlich lokal ausgeliefert.
   *
   * @returns {{ allowed: boolean, corsOrigin: string }}
   */
  _checkOriginPolicy(req) {
    const origin = normalizeOriginHeader(req.headers.origin);

    if (isOpaqueOrLocalOrigin(origin)) {
      return { allowed: true, corsOrigin: "*" };
    }

    const urlPath = req.url.split("?")[0];
    const match = urlPath.match(/^\/plugins\/([^/]+)\//);
    const pluginId = match ? match[1] : null;

    if (!pluginId) {
      return { allowed: false, corsOrigin: null };
    }

    const originCheck = this.canAccessOrigin(pluginId, origin);
    if (!originCheck.allowed) {
      logger.warn(`Origin nicht erlaubt: ${origin} für Plugin ${pluginId}`);
      return { allowed: false, corsOrigin: null };
    }

    return { allowed: true, corsOrigin: origin };
  }

  _handleRequest(req, res) {
    // 1) Origin-Policy vor jeder Auslieferung (GET, HEAD und OPTIONS).
    const { allowed, corsOrigin } = this._checkOriginPolicy(req);

    if (!allowed) {
      // Diagnose-Kategorie: CORS-/Origin-Ablehnung (noch vor jeder Auslieferung).
      logger.warn(
        `[cors-rejected] ${req.method} ${req.url || "/"} → 403 ` +
        `(Origin: ${normalizeOriginHeader(req.headers.origin) || "<kein>"})`
      );
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden: Invalid Origin");
      return;
    }

    // 2) Preflight: OPTIONS beantwortet ausschließlich die CORS-Frage.
    //    Es werden keine Dateiinhalte ausgeliefert.
    if (req.method === "OPTIONS") {
      const preflightHeaders = this._buildCorsHeaders(corsOrigin, { preflight: true });
      logger.info(
        `[preflight] OPTIONS ${req.url || "/"} → 204 ` +
        `(Origin: ${normalizeOriginHeader(req.headers.origin) || "<kein>"}; ` +
        `ACAO: ${preflightHeaders["Access-Control-Allow-Origin"]})`
      );
      res.writeHead(204, preflightHeaders);
      res.end();
      return;
    }

    // 3) Tatsächliche Ressourcen-Requests: nur GET und HEAD.
    if (!ALLOWED_RESOURCE_METHODS.includes(req.method)) {
      // Diagnose-Kategorie: nicht erlaubte HTTP-Methode.
      logger.warn(
        `[http-error] ${req.method} ${req.url || "/"} → 405 ` +
        `(erlaubt sind: ${ALLOWED_RESOURCE_METHODS.join(", ")}, OPTIONS)`
      );
      res.writeHead(405, { "Content-Type": "text/plain", "Allow": "GET, HEAD, OPTIONS" });
      res.end("Method Not Allowed");
      return;
    }

    const urlPath = req.url.split("?")[0];
    const match   = urlPath.match(/^\/plugins\/([^/]+)\/(.+)$/);

    if (!match) {
      // Diagnose-Kategorie: Route nicht registriert.
      logger.warn(
        `[route-unregistered] ${req.method} ${urlPath} → 404 ` +
        `(kein /plugins/<id>/<pfad>-Muster)`
      );
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const [, pluginId, relativePath] = match;
    const pluginEntry = this._plugins.get(pluginId);

    if (!pluginEntry) {
      // Diagnose-Kategorie: Plugin dem Server nicht bekannt.
      logger.warn(
        `[unknown-plugin] ${req.method} ${urlPath} → 404 ` +
        `(Plugin "${pluginId}" ist dem PluginHttpServer nicht registriert; ` +
        `registriert sind: ${this._registeredPluginIds()})`
      );
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Plugin "${pluginId}" nicht registriert`);
      return;
    }

    const pluginRoot = pluginEntry.root;

    const absolute = path.resolve(pluginRoot, relativePath);
    if (!absolute.startsWith(pluginRoot + path.sep) && absolute !== pluginRoot) {
      // Diagnose-Kategorie: Zugriff außerhalb des Plugin-Roots (Traversal).
      logger.warn(
        `[file-unreadable] ${req.method} ${urlPath} → 403 ` +
        `(Path-Traversal-Versuch: ${absolute}; Plugin-Root: ${pluginRoot})`
      );
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    let stat = null;
    try {
      stat = fs.statSync(absolute);
    } catch {
      // Datei existiert nicht oder ist nicht lesbar → unten als 404 gemeldet.
      stat = null;
    }

    if (!stat || !stat.isFile()) {
      // Diagnose-Kategorie: Datei nicht vorhanden (oder kein reguläre Datei).
      logger.warn(
        `[file-missing] ${req.method} ${urlPath} → 404 ` +
        `(aufgelöst: ${absolute}; Plugin-Root: ${pluginRoot}; ` +
        `${stat ? "kein reguläre Datei" : "existiert nicht"})`
      );
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext      = path.extname(absolute).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    let content = null;
    try {
      content = fs.readFileSync(absolute);
    } catch (err) {
      // Diagnose-Kategorie: Datei kann nicht gelesen werden.
      logger.error(
        `[file-unreadable] ${req.method} ${urlPath} → 500 ` +
        `(aufgelöst: ${absolute}): ${err.message}\n${err.stack || ""}`
      );
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    const responseHeaders = {
      "Content-Type":  mimeType,
      "Cache-Control": "no-cache",
      ...this._buildCorsHeaders(corsOrigin)
    };

    // Diagnose-Kategorie: erfolgreich ausgeliefert (Status, MIME, Größe, CORS).
    logger.info(
      `[served] ${req.method} ${urlPath} → 200 ` +
      `(Plugin: ${pluginId}; aufgelöst: ${absolute}; Content-Type: ${mimeType}; ` +
      `${content.length} Bytes; Origin: ${normalizeOriginHeader(req.headers.origin) || "<kein>"}; ` +
      `ACAO: ${responseHeaders["Access-Control-Allow-Origin"]})`
    );

    res.writeHead(200, responseHeaders);

    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(content);
    }
  }

  /**
   * Liefert die aktuell registrierten Plugin-IDs als kommagetrennte Liste.
   * Nur für Diagnose-Ausgaben gedacht.
   */
  _registeredPluginIds() {
    const ids = Array.from(this._plugins.keys());
    return ids.length > 0 ? ids.join(", ") : "<keine>";
  }
}

const pluginHttpServer = new PluginHttpServer();
module.exports = pluginHttpServer;
module.exports.PluginHttpServer = PluginHttpServer;