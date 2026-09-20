"use strict";

/**
 * PluginHttpServer – Lokaler HTTP-Server für Plugin-Ressourcen.
 *
 * Ziel: Plugins wie MediaHub müssen ihre Ressourcen über http://127.0.0.1:<port>/
 * ausliefern, damit eingebettete Inhalte (z.B. YouTube IFrame) korrekt
 * funktionieren (file://-Origin verursacht YouTube-Error 153).
 *
 * Sicherheit:
 *  - Lauscht ausschließlich auf 127.0.0.1 (localhost)
 *  - Kein externer Netzwerkzugriff möglich
 *  - Nur explizit registrierte Plugin-Pfade werden ausgeliefert
 *  - Path-Traversal-Schutz (Dateipfad darf nicht über Plugin-Root hinausgehen)
 *  - Dynamischer Port (kein Konflikt mit anderen Prozessen)
 */

const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginHttpServer");

// MIME-Typen für gängige statische Dateien
const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2"
});

class PluginHttpServer {
  constructor() {
    this._server  = null;
    this._port    = null;
    this._plugins = new Map(); // pluginId → absolutePluginRoot
  }

  /**
   * Startet den lokalen HTTP-Server auf einem dynamischen Port.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._server) {
      logger.warn("PluginHttpServer läuft bereits");
      return;
    }

    this._server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    await new Promise((resolve, reject) => {
      this._server.listen(0, "127.0.0.1", () => {
        this._port = this._server.address().port;
        logger.info(`PluginHttpServer gestartet auf http://127.0.0.1:${this._port}`);
        resolve();
      });
      this._server.once("error", reject);
    });
  }

  /**
   * Beendet den HTTP-Server sauber.
   * @returns {Promise<void>}
   */
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

  /**
   * Gibt die Basis-URL des Servers zurück.
   * @returns {string|null}  "http://127.0.0.1:<port>" oder null wenn nicht gestartet
   */
  getUrl() {
    if (!this._server || !this._port) return null;
    return `http://127.0.0.1:${this._port}`;
  }

  /**
   * Gibt den Port des Servers zurück.
   * @returns {number|null}
   */
  getPort() {
    return this._port;
  }

  /**
   * Registriert einen Plugin-Pfad für HTTP-Auslieferung.
   * @param {string} pluginId    Plugin-ID
   * @param {string} pluginPath  Absoluter Pfad zum Plugin-Verzeichnis
   */
  servePlugin(pluginId, pluginPath) {
    const resolved = path.resolve(pluginPath);
    if (!fs.existsSync(resolved)) {
      logger.warn(`servePlugin(${pluginId}): Pfad existiert nicht: ${resolved}`);
      return;
    }
    this._plugins.set(pluginId, resolved);
    logger.info(`Plugin registriert für HTTP: ${pluginId} → ${resolved}`);
  }

  /**
   * Entfernt einen Plugin-Pfad aus dem HTTP-Server.
   * @param {string} pluginId
   */
  unservePlugin(pluginId) {
    this._plugins.delete(pluginId);
    logger.info(`Plugin aus HTTP entfernt: ${pluginId}`);
  }

  /**
   * Gibt die URL für ein Plugin-Asset zurück.
   * @param {string} pluginId
   * @param {string} relativePath  Relativer Pfad innerhalb des Plugin-Verzeichnisses
   * @returns {string|null}
   */
  getPluginUrl(pluginId, relativePath) {
    if (!this._port) return null;
    const normalised = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    return `http://127.0.0.1:${this._port}/plugins/${pluginId}/${normalised}`;
  }

  // ─────────────────────────────────────────────
  // HTTP Request Handler
  // ─────────────────────────────────────────────

  _handleRequest(req, res) {
    // Nur GET
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    // Origin-Validation für Security
    const origin = req.headers.origin;
    if (origin && origin !== "http://127.0.0.1" && origin !== "http://localhost") {
      // Nur localhost/127.0.0.1 erlauben
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden: Invalid Origin");
      return;
    }

    // URL parsen: /plugins/<pluginId>/<...relativePath>
    const urlPath = req.url.split("?")[0]; // Query-String abschneiden
    const match   = urlPath.match(/^\/plugins\/([^/]+)\/(.+)$/);

    if (!match) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const [, pluginId, relativePath] = match;
    const pluginRoot = this._plugins.get(pluginId);

    if (!pluginRoot) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Plugin "${pluginId}" nicht registriert`);
      return;
    }

    // Path-Traversal-Schutz
    const absolute = path.resolve(pluginRoot, relativePath);
    if (!absolute.startsWith(pluginRoot + path.sep) && absolute !== pluginRoot) {
      logger.warn(`Path-Traversal-Versuch: ${absolute}`);
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    // MIME-Typ ermitteln
    const ext      = path.extname(absolute).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    const content = fs.readFileSync(absolute);
    res.writeHead(200, {
      "Content-Type":  mimeType,
      "Cache-Control": "no-cache",
      // CORS strikt auf localhost beschränken
      "Access-Control-Allow-Origin": origin || "http://127.0.0.1",
      "Access-Control-Allow-Methods": "GET, HEAD",
      "Access-Control-Allow-Headers": "Origin"
    });

    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(content);
    }
  }
}

// Singleton
const pluginHttpServer = new PluginHttpServer();
module.exports = pluginHttpServer;
module.exports.PluginHttpServer = PluginHttpServer;
