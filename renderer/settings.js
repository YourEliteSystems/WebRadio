// ── Window Controls ──────────────────────────────────────────
document.getElementById("btnMinimize").addEventListener("click", () => window.windowControls.minimize());
document.getElementById("btnMaximize").addEventListener("click", () => window.windowControls.maximize());
document.getElementById("btnClose").addEventListener("click", () => window.windowControls.close());

// ── Integrationen ─────────────────────────────────────────────
async function loadIntegrations() {
  if (!window.integrationsAPI) return;

  const integrations = await window.integrationsAPI.get();
  const toggle = document.getElementById("discordRpcToggle");
  if (toggle) {
    toggle.checked = integrations.discordRichPresence === true;
  }
}

async function saveIntegrations() {
  if (!window.integrationsAPI) return;

  const toggle = document.getElementById("discordRpcToggle");
  const discordRichPresence = toggle ? toggle.checked : false;

  await window.integrationsAPI.update({ discordRichPresence });
}

document.getElementById("discordRpcToggle")?.addEventListener("change", () => saveIntegrations());

// Integrationen beim Laden initialisieren
loadIntegrations();

// ── Sidebar Navigation ───────────────────────────────────────
const navItems = document.querySelectorAll(".settings-nav-item");
const pages    = document.querySelectorAll(".settings-page");

navItems.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.page;
    navItems.forEach(n => n.classList.remove("active"));
    pages.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`page-${target}`)?.classList.add("active");
  });
});

// ── Theme (aus Hauptfenster übernehmen) ───────────────────────
async function applyActiveTheme() {
  if (!window.themeAPI) return;
  const [themes, activeId] = await Promise.all([
    window.themeAPI.getThemes(),
    window.themeAPI.getActiveTheme()
  ]);
  const found = themes.find(t => t.id === activeId) || themes[0];
  if (found?.css) {
    const link = document.getElementById("theme-style");
    const url = found.css.startsWith("file://") ? found.css : "file:///" + found.css.replace(/\\/g, "/");
    if (link) link.href = url;
  }
}
applyActiveTheme();

// Theme-Änderungen von anderen Fenstern empfangen
if (window.themeAPI?.onThemeChanged) {
  window.themeAPI.onThemeChanged((data) => {
    if (data?.css) {
      const link = document.getElementById("theme-style");
      const url = data.css.startsWith("file://") ? data.css : "file:///" + data.css.replace(/\\/g, "/");
      if (link) link.href = url;
      
      // Theme-Karten aktualisieren
      loadThemes();
    }
  });
}

// ── Plugins ───────────────────────────────────────────────────
async function loadPlugins() {
  const plugins = await window.api.getPlugins();
  const list = document.getElementById("pluginList");
  list.innerHTML = "";

  if (plugins.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px 0;">Keine Plugins gefunden</p>`;
    return;
  }

  plugins.forEach(p => {
    const item = document.createElement("div");
    item.className = "plugin-item";
    item.innerHTML = `
      <div class="plugin-item-info">
        <span class="plugin-item-name">${p.name}</span>
      </div>
      <label class="toggle-wrap" title="${p.enabled ? 'Deaktivieren' : 'Aktivieren'}">
        <input type="checkbox" ${p.enabled ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    `;
    const toggle = item.querySelector("input");
    toggle.addEventListener("change", () => {
      window.api.togglePlugin(p.id, toggle.checked);
    });
    list.appendChild(item);
  });
}

const reloadPluginsBtn = document.getElementById("reloadPluginsBtn");
if (reloadPluginsBtn) {
  reloadPluginsBtn.addEventListener("click", async () => {
    reloadPluginsBtn.disabled = true;
    const originalLabel = reloadPluginsBtn.textContent;
    reloadPluginsBtn.textContent = "↺ Rescan läuft…";
    try {
      if (window.api?.reloadPlugins) {
        await window.api.reloadPlugins();
      }
    } catch (err) {
      console.error("[Plugins] Reload fehlgeschlagen:", err);
    } finally {
      reloadPluginsBtn.disabled = false;
      reloadPluginsBtn.textContent = originalLabel;
      await loadPlugins();
    }
  });
}

