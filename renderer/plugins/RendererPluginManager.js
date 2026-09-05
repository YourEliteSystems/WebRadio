import { unregisterPluginUI, registerView, registerSlot } from '../ui/componentRegistry';
import {
  registerSection,
  registerItem,
  updateItem,
  removeItem,
  removeSection,
  toggleSection,
  isSectionExpanded,
  unregisterPluginNavigation,
  getNavigationTree,
  syncWithMain
} from '../ui/navigationRegistry';

const activePlugins = new Map();
const injectedScripts = new Map();

window.uiRegistry = {
  registerView,
  registerSlot,
  navigation: {
    registerSection: (sec, pluginId) => registerSection(sec, pluginId),
    registerItem: (it, pluginId) => registerItem(it, pluginId),
    updateItem: (id, updates, pluginId) => updateItem(id, updates, pluginId),
    removeItem: (id, pluginId) => removeItem(id, pluginId),
    removeSection: (id, pluginId) => removeSection(id, pluginId),
    toggleSection,
    isSectionExpanded,
    getTree: getNavigationTree
  }
};

window.registerPluginRenderer = (id, hooks) => {
  activePlugins.set(id, hooks);

  if (hooks.init) {
    try {
       hooks.init({
         id,
         navigation: {
           registerSection: (sec) => registerSection(sec, id),
           registerItem: (it) => registerItem(it, id),
           updateItem: (itemId, updates) => updateItem(itemId, updates, id),
            removeItem: (itemId) => removeItem(itemId, id),
            removeSection: (secId) => removeSection(secId, id)
          }
       });
    } catch (err) {
       window.pluginAPI?.log("error", `RendererPluginManager`, `Plugin ${id} init error: ${err.message}`);
    }
  }
};

window.registerPlugin = (plugin) => {
  if(!plugin?.id){
    window.pluginAPI?.log("error", "RendererPluginManager", "Plugin registration failed: Missing 'id'");
    return;
  }
  activePlugins.set(plugin.id, plugin);

  if(typeof plugin.activate === "function"){
    try {
      plugin.activate({
        pluginId: plugin.id,
        navigation: {
          registerSection: (sec) => registerSection(sec, plugin.id),
          registerItem: (it) => registerItem(it, plugin.id),
          updateItem: (itemId, updates) => updateItem(itemId, updates, plugin.id),
          removeItem: (itemId) => removeItem(itemId, plugin.id),
          removeSection: (secId) => removeSection(secId, plugin.id)
        }
      });
    } catch (err) {
      window.pluginAPI?.log("error", `RendererPluginManager`, `Plugin ${plugin.id} activation error: ${err.message}`);
    }
  }
};

async function loadRendererPlugins() {
  // Navigation mit Main-Prozess synchronisieren
  await syncWithMain();

  if (window.api && window.api.getRendererScripts) {
    try {
      const scripts = await window.api.getRendererScripts();
      scripts.forEach(scriptUrl => injectScript(scriptUrl));
    } catch (err) {
      window.pluginAPI?.log("error", "RendererPluginManager", `Error fetching renderer scripts: ${err.message}`);
    }
  }

  // Listen to live toggles
  if (window.pluginAPI && window.pluginAPI.onPluginToggled) {
    window.pluginAPI.onPluginToggled(async (data) => {
      const { id, enabled } = data;
      if (!enabled) {
        // Destroy and remove
        const hooks = activePlugins.get(id);
        if (hooks && hooks.destroy) {
          try { hooks.destroy(); } catch (err) { window.pluginAPI?.log("error", `RendererPluginManager`, `Plugin ${id} destroy error: ${err.message}`); }
        }
        const plugin = activePlugins.get(id);
        if (plugin && typeof plugin.deactivate === "function") {
          try { plugin.deactivate({pluginId: id}); } catch (err) { window.pluginAPI?.log("error", `RendererPluginManager`, `Plugin ${id} deactivation error: ${err.message}`); }
        }
        activePlugins.delete(id);

        // Unregister plugin UI & Navigation
        unregisterPluginUI(id);
        unregisterPluginNavigation(id);

        // Remove script tag
        const scriptTag = injectedScripts.get(id);
        if (scriptTag) {
          scriptTag.remove();
          injectedScripts.delete(id);
        }
      } else {
        // Fetch new scripts and inject if not already present
        if (window.api && window.api.getRendererScripts) {
          const scripts = await window.api.getRendererScripts();
          scripts.forEach(scriptUrl => {
            const match = scriptUrl.match(/\/plugins\/([^/]+)\//);
            const scriptId = match ? match[1] : null;
            if (scriptId === id && !injectedScripts.has(id)) {
              injectScript(scriptUrl, id);
            }
          });
        }
      }
    });
  }

  // Globaler Rescan: entferne Renderer-Scripte weggefallener Plugins
  // und lade neue/geänderte Scripts nach.
  if (window.api && window.api.onPluginsChanged) {
    window.api.onPluginsChanged(async (result) => {
      const removed = (result?.removed || []).concat(result?.disabled || []);
      removed.forEach(id => {
        const hooks = activePlugins.get(id);
        if (hooks && hooks.destroy) {
          try { hooks.destroy(); } catch (err) {
            window.pluginAPI?.log("error", "RendererPluginManager",
              `Plugin ${id} destroy error: ${err.message}`);
          }
        }
        const plugin = activePlugins.get(id);
        if (plugin && typeof plugin.deactivate === "function") {
          try { plugin.deactivate({ pluginId: id }); } catch (err) {
            window.pluginAPI?.log("error", "RendererPluginManager",
              `Plugin ${id} deactivation error: ${err.message}`);
          }
        }
        activePlugins.delete(id);
        unregisterPluginUI(id);
        unregisterPluginNavigation(id);

        const scriptTag = injectedScripts.get(id);
        if (scriptTag) {
          scriptTag.remove();
          injectedScripts.delete(id);
        }
      });

      const toReload = (result?.added || []).concat(result?.changed || []);
      if (toReload.length > 0 && window.api.getRendererScripts) {
        try {
          const scripts = await window.api.getRendererScripts();
          scripts.forEach(scriptUrl => injectScript(scriptUrl));
        } catch (err) {
          window.pluginAPI?.log("error", "RendererPluginManager",
            `Error reloading renderer scripts: ${err.message}`);
        }
      }
    });
  }
}

function injectScript(scriptUrl, explicitId = null) {
  const script = document.createElement("script");
  script.type = "module";
  script.src = `${scriptUrl}?t=${Date.now()}`;
  script.onload = () => window.pluginAPI?.log("info", "RendererPluginManager", `Loaded renderer script: ${scriptUrl}`);
  script.onerror = (e) => window.pluginAPI?.log("error", "RendererPluginManager", `Failed to load renderer script: ${scriptUrl}`);
  document.body.appendChild(script);
  
  const match = scriptUrl.match(/\/plugins\/([^/]+)\//);
  const id = explicitId || (match ? match[1] : null);
  if (id) {
    injectedScripts.set(id, script);
  }
}

export { loadRendererPlugins };
