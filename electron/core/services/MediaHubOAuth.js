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

const OAUTH_PAGE_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
const OAUTH_DETAIL_FALLBACK = "Anmeldung fehlgeschlagen.";
const OAUTH_DETAIL_MAX = 300;
const OAUTH_PAGES = {
  success: {
    title: "Erfolgreich verbunden",
    message: "MediaHub wurde erfolgreich mit deinem Konto verbunden.",
    hint: "Du kannst dieses Fenster jetzt schließen."
  },
  failure: {
    title: "Verbindung fehlgeschlagen",
    message: "MediaHub konnte nicht mit deinem Konto verbunden werden.",
    hint: "Du kannst dieses Fenster jetzt schließen und es erneut versuchen."
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

function sanitizeOauthDetail(value) {
  if (!value) return "";
  let cleaned = "";
  for (const character of String(value)) {
    const code = character.codePointAt(0);
    cleaned += (code < 0x20 || code === 0x7f) ? " " : character;
  }
  return cleaned.replace(/\s+/g, " ").trim().slice(0, OAUTH_DETAIL_MAX);
}

function writeOauthPage(response, statusCode, variant, detail) {
  const page = OAUTH_PAGES[variant] || OAUTH_PAGES.failure;
  const success = variant === "success";
  const badge = success
    ? '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M5 12.6l4.6 4.6L19.2 7.6" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M7.4 7.4l9.2 9.2M16.6 7.4l-9.2 9.2" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/></svg>';
  const detailMarkup = success ? "" : `\n<p class="detail">${escapeHtml(sanitizeOauthDetail(detail) || OAUTH_DETAIL_FALLBACK)}</p>`;
  const tone = success ? "success" : "error";

  response.writeHead(statusCode, OAUTH_PAGE_HEADERS);
  response.end(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>MediaHub \u2013 ${page.title}</title>
<style>
:root{color-scheme:dark;
--bg:#0f1115;--surface:rgba(35,40,52,.72);--surface-deep:rgba(22,25,33,.94);
--text:#e2e8f0;--muted:#94a3b8;--border:rgba(255,255,255,.08);}
*,*::before,*::after{box-sizing:border-box;}
html,body{height:100%;}
body{margin:0;padding:24px 16px;min-height:100%;display:flex;align-items:center;justify-content:center;
overflow:auto;color:var(--text);
font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
-webkit-font-smoothing:antialiased;
background:radial-gradient(1000px 520px at 50% -25%,rgba(99,102,241,.16),transparent 62%),
radial-gradient(760px 420px at 50% 125%,rgba(34,197,94,.07),transparent 62%),var(--bg);}
.page{width:100%;display:flex;align-items:center;justify-content:center;}
.card{width:100%;max-width:380px;padding:32px 28px 26px;text-align:center;
background:linear-gradient(180deg,var(--surface),var(--surface-deep));
border:1px solid var(--border);border-radius:16px;
box-shadow:0 24px 48px rgba(0,0,0,.45);}
.brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:24px;}
.brand__mark{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;
color:#a5b4fc;border:1px solid rgba(99,102,241,.35);
background:linear-gradient(145deg,rgba(99,102,241,.28),rgba(99,102,241,.10));}
.brand__label{font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);}
.status{display:grid;place-items:center;width:76px;height:76px;border-radius:50%;margin:0 auto 22px;}
.status--success{background:linear-gradient(160deg,#34d399,#16a34a);
box-shadow:0 12px 28px rgba(22,163,74,.38),0 0 0 8px rgba(34,197,94,.10);}
.status--error{background:linear-gradient(160deg,#f87171,#dc2626);
box-shadow:0 12px 28px rgba(220,38,38,.34),0 0 0 8px rgba(239,68,68,.10);}
.title{margin:0 0 10px;font-size:20px;font-weight:650;line-height:1.3;letter-spacing:-.01em;}
.message{margin:0;color:var(--muted);font-size:14.5px;}
.detail{margin:16px 0 0;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.45;
word-break:break-word;color:#fca5a5;background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.28);}
.hint{margin:22px 0 0;padding-top:16px;border-top:1px solid var(--border);font-size:13.5px;color:var(--muted);}
@media (max-width:400px){body{padding:16px 12px;}.card{padding:26px 20px 22px;}
.status{width:64px;height:64px;}.title{font-size:18px;}}
@media (max-height:520px){body{padding:14px;}.card{padding:22px 20px 18px;}
.brand{margin-bottom:16px;}.brand__mark{width:38px;height:38px;}
.status{width:60px;height:60px;margin-bottom:16px;}.hint{margin-top:16px;padding-top:12px;}}
</style>
</head>
<body>
<main class="page">
<section class="card" role="${success ? "status" : "alert"}" aria-live="polite">
<div class="brand">
<span class="brand__mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5.6v12.8L18.4 12z" fill="currentColor"/></svg></span>
<span class="brand__label">MediaHub</span>
</div>
<div class="status status--${tone}" aria-hidden="true">${badge}</div>
<h1 class="title">${page.title}</h1>
<p class="message">${page.message}</p>${detailMarkup}
<p class="hint">${page.hint}</p>
</section>
</main>
</body>
</html>`);
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
      const code = valid ? url.searchParams.get("code") : null;
      const reportedError = valid
        ? (url.searchParams.get("error_description") || (url.searchParams.get("error") ? `Fehler: ${url.searchParams.get("error")}` : ""))
        : "";
      const detail = reportedError || (valid ? "Google hat keinen Anmeldecode geliefert." : OAUTH_DETAIL_FALLBACK);
      writeOauthPage(response, code ? 200 : 400, code ? "success" : "failure", detail);
      clearTimeout(timeout);
      valid ? resolve(code) : reject(new Error("Ungültige OAuth-Antwort."));
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