// Auf globale Plugin-Änderungen reagieren (z. B. Rescan via IPC,
// anderer Renderer oder Hotkey) – Liste automatisch aktualisieren.
if (window.api?.onPluginsChanged) {
  window.api.onPluginsChanged(() => {
    loadPlugins();
  });
}

loadPlugins();

// ── Themes ────────────────────────────────────────────────────
async function loadThemes() {
  if (!window.themeAPI?.getThemes) return;

  const [themes, activeId] = await Promise.all([
    window.themeAPI.getThemes(),
    window.themeAPI.getActiveTheme()
  ]);

  const grid = document.getElementById("themeList");
  grid.innerHTML = "";

  themes.forEach(t => {
    const card = document.createElement("div");
    card.className = "theme-card" + (activeId === t.id ? " active" : "");
    card.innerHTML = `<div class="theme-dot"></div><span>${t.name}</span>`;
    card.addEventListener("click", () => {
      // Theme aktivieren
      window.themeAPI.setActiveTheme(t.id);
      const url = t.css.startsWith("file://") ? t.css : "file:///" + t.css.replace(/\\/g, "/");
      const link = document.getElementById("theme-style");
      if (link) link.href = url;
      // Active-State aktualisieren
      document.querySelectorAll(".theme-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
    });
    grid.appendChild(card);
  });
}

document.getElementById("reloadThemesBtn").addEventListener("click", () => loadThemes());
loadThemes();

// ── Updates ───────────────────────────────────────────────────
// Erweitert um Stable/Beta-Channel, Beta-Warnung, sichere
// Markdown-Darstellung der Release Notes, Download-Progress
// und "Jetzt neu starten"-Bestätigung.
const updateIcon      = document.getElementById("updateIcon");
const updateTitle     = document.getElementById("updateStatusTitle");
const updateSub       = document.getElementById("updateStatusSub");
const releaseWrap     = document.getElementById("releaseNotesWrap");
const releaseNotes    = document.getElementById("releaseNotes");
const installBtn      = document.getElementById("installUpdateBtn");
const checkBtn        = document.getElementById("checkUpdateBtn");
const installNowBtn   = document.getElementById("installNowBtn");
const downloadedWrap  = document.getElementById("downloadedWrap");
const downloadedMsg   = document.getElementById("downloadedMessage");
const progressWrap    = document.getElementById("downloadProgressWrap");
const progressBar     = document.getElementById("downloadProgressBar");
const progressPercent = document.getElementById("downloadProgressPercent");
const progressBytes   = document.getElementById("downloadProgressBytes");
const progressLabel   = document.getElementById("downloadProgressLabel");
const navDot          = document.getElementById("nav-update-dot");
const currentVerEl    = document.getElementById("currentVersion");
const currentVerBadge = document.getElementById("currentVersionBadge");
const channelBadge    = document.getElementById("channelBadge");
const betaHint        = document.getElementById("betaHint");
const channelStable   = document.getElementById("channelStable");
const channelBeta     = document.getElementById("channelBeta");
const channelOptions  = document.querySelectorAll(".channel-option");
const betaModal       = document.getElementById("betaWarningModal");
const betaCancel      = document.getElementById("betaWarningCancel");
const betaConfirm     = document.getElementById("betaWarningConfirm");
const dismissBtn      = document.getElementById("dismissUpdateBtn");
const restartLaterBtn = document.getElementById("restartLaterBtn");
const autoCheckInput  = document.getElementById("autoCheckOnStart");

let activeUpdate = null;
let lastChannel  = null;
let pendingChannel = null;
let cleanupListeners = [];

// ── Helpers ──────────────────────────────────────────────
function formatBytes(n) {
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

// Sehr leichte Markdown -> HTML-Sanitization für die UI-Anzeige.
// Bewusst nur die wichtigsten Konstrukte, ohne externe Lib.
function renderMarkdown(md) {
  if (!md) return "";
  const esc = (s) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  let html = esc(md);

  // Code-Blöcke ```...```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre style="background:rgba(0,0,0,0.4); padding:8px 10px; border-radius:6px; overflow:auto; font-size:12px;"><code>${code.trim()}</code></pre>`
  );
  // Inline-Code
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Headers (##, ###, ####)
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
  // Bold **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Lists (Bullet-Points)
  html = html.replace(/(^|\n)((?:- .*(?:\n|$))+)/g, (_, pre, block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^- /, "").trim())
      .filter(Boolean)
      .map((l) => `<li>${l}</li>`)
      .join("");
    return `${pre}<ul style="margin:6px 0 6px 18px; padding:0;">${items}</ul>`;
  });
  // Newlines
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

// ── Version & Channel anzeigen ────────────────────────────
async function renderCurrentVersion() {
  try {
    if (window.updatesAPI?.getCurrentVersion) {
      const info = await window.updatesAPI.getCurrentVersion();
      if (info?.ok) {
        const label = `v${info.version}`;
        if (currentVerEl) currentVerEl.textContent = label;
        const aboutVerEl = document.getElementById("currentVersionAbout");
        if (aboutVerEl) aboutVerEl.textContent = label;
        if (currentVerBadge) {
          if (info.isPrerelease) {
            currentVerBadge.textContent = "BETA";
            currentVerBadge.className = "channel-badge beta";
            currentVerBadge.style.display = "inline-block";
          } else {
            currentVerBadge.style.display = "none";
          }
        }
        if (channelBadge) {
          const isBeta = info.channel === "beta";
          channelBadge.textContent = isBeta ? "Beta" : "Stable";
          channelBadge.className = `channel-badge ${isBeta ? "beta" : "stable"}`;
          channelBadge.style.display = "inline-block";
        }
        return info;
      }
    } else if (window.updaterAPI?.getVersion) {
      const v = await window.updaterAPI.getVersion();
      const label = `v${v}`;
      if (currentVerEl) currentVerEl.textContent = label;
      const aboutVerEl = document.getElementById("currentVersionAbout");
      if (aboutVerEl) aboutVerEl.textContent = label;
      return { ok: true, version: v, isPrerelease: /-(beta|rc|alpha|nightly)/i.test(String(v)), channel: lastChannel || "stable" };
    }
  } catch (e) {
    console.error("renderCurrentVersion:", e);
  }
  return null;
}

// ── UI-State Renderer ────────────────────────────────────
function setStatusView(state, data = {}) {
  if (!updateIcon) return;
  updateIcon.className = `update-status-icon ${state}`;

  // Default: alles ausblenden
  if (releaseWrap) releaseWrap.style.display = "none";
  if (installBtn) installBtn.style.display = "none";
  if (dismissBtn) dismissBtn.style.display = "none";
  if (downloadedWrap) downloadedWrap.style.display = "none";
  if (progressWrap) progressWrap.style.display = "none";

  if (state === "checking") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></svg>`;
    updateTitle.textContent = "Prüfe auf Updates…";
    updateSub.textContent = "Verbindung zum Update-Server wird hergestellt";
  } else if (state === "current" || state === "up-to-date") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>`;
    updateTitle.textContent = "Du bist aktuell";
    const v = (activeUpdate && activeUpdate.currentVersion) || data.version || (currentVerEl ? currentVerEl.textContent : "");
    updateSub.textContent = `${v ? v : "WebRadio"} ist die neueste Version`;
  } else if (state === "available" || state === "downloading") {
    const isBeta = (data.channel || activeUpdate?.channel) === "beta";
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" /></svg>`;
    updateTitle.textContent = isBeta
      ? `Beta-Update verfügbar – v${data.version}`
      : `Update verfügbar – v${data.version}`;
    if (isBeta) {
      updateSub.innerHTML = "Hinweis: Beta-Version – kann Fehler enthalten.";
    } else {
      updateSub.textContent = "Eine neue Version ist bereit zum Herunterladen";
    }
    if (data.releaseNotes && releaseNotes) {
      releaseWrap.style.display = "block";
      releaseNotes.innerHTML = renderMarkdown(data.releaseNotes);
    }
    if (state === "available") {
      installBtn.style.display = "inline-flex";
      if (dismissBtn) dismissBtn.style.display = "inline-flex";
    }
    if (state === "downloading" && progressWrap) {
      progressWrap.style.display = "block";
    }
    if (navDot) navDot.style.display = "block";
  } else if (state === "downloaded") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>`;
    updateTitle.textContent = `Update bereit – v${data.version}`;
    updateSub.textContent = "Das Update ist heruntergeladen und wartet auf Installation";
    if (data.releaseNotes && releaseNotes) {
      releaseWrap.style.display = "block";
      releaseNotes.innerHTML = renderMarkdown(data.releaseNotes);
    }
    if (downloadedWrap) {
      downloadedWrap.style.display = "block";
      if (downloadedMsg) {
        downloadedMsg.textContent = data.version
          ? `WebRadio ${data.version} wurde erfolgreich heruntergeladen. Das Update wird installiert, sobald WebRadio neu gestartet wird.`
          : "Das Update wird installiert, sobald WebRadio neu gestartet wird.";
      }
    }
    if (navDot) navDot.style.display = "block";
  } else if (state === "error") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>`;
    updateTitle.textContent = "Update konnte nicht geprüft werden";
    updateSub.textContent = "Bitte überprüfe deine Internetverbindung und versuche es später erneut.";
  } else if (state === "idle") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`;
    updateTitle.textContent = "Bereit";
    updateSub.textContent = "Klicke auf „Jetzt prüfen“, um nach Updates zu suchen";
  }
}

function applyStateToUI(state) {
  if (!state) return;
  activeUpdate = state;
  // Wenn der State noch ein Default-Idle ist, zeigen wir den Hinweis-Status.
  const map = {
    idle: "idle",
    checking: "checking",
    available: "available",
    downloading: "downloading",
    downloaded: "downloaded",
    "not-available": "current",
    "up-to-date": "current",
    error: "error",
    installing: "downloaded"
  };
  const view = map[state.status] || "idle";
  setStatusView(view, {
    version: state.availableVersion,
    channel: state.channel,
    releaseNotes: state.releaseNotes
  });
}

function applyProgress(progress) {
  if (!progressWrap) return;
  if (!progress) {
    progressWrap.style.display = "none";
    return;
  }
  progressWrap.style.display = "block";
  const percent = Math.round((progress.progress || 0) * 100);
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressBytes) {
    const tr = formatBytes(progress.transferred);
    const tot = formatBytes(progress.total);
    const speed = progress.bytesPerSecond
      ? `${formatBytes(progress.bytesPerSecond)}/s`
      : "";
    progressBytes.textContent = [tr, tot].filter(Boolean).join(" / ")
      + (speed ? `  •  ${speed}` : "");
  }
  if (progressLabel && activeUpdate?.availableVersion) {
    progressLabel.textContent = `Wird heruntergeladen – v${activeUpdate.availableVersion}`;
  }
}

// ── Channel-Auswahl ──────────────────────────────────────
function setChannelSelection(channel) {
  if (channelStable) channelStable.checked = channel === "stable";
  if (channelBeta)   channelBeta.checked   = channel === "beta";
  channelOptions.forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.channel === channel);
  });
  if (betaHint) {
    betaHint.style.display = channel === "beta" ? "flex" : "none";
  }
}

async function loadChannel() {
  if (window.updatesAPI?.getChannel) {
    const res = await window.updatesAPI.getChannel();
    if (res?.ok) {
      lastChannel = res.channel;
      setChannelSelection(res.channel);
      return res.channel;
    }
  }
  setChannelSelection("stable");
  return "stable";
}

async function applyChannelChange(newChannel, { skipConfirm } = {}) {
  if (newChannel !== "stable" && newChannel !== "beta") return;
  if (newChannel === lastChannel) {
    setChannelSelection(newChannel);
    return;
  }

  // Beim Wechsel auf Beta: Bestätigung verlangen
  if (newChannel === "beta" && !skipConfirm) {
    pendingChannel = "beta";
    if (betaModal) betaModal.classList.add("open");
    return;
  }

  await commitChannelChange(newChannel);
}

async function commitChannelChange(newChannel) {
  if (!window.updatesAPI?.setChannel) return;
  const res = await window.updatesAPI.setChannel(newChannel);
  if (res?.ok) {
    lastChannel = newChannel;
    setChannelSelection(newChannel);
    // Nach Channel-Wechsel neuen Check anstoßen
    runUpdateCheck();
  } else {
    // zurücksetzen
    setChannelSelection(lastChannel || "stable");
  }
}

channelOptions.forEach((opt) => {
  opt.addEventListener("click", (ev) => {
    // Radio selbst klickt auch, aber wir wollen das Event konsolidieren
    const target = opt.querySelector("input");
    if (target) target.checked = true;
    applyChannelChange(opt.dataset.channel);
  });
});

if (betaCancel) {
  betaCancel.addEventListener("click", () => {
    if (betaModal) betaModal.classList.remove("open");
    pendingChannel = null;
    setChannelSelection(lastChannel || "stable");
  });
}
if (betaConfirm) {
  betaConfirm.addEventListener("click", async () => {
    if (betaModal) betaModal.classList.remove("open");
    await commitChannelChange("beta");
    pendingChannel = null;
  });
}
if (betaModal) {
  betaModal.addEventListener("click", (e) => {
    if (e.target === betaModal) {
      betaModal.classList.remove("open");
      pendingChannel = null;
      setChannelSelection(lastChannel || "stable");
    }
  });
}

// ── Initialer Check + Button-Handler ─────────────────────
async function runUpdateCheck() {
  setStatusView("checking");
  if (window.updatesAPI?.check) {
    const res = await window.updatesAPI.check();
    if (!res?.ok) {
      setStatusView("error");
      return;
    }
    const r = res.result;
    if (r && r.status === "available") {
      activeUpdate = { ...(activeUpdate || {}), ...r };
      setStatusView("available", r);
    } else if (r && r.status === "error") {
      setStatusView("error");
    } else {
      setStatusView("current", r || {});
    }
  } else if (window.updaterAPI?.check) {
    // Fallback: alte API
    const result = await window.updaterAPI.check();
    if (result?.available) {
      setStatusView("available", result);
    } else {
      setStatusView("current", result || {});
    }
  } else {
    setStatusView("error");
  }
}

if (checkBtn) {
  checkBtn.addEventListener("click", () => runUpdateCheck());
}

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    installBtn.disabled = true;
    const originalLabel = installBtn.textContent;
    installBtn.textContent = "Download startet…";
    try {
      if (window.updatesAPI?.download) {
        await window.updatesAPI.download();
      } else if (window.updaterAPI?.install) {
        // Legacy-Pfad
        await window.updaterAPI.install();
      }
    } catch (err) {
      console.error("install:", err);
    } finally {
      installBtn.textContent = originalLabel;
      installBtn.disabled = false;
    }
  });
}

if (dismissBtn) {
  dismissBtn.addEventListener("click", async () => {
    try {
      if (window.api?.updates?.dismissLater) {
        await window.api.updates.dismissLater();
      } else if (window.updatesAPI?.dismissLater) {
        await window.updatesAPI.dismissLater();
      }
    } catch { /* ignore */ }
    setStatusView("idle");
  });
}

if (restartLaterBtn) {
  restartLaterBtn.addEventListener("click", () => {
    if (downloadedWrap) downloadedWrap.style.display = "none";
    if (updateTitle) updateTitle.textContent = "Update bereit für nächsten Start";
    if (updateSub) updateSub.textContent = "Das Update wird beim nächsten regulären Neustart installiert.";
  });
}

async function loadAutoCheckSetting() {
  if (!autoCheckInput) return;
  try {
    if (window.api?.updates?.getAutoCheck) {
      const res = await window.api.updates.getAutoCheck();
      if (res?.ok) autoCheckInput.checked = !!res.enabled;
    } else if (window.updatesAPI?.getAutoCheck) {
      const res = await window.updatesAPI.getAutoCheck();
      if (res?.ok) autoCheckInput.checked = !!res.enabled;
    }
  } catch { /* ignore */ }
}

if (autoCheckInput) {
  autoCheckInput.addEventListener("change", async () => {
    try {
      if (window.api?.updates?.setAutoCheck) {
        await window.api.updates.setAutoCheck(autoCheckInput.checked);
      } else if (window.updatesAPI?.setAutoCheck) {
        await window.updatesAPI.setAutoCheck(autoCheckInput.checked);
      }
    } catch { /* ignore */ }
  });
}

if (installNowBtn) {
  installNowBtn.addEventListener("click", async () => {
    installNowBtn.disabled = true;
    if (window.updatesAPI?.install) {
      await window.updatesAPI.install();
    } else if (window.updaterAPI?.install) {
      await window.updaterAPI.install();
    }
  });
}

// ── Initial: State laden + Event-Listener registrieren ───
async function initUpdatesUI() {
  // Cleanup vorheriger Listener (z.B. bei Re-Init)
  cleanupListeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
  cleanupListeners = [];

  await renderCurrentVersion();
  await loadChannel();
  await loadAutoCheckSetting();
  // Initialer UI-Status: aus dem Main-Prozess lesen
  if (window.updatesAPI?.getState) {
    const res = await window.updatesAPI.getState();
    if (res?.ok && res.state) {
      applyStateToUI(res.state);
    } else {
      setStatusView("idle");
    }
  } else {
    setStatusView("idle");
  }

  // Live-Events registrieren
  if (window.updatesAPI?.onStateChanged) {
    const off = window.updatesAPI.onStateChanged((s) => {
      applyStateToUI(s);
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onAvailable) {
    const off = window.updatesAPI.onAvailable((data) => {
      activeUpdate = { ...(activeUpdate || {}), ...data, available: true };
      setStatusView("available", data);
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onNotAvailable) {
    const off = window.updatesAPI.onNotAvailable(() => {
      setStatusView("current", {});
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onProgress) {
    const off = window.updatesAPI.onProgress((p) => {
      applyProgress(p);
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onDownloaded) {
    const off = window.updatesAPI.onDownloaded((data) => {
      activeUpdate = { ...(activeUpdate || {}), ...data, downloaded: true };
      setStatusView("downloaded", data);
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onError) {
    const off = window.updatesAPI.onError(() => {
      setStatusView("error");
    });
    cleanupListeners.push(off);
  }
  if (window.updatesAPI?.onChannelChanged) {
    const off = window.updatesAPI.onChannelChanged((data) => {
      if (data?.channel) {
        lastChannel = data.channel;
        setChannelSelection(data.channel);
      }
    });
    cleanupListeners.push(off);
  }

  // Legacy: existing updaterAPI.onUpdateAvailable
  if (!window.updatesAPI && window.updaterAPI?.onUpdateAvailable) {
    window.updaterAPI.onUpdateAvailable((info) => {
      setStatusView("available", info);
      if (navDot) navDot.style.display = "block";
    });
  }
}

initUpdatesUI().catch((err) => console.error("initUpdatesUI:", err));

// Check beim Öffnen der Update-Seite
document.querySelector('[data-page="updates"]')?.addEventListener("click", () => {
  runUpdateCheck();
});

// ── Ordner öffnen ─────────────────────────────────────────────
let _diagPaths = null;

async function getDiagPaths() {
  if (_diagPaths) return _diagPaths;
  if (window.diagnosticsAPI?.getPaths) {
    _diagPaths = await window.diagnosticsAPI.getPaths();
  }
  return _diagPaths;
}

async function openFolder(key) {
  const paths = await getDiagPaths();
  if (!paths || !paths[key]) return;
  window.shellAPI?.openPath(paths[key]);
}

document.getElementById("openPluginsFolderBtn")?.addEventListener("click", () => openFolder("plugins"));
document.getElementById("openThemesFolderBtn")?.addEventListener("click",  () => openFolder("themes"));

// ── Diagnostics ───────────────────────────────────────────────

// Ordner-Buttons auf der Diagnostics-Seite
document.getElementById("openLogsFolderBtn")?.addEventListener("click",      () => openFolder("logs"));
document.getElementById("openCrashFolderBtn")?.addEventListener("click",     () => openFolder("crash"));
document.getElementById("openUserDataFolderBtn")?.addEventListener("click",  () => openFolder("userData"));

// Health Check
async function loadHealthCheck() {
  if (!window.diagnosticsAPI?.getHealth) return;
  const results = await window.diagnosticsAPI.getHealth();
  const container = document.getElementById("healthCheckList");
  if (!container) return;

  if (!results || results.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:12px 0;">Keine Prüfungen vorhanden</p>`;
    return;
  }

  container.innerHTML = results.map(r => `
    <div class="health-check-item">
      <span class="health-dot ${r.success ? 'ok' : 'fail'}"></span>
      <span style="flex:1; color: var(--text-main);">${r.name}</span>
      <span style="font-size:11px; color:${r.success ? '#22c55e' : '#ef4444'};">
        ${r.success ? '✓ OK' : '✗ ' + (r.message || 'Fehler')}
      </span>
    </div>
  `).join("");
}

