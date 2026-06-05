const autostartCheckbox = document.getElementById("autostart");
const startMinimizedCheckbox = document.getElementById("startMinimized");
const mediaKeysCheckbox = document.getElementById("mediaKeys");
const saveBtn = document.getElementById("saveBtn");


document.getElementById("btnMinimize")
  .addEventListener("click", () => {
    window.windowControls.minimize();
  });

document.getElementById("btnMaximize")
  .addEventListener("click", () => {
    window.windowControls.maximize();
  });

document.getElementById("btnClose")
  .addEventListener("click", () => {
    window.windowControls.close();
  });

loadPlugins();
loadThemes();

document.getElementById("reloadPluginsBtn").addEventListener("click", () => loadPlugins());
document.getElementById("reloadThemesBtn").addEventListener("click", () => loadThemes());


async function loadPlugins(){

  const plugins = await window.api.getPlugins();

  const list = document.getElementById("pluginList");

  list.innerHTML = "";

  plugins.forEach(p => {

    const item = document.createElement("div");
    item.className = "plugin-item";

    item.innerHTML = `
      <span>${p.name}</span>
      <input type="checkbox" ${p.enabled ? "checked" : ""}>
    `;

    const toggle = item.querySelector("input");

    toggle.addEventListener("change", () => {
      window.api.togglePlugin(p.id, toggle.checked);
    });

    list.appendChild(item);

  });
  window.analytics.trackEvent("Plugins Loaded");
}

async function loadThemes() {
  if (window.themeAPI && window.themeAPI.getThemes) {
    const themes = await window.themeAPI.getThemes();
    const activeTheme = await window.themeAPI.getActiveTheme();
    
    const list = document.getElementById("themeList");
    list.innerHTML = "";
    
    themes.forEach(t => {
      const item = document.createElement("div");
      item.className = "plugin-item"; 
      item.style = "display: flex; justify-content: space-between; padding: 10px; background: rgba(0,0,0,0.2); margin-bottom: 8px; border-radius: 8px; align-items: center;";
      
      const isChecked = activeTheme === t.id ? "checked" : "";
      item.innerHTML = `
        <span>${t.name}</span>
        <input type="radio" name="theme-select" value="${t.id}" ${isChecked}>
      `;
      
      const radio = item.querySelector("input");
      radio.addEventListener("change", () => {
        if (radio.checked) {
          window.themeAPI.setActiveTheme(t.id);
          const fileUrl = t.css.startsWith('file://') ? t.css : 'file:///' + t.css.replace(/\\/g, '/');
          let link = document.getElementById("theme-style");
          if (link) link.href = fileUrl;
        }
      });
      
      list.appendChild(item);
    });
  }
}