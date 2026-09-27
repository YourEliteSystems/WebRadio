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
      this._server.listen(0, "127.0.0.1", () => {
        this._port = this._server.address().port;
        logger.info(`PluginHttpServer gestartet auf http://127.0.0.1:${this._port}`);
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
    return `http://127.0.0.1:${this._port}`;
  }

  getPort() {
    return this._port;
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
    return `http://127.0.0.1:${this._port}/plugins/${pluginId}/${normalised}`;
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

  _handleRequest(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const originHeader = req.headers.origin;
    const clientOrigin = originHeader || null;

    // -- Origin-Policy (spezifisch für den lokalen Plugin-HTTP-Server) --
    // Der Renderer läuft meist aus einem file://-Kontext. Dessen "Origin"
    // ist dann "null" bzw. ein fehlender Origin-Header. Wir identifizieren
    // die lokale file://-Renderer-Sitzung über die Loopback-Quelle.
    //  - Origin / file://-Origin vorhanden:
    //      Nur im lokalen Plugin-Ressourcen-Kontext zulassen (s.u. capability-basierter
    //      Origin-Check über canAccessOrigin). Fehler → 403.
    //  - Kein Origin / file:// / null:
    //      Lokale Plugin-Ressourcen erlauben (CORS-Origin „*“). Das ist der
    //      Loopback-getriebene Browser-Renderer-Kontext und wird niemals von
    //      einem fremden Web oder Drittsystem aus genutzt.
    if (clientOrigin !== null && clientOrigin !== "null" && clientOrigin !== "file://") {
      const urlPath = req.url.split("?")[0];
      const match = urlPath.match(/^\/plugins\/([^/]+)\//);
      const pluginId = match ? match[1] : null;

      if (pluginId) {
        const originCheck = this.canAccessOrigin(pluginId, clientOrigin);
        if (!originCheck.allowed) {
          logger.warn(`Origin nicht erlaubt: ${clientOrigin} für Plugin ${pluginId}`);
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: Invalid Origin");
          return;
        }
      } else {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden: Invalid Origin");
        return;
      }
    }

    const urlPath = req.url.split("?")[0];
    const match   = urlPath.match(/^\/plugins\/([^/]+)\/(.+)$/);

    if (!match) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const [, pluginId, relativePath] = match;
    const pluginEntry = this._plugins.get(pluginId);

    if (!pluginEntry) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Plugin "${pluginId}" nicht registriert`);
      return;
    }

    const pluginRoot = pluginEntry.root;

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

    const ext      = path.extname(absolute).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    const content = fs.readFileSync(absolute);

    // CORS-Origin-Regel für den lokalen Plugin-HTTP-Server:
    //  - Origin vorhanden: validierten Origin zurückgeben (capability-basierten
    //    Origin-Check wurde oben (canAccessOrigin) schon durchlaufen).
    //  - Origin fehlt (file://-Renderer / local loopback): lokale Plugin-Ressourcen
    //    mit Access-Control-Allow-Origin: * ausliefern. Das verhindert,
    //    dass der file://-Kontext vom CORS-Filter blockiert wird.
    let corsOrigin = originHeader || "*";

    res.writeHead(200, {
      "Content-Type":  mimeType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": corsOrigin,
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

const pluginHttpServer = new PluginHttpServer();
module.exports = pluginHttpServer;
module.exports.PluginHttpServer = PluginHttpServer;