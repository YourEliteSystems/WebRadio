const fs = require("fs");
const path = require("path");
const eventBus = require("../core/eventBus");
const { createPluginContext } = require("../core/plugins/PluginContext");
const { app } = require("electron");
const LogManager = require("../core/diagnostics/logging/LogManager");

const logger = LogManager.getLogger("PluginManager");

const plugins = [];

function getPlugins() {
  const config = readConfig();
  const pluginDir = path.join(app.getPath("userData"), "plugins");
  const result = [];
  
  if (fs.existsSync(pluginDir)) {
    const dirs = fs.readdirSync(pluginDir);
    dirs.forEach(dir => {
      const metaPath = path.join(pluginDir, dir, "plugin.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath));
          result.push({
            id: meta.id,
            name: meta.name,
            enabled: config.plugins?.[meta.id]?.enabled ?? true
          });
        } catch (e) {}
      }
    });
  }
  return result;
}

function readConfig(){
  const configPath = path.join(app.getPath("userData"), "plugins/plugins.json");
  if(!fs.existsSync(configPath)){
    fs.writeFileSync(
      configPath,
      JSON.stringify({ plugins: {} }, null, 2)
    );
  }
  try{
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }catch{
    return { plugins: {} };
  }
}

function writeConfig(config){
  const configPath = path.join(app.getPath("userData"), "plugins/plugins.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function togglePlugin(id, enabled) {
  const config = readConfig();
  if (!config.plugins) config.plugins = {};
  if (!config.plugins[id]) config.plugins[id] = {};
  config.plugins[id].enabled = enabled;
  writeConfig(config);

  const activePluginIndex = plugins.findIndex(p => p.meta.id === id);
  const isActive = activePluginIndex !== -1;

  if (enabled && !isActive) {
    // Try to start it
    const pluginDir = path.join(app.getPath("userData"), "plugins");
    const dirs = fs.readdirSync(pluginDir);
    for (const dir of dirs) {
      const metaPath = path.join(pluginDir, dir, "plugin.json");
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath));
        if (meta.id === id) {
          startPlugin(dir, meta);
          break;
        }
      }
    }
  } else if (!enabled && isActive) {
    // Stop it
    stopPlugin(id);
  }
  
  const pluginMeta = plugins.find(p => p.meta.id === id)?.meta || { id, name: id };
  logger.info(`Plugin ${enabled ? "aktiviert" : "deaktiviert"}: ${pluginMeta.name}`);
  
  eventBus.emit("pluginToggled", { id, enabled });
}

function stopPlugin(id) {
  const index = plugins.findIndex(p => p.meta.id === id);
  if (index === -1) return;
  const p = plugins[index];
  
  // Call destroy if exists
  if(typeof p.instance.destroy === "function") {
    safeExecute(() => p.instance.destroy());
  } else if(typeof p.instance.destroy === "function") {
    safeExecute(p.instance.destroy());
  }
  
  // Remove listeners
  p.listeners.forEach(({ event, handler }) => {
    eventBus.off(event, handler);
  });
  
  // Clear require cache
  const mainFile = path.join(app.getPath("userData"), "plugins", p.dir, p.meta.main);
  delete require.cache[require.resolve(mainFile)];
  
  plugins.splice(index, 1);
}

function startPlugin(dir, meta) {
  try {
    const mainFile = path.join(app.getPath("userData"), "plugins", dir, meta.main);
    if (!fs.existsSync(mainFile)) return;
    const instance = require(mainFile);
    logger.info(`Plugin geladen: ${meta.name}`);
    
    const listeners = [];
    const events = ["onMetadata", "onStationChange", "onPlay", "onStop", "onVolumeChange", "onThemeChange"];
    
    events.forEach(event => {
      if (typeof instance[event] === "function") {
        const busEvent = event.replace("on", "").toLowerCase();
        const handler = data => {
          try { instance[event](data); } 
          catch (err) { logger.error(`Fehler im Plugin-Event ${event}: ${err.message}`); }
        };
        eventBus.on(busEvent, handler);
        listeners.push({ event: busEvent, handler });
      }
    });

    plugins.push({ meta, instance, dir, listeners });
    
    const context = createPluginContext(meta);

    if(typeof instance.init === "function") {
      safeExecute(() => instance.init(context));
    }else if(typeof instance.init === "function") {
      safeExecute(instance.init(context));
    }

    if (instance.init) {
      safeExecute(instance.init);
    }
  } catch (e) {
    logger.error(`Plugin Fehler (${dir}): ${e.message}`);
  }
}

function loadPlugins() {
  const pluginDir = path.join(app.getPath("userData"), "plugins");
  const config = readConfig();

  if (!fs.existsSync(pluginDir)) return;
  const dirs = fs.readdirSync(pluginDir);

  dirs.forEach(dir => {
    const metaPath = path.join(pluginDir, dir, "plugin.json");
    if (!fs.existsSync(metaPath)) return;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath));
      const pluginConfig = config.plugins?.[meta.id];
      if (pluginConfig && pluginConfig.enabled === false) {
        return;
      }
      startPlugin(dir, meta);
    } catch (e) {
      logger.error(`Plugin Init Fehler (${dir}): ${e.message}`);
    }
  });
}

function safeExecute(fn) {
  try {
    fn();
  } catch (err) {
    logger.warn(`Plugin Crash abgefangen: ${err.message}`);
  }
}

function getRendererScripts() {
  const config = readConfig();
  const pluginDir = path.join(app.getPath("userData"), "plugins");
  const scripts = [];
  
  if (!fs.existsSync(pluginDir)) return scripts;
  const dirs = fs.readdirSync(pluginDir);
  dirs.forEach(dir => {
    const metaPath = path.join(pluginDir, dir, "plugin.json");
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath));
        if (config.plugins?.[meta.id]?.enabled !== false) {
          if (meta.renderer) {
            const rendererAbsPath = path.join(pluginDir, dir, meta.renderer);
            if (fs.existsSync(rendererAbsPath)) {
              scripts.push('file:///' + rendererAbsPath.replace(/\\/g, '/'));
            }
          }
        }
      } catch (e) {}
    }
  });
  return scripts;
}

module.exports = {
  loadPlugins,
  getPlugins,
  togglePlugin,
  getRendererScripts
};