document.getElementById("reloadHealthBtn")?.addEventListener("click", () => loadHealthCheck());

// System Info
async function loadSystemInfo() {
  if (!window.diagnosticsAPI?.getSystemInfo) return;
  const info = await window.diagnosticsAPI.getSystemInfo();
  const tbody = document.querySelector("#systemInfoTable tbody");
  if (!tbody || !info) return;

  const rows = [
    ["Plattform",     info.system?.platform  || "–"],
    ["Architektur",   info.system?.architecture || "–"],
    ["Hostname",      info.system?.hostname  || "–"],
    ["CPU",           info.cpu?.model        || "–"],
    ["CPU-Kerne",     info.cpu?.cores        || "–"],
    ["RAM gesamt",    info.memory?.total     || "–"],
    ["RAM frei",      info.memory?.free      || "–"],
    ["Node.js",       info.runtime?.node     || "–"],
    ["Electron",      info.runtime?.electron || "–"],
    ["Chromium",      info.runtime?.chromium || "–"],
    ["V8",            info.runtime?.v8       || "–"],
  ];

  tbody.innerHTML = rows.map(([label, value]) => `
    <tr>
      <td>${label}</td>
      <td style="color: var(--text-main); font-weight:500;">${value}</td>
    </tr>
  `).join("");
}

