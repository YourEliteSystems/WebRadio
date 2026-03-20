const fs = require("fs");
const path = require("path");
const eventBus = require("../core/eventBus");
const plugins = [];

function getPlugins() {
  const config = readConfig();
  return plugins.map(p => ({
    id: p.meta.id,
    name: p.meta.name,
    enabled: config.plugins?.[p.meta.id]?.enabled ?? true
  }));
}


function readConfig(){
const configPath = path.join(__dirname, "../../plugins/plugins.json");
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
  const configPath = path.join(__dirname, "../../plugins/plugins.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function togglePlugin(id, enabled) {

  const plugin = plugins.find(p => p.meta.id === id);
  if (!plugin) return; 
  plugin.meta.enabled = enabled;

  const configPath = path.join(__dirname, "../../plugins/plugins.json");
  let config = { plugins: {} };
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath));
  }
  if (!config.plugins) config.plugins = {};
  if (!config.plugins[id]) config.plugins[id] = {};
  config.plugins[id].enabled = enabled;
  writeConfig(config);
  console.log(`Plugin ${enabled ? "aktiviert" : "deaktiviert"}: ${plugin.meta.name}`);
}


function loadPlugins() {

  const pluginDir = path.join(__dirname, "../../plugins");
  
  const configPath = path.join(pluginDir, "plugins.json");

  if(!fs.existsSync(configPath)){
    fs.writeFileSync(
      configPath,
      JSON.stringify({ plugins: {} }, null, 2)
    );
  }

  let config = {};
  if(fs.existsSync(configPath)){
    try{
      const raw = fs.readFileSync(configPath,"utf-8");
      if(raw.trim().length > 0){
        config = JSON.parse(raw)
      }else {
        console.warn("Leere plugins.json, Standardkonfiguration wird verwendet.");
      }
    }catch(err){
      console.error("Fehler in plugins.json:", err);
      config = { plugins: {} };
    }
  }

  if (!fs.existsSync(pluginDir)) return;

  const dirs = fs.readdirSync(pluginDir);

  dirs.forEach(dir => {

    const metaPath = path.join(pluginDir, dir, "plugin.json");

    if (!fs.existsSync(metaPath)) return;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath));
        const pluginConfig = config.plugins?.[meta.id];
        if(pluginConfig && pluginConfig.enabled === false){
          console.log(`Plugin deaktiviert: ${meta.name}`);
          return;
        }
        const mainFile = path.join(pluginDir, dir, meta.main);
        if (!fs.existsSync(mainFile)) return;
        const plugin = require(mainFile);
        console.log(`Plugin geladen: ${meta.name}`);
        plugins.push({
          meta,
          instance: plugin
        });
        if(plugin.onMetadata) {
          eventBus.on("onMetadata", plugin.onMetadata);
        }

        if(plugin.onStationChange) {
          eventBus.on("onStationChange", plugin.onStationChange);
        }
        if (plugin.init){
          safeExecute(plugin.init);
        }
        registerEvents(plugin);
      } catch (e) {
        console.error("Plugin Fehler:",dir, e);
      }
  });
}

function safeExecute(fn){
  try{
    fn();
  }catch(err){
    console.error("Plugin Crash abgefangen:", err);
  }

}

function registerEvents(plugin) {

  const events = [
    "onMetadata",
    "onStationChange",
    "onPlay",
    "onStop",
    "onVolumeChange",
    "onThemeChange"
  ];

  events.forEach(event => {

    if (typeof plugin[event] === "function") {

      const busEvent = event.replace("on","").toLowerCase();

      eventBus.on(busEvent, data => {
        try {
          plugin[event](data);
        } catch (err) {
          console.error(`Fehler im Plugin-Event ${event}:`, err);
        }
      });

    }

  });
}

module.exports = {
  loadPlugins,
  getPlugins,
  togglePlugin
};