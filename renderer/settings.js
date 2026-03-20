const autostartCheckbox = document.getElementById("autostart");
const startMinimizedCheckbox = document.getElementById("startMinimized");
const mediaKeysCheckbox = document.getElementById("mediaKeys");
const saveBtn = document.getElementById("saveBtn");

//console.log("settingsAPI:", window.api);

window.addEventListener('error', (event) => {
  window.sentry.captureException(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  window.sentry.captureException(event.reason);
});

document.getElementById("btnMinimize")
  .addEventListener("click", () => {
    window.windowControls.minimize();
    window.analytics.trackEvent("Window Minimized");
  });

document.getElementById("btnMaximize")
  .addEventListener("click", () => {
    window.windowControls.maximize();
    window.analytics.trackEvent("Window Maximized");
  });

document.getElementById("btnClose")
  .addEventListener("click", () => {
    window.windowControls.close();
    window.analytics.trackEvent("App Closed");
  });

loadPlugins();


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