// Crash Reports
async function loadCrashReports() {
  if (!window.diagnosticsAPI?.getCrashReports) return;
  const reports = await window.diagnosticsAPI.getCrashReports();
  const container = document.getElementById("crashReportList");
  if (!container) return;

  if (!reports || reports.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:12px 0;">Keine Crash-Reports vorhanden ✓</p>`;
    return;
  }

  container.innerHTML = reports.map(r => {
    const date = r.created ? new Date(r.created).toLocaleString("de-DE") : "–";
    return `
      <div class="crash-report-item">
        <span class="crash-report-name" title="${r.file}">${r.file}</span>
        <span class="crash-report-date">${date}</span>
        <button class="btn-icon-sm" data-delete="${r.id}" title="Löschen">🗑</button>
      </div>
    `;
  }).join("");

  // Delete-Buttons verdrahten
  container.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.delete;
      await window.diagnosticsAPI.deleteCrashReport(id);
      loadCrashReports();
    });
  });
}

document.getElementById("reloadCrashReportsBtn")?.addEventListener("click", () => loadCrashReports());
document.getElementById("clearCrashReportsBtn")?.addEventListener("click", async () => {
  await window.diagnosticsAPI?.clearCrashReports();
  loadCrashReports();
});

// Diagnostics-Daten beim Öffnen der Seite laden
document.querySelector('[data-page="diagnostics"]')?.addEventListener("click", () => {
  loadHealthCheck();
  loadSystemInfo();
  loadCrashReports();
});