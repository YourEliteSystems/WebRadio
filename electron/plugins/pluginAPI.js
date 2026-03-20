const plugins = [];
const uiPanels = [];

export function registerPlugin(plugin) {
  plugins.push(plugin);
}

export function emit(event, data) {

  plugins.forEach(p => {
    if (p[event]) {
      try {
        p[event](data);
      } catch (e) {
        console.error("Plugin Fehler:", e);
      }
    }
  });

}

export function registerPanel(panel) {
  uiPanels.push(panel);
}

export function renderPanels(container) {

  uiPanels.forEach(panel => {

    const el = panel.render();

    if (el) {
      container.appendChild(el);
    }

  });

}