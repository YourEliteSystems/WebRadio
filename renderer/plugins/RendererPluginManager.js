const activePlugins = new Map();
const injectedScripts = new Map();

window.registerPluginRenderer = (id, hooks) => {
  activePlugins.set(id, hooks);

  if (hooks.init) {
    try {
       hooks.init();
       } catch (err) {
         console.error(`Plugin ${id} init error:`, err);
    }
  }
};

window.registerPlugin = (plugin) => {
  if(!plugin?.id){
    console.error("[PluginLoader] Plugin registration failed: Missing 'id'", plugin);
    return;
  }
  activePlugins.set(plugin.id, plugin);

  if(typeof plugin.activate === "function"){
    try {
      plugin.activate({pluginId: plugin.id});
    }catch (err) {
      console.error(`Plugin ${plugin.id} activation error:`, err);
    }
  }
};

async function loadRendererPlugins() {
  if (window.api && window.api.getRendererScripts) {
    try {
      const scripts = await window.api.getRendererScripts();
      scripts.forEach(scriptUrl => injectScript(scriptUrl));
    } catch (err) {
      console.error("[PluginLoader] Error fetching renderer scripts", err);
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
          try { hooks.destroy(); } catch (err) { console.error(`Plugin ${id} destroy error:`, err); }
        }
        const plugin = activePlugins.get(id);
        if (plugin && typeof plugin.deactivate === "function") {
          try { plugin.deactivate({pluginId: id}); } catch (err) { console.error(`Plugin ${id} deactivation error:`, err); }
        }
        activePlugins.delete(id);
        
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
            const match = scriptUrl.match(/\/plugins\/([^\/]+)\//);
            const scriptId = match ? match[1] : null;
            if (scriptId === id && !injectedScripts.has(id)) {
              injectScript(scriptUrl, id);
            }
          });
        }
      }
    });
  }
}

function injectScript(scriptUrl, explicitId = null) {
  const script = document.createElement("script");
  script.type = "module";
  // Add a timestamp query param to bypass cache when reloading during development
  script.src = `${scriptUrl}?t=${Date.now()}`;
  script.onload = () => console.log(`[PluginLoader] Loaded renderer script: ${scriptUrl}`);
  script.onerror = (e) => console.error(`[PluginLoader] Failed to load renderer script: ${scriptUrl}`, e);
  document.body.appendChild(script);
  
  const match = scriptUrl.match(/\/plugins\/([^\/]+)\//);
  const id = explicitId || (match ? match[1] : null);
  if (id) {
    injectedScripts.set(id, script);
  }
}
export { loadRendererPlugins };
