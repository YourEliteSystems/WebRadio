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
const updateIcon      = document.getElementById("updateIcon");
const updateTitle     = document.getElementById("updateStatusTitle");
const updateSub       = document.getElementById("updateStatusSub");
const releaseWrap     = document.getElementById("releaseNotesWrap");
const releaseNotes    = document.getElementById("releaseNotes");
const installBtn      = document.getElementById("installUpdateBtn");
const checkBtn        = document.getElementById("checkUpdateBtn");
const navDot          = document.getElementById("nav-update-dot");
const currentVerEl    = document.getElementById("currentVersion");

// Aktuelle Version anzeigen
if (window.updaterAPI?.getVersion) {
  window.updaterAPI.getVersion().then(v => {
    const label = `v${v}`;
    if (currentVerEl) currentVerEl.textContent = label;
    const aboutVerEl = document.getElementById("currentVersionAbout");
    if (aboutVerEl) aboutVerEl.textContent = label;
  });
}

function setUpdateState(state, data = {}) {
  updateIcon.className = `update-status-icon ${state}`;

  if (state === "checking") {
    updateTitle.textContent = "Prüfe auf Updates...";
    updateSub.textContent = "Verbindung zum Update-Server";
    releaseWrap.style.display = "none";
    installBtn.style.display = "none";

  } else if (state === "current") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    updateTitle.textContent = "Du bist aktuell";
    updateSub.textContent = `Version v${data.version || "?"} ist die neueste Version`;
    releaseWrap.style.display = "none";
    installBtn.style.display = "none";

  } else if (state === "available") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>`;
    updateTitle.textContent = `Update verfügbar – v${data.version}`;
    updateSub.textContent = "Eine neue Version ist bereit zum Herunterladen";
    if (data.releaseNotes) {
      releaseWrap.style.display = "block";
      releaseNotes.textContent = data.releaseNotes;
    }
    installBtn.style.display = "inline-flex";
    // Navigationspunkt anzeigen
    if (navDot) navDot.style.display = "block";

  } else if (state === "error") {
    updateIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    updateTitle.textContent = "Update-Check fehlgeschlagen";
    updateSub.textContent = "Server nicht erreichbar – bitte später erneut versuchen";
    releaseWrap.style.display = "none";
    installBtn.style.display = "none";
  }
}

// Initialer Check
async function runUpdateCheck() {
  setUpdateState("checking");
  if (!window.updaterAPI?.check) {
    setUpdateState("error");
    return;
  }
  const result = await window.updaterAPI.check();
  if (result.available) {
    setUpdateState("available", result);
  } else {
    setUpdateState("current", result);
  }
}

// Auf Update-Benachrichtigung vom Hauptprozess hören
if (window.updaterAPI?.onUpdateAvailable) {
  window.updaterAPI.onUpdateAvailable((info) => {
    setUpdateState("available", info);
    if (navDot) navDot.style.display = "block";
  });
}

checkBtn.addEventListener("click", () => runUpdateCheck());

installBtn.addEventListener("click", async () => {
  installBtn.textContent = "Öffne Download...";
  installBtn.disabled = true;
  await window.updaterAPI.install();
  setTimeout(() => {
    installBtn.textContent = "⬇ Jetzt herunterladen";
    installBtn.disabled = false;
  }, 2000);
});

// Check beim Öffnen der Update-Seite
document.querySelector('[data-page="updates"]').addEventListener("click", () => {
  runUpdateCheck();
});

// Initialer Status
setUpdateState("checking");
setTimeout(() => runUpdateCheck(), 300);

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