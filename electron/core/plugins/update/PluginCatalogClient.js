"use strict";

/**
 * PluginCatalogClient
 *
 * Zugriff auf die einzige derzeit öffentlich dokumentierte Website-Schnittstelle:
 *
 *   GET /api/plugins?page=N
 *   -> { data: [{ id, slug, name, description, developerName, tags,
 *                 downloads, latestVersion, updatedAt }],
 *        pagination: { page, pageSize, hasNext } }
 *
 * Die Route liefert ausschließlich veröffentlichte und freigegebene Plugins
 * (`isPublished=true` UND `status=APPROVED`, Filter im Datenlayer der Website).
 * Weitere Felder (Manifest-URL, Kanäle, Changelog, Download-URL,
 * Kompatibilität) existieren dort nicht und werden deshalb auch nicht
 * angenommen – sie stammen aus dem Update-Manifest des Entwicklers.
 */

const DEFAULT_BASE_URL = "https://webradio-weld.vercel.app";
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 12000;

class PluginCatalogClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : DEFAULT_TTL_MS;
    this.now = options.now || (() => Date.now());
    this.cache = null;
    this.cacheAt = 0;
    this.lastError = null;
  }

  _isFresh() {
    if (!this.cache) return false;
    const ttl = this.cache.length > 0 ? this.ttlMs : NEGATIVE_TTL_MS;
    return this.now() - this.cacheAt < ttl;
  }

  /**
   * @param {{force?:boolean}} [options]
   * @returns {Promise<{ok:boolean, entries:Array, fetchedAt:number|null, error?:{code:string,message:string}}>}
   */
  async getPublished(options = {}) {
    if (!options.force && this._isFresh()) {
      return { ok: this.cache !== null, entries: this.cache || [], fetchedAt: this.cacheAt, error: this.lastError };
    }
    if (typeof this.fetchImpl !== "function") {
      return { ok: false, entries: [], fetchedAt: null, error: { code: "catalog_unavailable", message: "Keine Netzwerkfunktion verfügbar." } };
    }

    const entries = [];
    const seen = new Set();
    let page = 1;

    try {
      for (; page <= MAX_PAGES; page += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let response;
        try {
          response = await this.fetchImpl(`${this.baseUrl}/api/plugins?page=${page}`, {
            headers: { Accept: "application/json" },
            signal: controller.signal
          });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          throw Object.assign(new Error(`HTTP ${response.status}`), { code: "catalog_unavailable" });
        }
        const body = await response.json();
        if (!body || !Array.isArray(body.data)) {
          throw Object.assign(new Error("Unerwartetes Antwortformat."), { code: "catalog_invalid_response" });
        }

        for (const item of body.data) {
          if (!item || typeof item.slug !== "string" || typeof item.name !== "string") continue;
          const key = item.slug.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          entries.push({
            id: typeof item.id === "string" ? item.id : null,
            slug: item.slug,
            name: item.name,
            description: typeof item.description === "string" ? item.description : "",
            developerName: typeof item.developerName === "string" ? item.developerName : "",
            latestVersion: typeof item.latestVersion === "string" ? item.latestVersion : null,
            updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
            downloads: Number.isFinite(item.downloads) ? item.downloads : 0
          });
        }

        if (!body.pagination || body.pagination.hasNext !== true) break;
      }
    } catch (error) {
      const failure = {
        code: error.code === "catalog_invalid_response" ? "catalog_invalid_response" : "catalog_unavailable",
        message: error.code === "catalog_invalid_response"
          ? "Der Plugin-Katalog lieferte ein unerwartetes Format."
          : "Der Plugin-Katalog ist nicht erreichbar."
      };
      this.cache = null;
      this.cacheAt = this.now();
      this.lastError = failure;
      return { ok: false, entries: [], fetchedAt: null, error: failure };
    }

    this.cache = entries;
    this.cacheAt = this.now();
    this.lastError = null;
    return { ok: true, entries, fetchedAt: this.cacheAt };
  }

  /**
   * Sucht einen Katalog-Eintrag zu einer Plugin-ID. Die Website verwendet
   * `slug`; die Plugin-ID der Desktop-App ist identisch mit dem Slug, solange
   * Entwickler die ID nicht ändern (dokumentierte Anforderung).
   */
  async find(pluginId, options = {}) {
    const catalog = await this.getPublished(options);
    if (!catalog.ok) return { entry: null, catalog };
    const needle = String(pluginId || "").toLowerCase();
    const entry = catalog.entries.find((item) =>
      item.slug.toLowerCase() === needle || (item.id && item.id.toLowerCase() === needle)
    ) || null;
    return { entry, catalog };
  }

  invalidate() {
    this.cache = null;
    this.cacheAt = 0;
  }
}

module.exports = PluginCatalogClient;
module.exports.DEFAULT_BASE_URL = DEFAULT_BASE_URL;
