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
    if (originHeader) {
      const urlPath = req.url.split("?")[0];
      const match = urlPath.match(/^\/plugins\/([^/]+)\//);
      const pluginId = match ? match[1] : null;

      if (pluginId) {
        const originCheck = this.canAccessOrigin(pluginId, originHeader);
        if (!originCheck.allowed) {
          logger.warn(`Origin nicht erlaubt: ${originHeader} für Plugin ${pluginId}`);
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: Invalid Origin");
          return;
        }
      } else {
        if (originHeader !== "http://127.0.0.1" && originHeader !== "http://localhost") {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden: Invalid Origin");
          return;
        }
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

    let corsOrigin = originHeader || "http://127.0.0.1";

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