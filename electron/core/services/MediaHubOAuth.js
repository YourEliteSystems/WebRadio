"use strict";

// Add this file to electron/core/services/MediaHubOAuth.js.
// This service keeps Google tokens out of the renderer process.
const { app, shell } = require("electron");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const LogManager = require("../diagnostics/logging/LogManager");

const logger = LogManager.getLogger("MediaHubOAuth");

const CLIENT_ID = "628381290989-lg85lho3becjlmn38s6hgka36f8ohggh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const TOKEN_FILE = () => path.join(app.getPath("userData"), "plugin-data", "mediahub-oauth.json");

function base64url(value) {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function read() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE(), "utf8")); } catch { return null; }
}
function write(tokens) {
  const file = TOKEN_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}
async function post(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params)
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error_description || "Google-Anmeldung fehlgeschlagen.");
  return json;
}
async function accessToken() {
  const tokens = read();
  if (!tokens) throw new Error("Nicht mit Google angemeldet.");
  if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new Error("Die Google-Anmeldung ist abgelaufen. Bitte erneut anmelden.");

  const fresh = await post({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken
  });
  const next = { ...tokens, accessToken: fresh.access_token, expiresAt: Date.now() + fresh.expires_in * 1000 };
  write(next); return next.accessToken;
}
async function signIn() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(24));
  const server = http.createServer();
  const callback = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}/oauth2/callback`));
  });
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Anmeldung abgebrochen oder zeitlich abgelaufen.")), 5 * 60_000);
    server.once("request", (request, response) => {
      const url = new URL(request.url, callback);
      const valid = url.pathname === "/oauth2/callback" && url.searchParams.get("state") === state;
      response.writeHead(valid ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
      response.end(valid ? "<h2>MediaHub ist verbunden.</h2><p>Dieses Fenster kann geschlossen werden.</p>" : "<h2>Anmeldung fehlgeschlagen.</h2>");
      clearTimeout(timeout);
      valid ? resolve(url.searchParams.get("code")) : reject(new Error("Ungültige OAuth-Antwort."));
    });
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: callback, response_type: "code", scope: SCOPE, state, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent" });
    shell.openExternal(authorize.toString());
  }).finally(() => server.close());
  if (!code) throw new Error("Google hat keinen Anmeldecode geliefert.");

  const token = await post({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: callback
  });
  write({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 });
  return { connected: true };
}
async function search(query) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", maxResults: "12", q: query });
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "YouTube-Suche fehlgeschlagen.");
  return (payload?.items || []).map(item => ({ id: item.id.videoId, title: item.snippet.title, channel: item.snippet.channelTitle, publishedAt: item.snippet.publishedAt, thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url })).filter(item => item.id);
}
module.exports = { signIn, search, status: () => ({ connected: Boolean(read()) }), signOut: () => { try { fs.unlinkSync(TOKEN_FILE()); } catch (e) {
    // Ignore errors if file doesn't exist
} return { connected: false }; } };
