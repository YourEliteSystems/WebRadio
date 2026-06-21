# Plugin Development Guide

Dieser Guide beschreibt die neue Plugin-Struktur von WebRadio. Das alte Plugin-System laeuft weiterhin und kann parallel genutzt werden, aber die neue Struktur unter `electron/core/plugins/` ist der zukunftsweisende Weg fuer Portierung, Neuentwicklung und Erweiterung.

Der Guide richtet sich an drei Zielgruppen:

- Plugin-Autoren, die neue Plugins direkt auf die kommende API ausrichten wollen.
- Entwickler, die bestehende Legacy-Plugins schrittweise portieren.
- Core-Entwickler, die das neue Plugin-System erweitern.

| Bereich | Stand |
| --- | --- |
| App-Version | `v1.0.4` in Entwicklung |
| empfohlene Struktur | `electron/core/plugins/` |
| Legacy-Kompatibilitaet | `electron/plugins/pluginManager.js` laeuft weiter |
| API-Status | nutzbar, aber noch nicht final |
| Roadmap-Ziel | versionierte Plugin-API ab `v1.2` |

> Kurzfassung: Bestehende Plugins sollen weiter funktionieren. Neue Plugins und groessere Umbauten sollen sich aber an der neuen Core-Struktur orientieren: klare Module, validierte Manifeste, vorbereitete Permissions und Zugriff auf den Core nur ueber eine definierte Plugin-API.

## Architekturueberblick

### Neue Plugin-Struktur

Die zukunftsweisende Struktur liegt unter `electron/core/plugins/`:

```txt
electron/core/plugins/
  PluginAPI.js
  PluginContext.js
  PluginEvents.js
  PluginLoader.js
  PluginManager.js
  PluginPermissions.js
  PluginService.js
  PluginStorage.js
```

Ziel ist eine saubere Aufteilung:

| Modul | Aufgabe |
| --- | --- |
| `PluginManager` | Lebenszyklus koordinieren, aktive Plugins verwalten |
| `PluginLoader` | Manifest und Einstiegspunkt laden |
| `PluginAPI` | kontrollierte API fuer Plugins erzeugen |
| `PluginContext` | Plugin-Metadaten plus API an `init(context)` uebergeben |
| `PluginStorage` | Plugin-spezifische Daten unter `app.getPath("userData")` speichern |
| `PluginPermissions` | erlaubte Rechte validieren |
| `PluginEvents` | EventBus-Zugriff kapseln |
| `PluginService` | spaetere Service-Schicht fuer IPC/UI |

Diese Struktur ist der Standard fuer neue Entwicklung. Sie trennt Manifest-Laden, Runtime, Config, Events, Storage und Renderer-Anbindung voneinander.

### Legacy-Kompatibilitaet

Das bisherige System in `electron/plugins/pluginManager.js` bleibt wichtig, weil vorhandene Plugins darueber aktuell weiterlaufen:

```txt
electron/plugins/pluginManager.js
plugins/
  plugins.json
  meinPlugin/
    plugin.json
    plugin.js
    renderer.js
```

Es kann weiterhin genutzt werden und erkennt die bekannten Hooks wie `init`, `destroy`, `onMetadata` oder `onStop`. Neue Plugins sollten aber schon so geschrieben werden, dass sie spaeter ohne grosse Aenderungen in die neue Struktur passen.

Praktische Regel:

- Bestehendes Plugin: darf im Legacy-System bleiben, solange es funktioniert.
- Neues Plugin: Manifest mit `apiVersion` und `permissions` schreiben.
- Core-Erweiterung: immer in `electron/core/plugins/` entwickeln.
- Portierung: erst kompatibel machen, danach auf die neue API umstellen.

Der aktuelle Code nutzt bereits `createPluginContext(meta)` aus der neuen Struktur, laedt aber weiterhin ueber den Legacy-Manager. Das ist absichtlich ein Uebergang: beide Wege koennen parallel existieren, waehrend die neue Struktur ausgebaut wird.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| Manifest | `plugin.json`, beschreibt Name, ID, Version und Einstiegspunkte |
| Main-Plugin | `plugin.js`, laeuft im Electron-Main-Prozess |
| Renderer-Plugin | `renderer.js`, laeuft im Renderer und darf UI ergaenzen |
| Plugin Context | Objekt, das an `init(context)` uebergeben wird |
| Plugin API | kontrollierte Funktionen wie Events und Storage |
| Permission | deklarierter Zugriff, z. B. `events`, `storage` oder `ui` |

## Manifest

### Legacy-kompatibles Manifest

Dieses Manifest funktioniert heute im Legacy-System und bleibt als Kompatibilitaetsbasis gueltig:

```json
{
  "name": "Mein Plugin",
  "id": "meinPlugin",
  "version": "1.0.0",
  "main": "plugin.js",
  "renderer": "renderer.js",
  "author": "Dein Name",
  "description": "Kurze Beschreibung"
}
```

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `name` | ja | Anzeigename in den Einstellungen |
| `id` | ja | stabile, eindeutige Plugin-ID |
| `version` | empfohlen | Plugin-Version |
| `main` | empfohlen | Main-Prozess-Einstiegspunkt |
| `renderer` | optional | Renderer-Einstiegspunkt |
| `author` | empfohlen | Autor |
| `description` | empfohlen | Kurzbeschreibung |

Die `id` darf nach der ersten Veroeffentlichung nicht leichtfertig geaendert werden. Sie wird fuer Toggle-Status, Storage und Renderer-Zuordnung genutzt.

### Empfohlenes Manifest fuer neue Plugins

Neue Plugins sollten dieses Manifest-Format nutzen:

```json
{
  "name": "Mein Plugin",
  "id": "meinPlugin",
  "version": "1.0.0",
  "apiVersion": "1.0",
  "main": "plugin.js",
  "renderer": "renderer.js",
  "author": "Dein Name",
  "description": "Kurze Beschreibung",
  "permissions": ["events", "storage", "ui"]
}
```

`apiVersion` und `permissions` sind im Legacy-Manager noch nicht voll erzwungen, gehoeren aber in neue Plugins. Dadurch sind neue Erweiterungen direkt auf die kommende Plugin-API vorbereitet.

## Main-Plugin

Ein Main-Plugin exportiert ein Objekt per CommonJS:

```javascript
module.exports = {
  init(context) {
    console.log(`${context.plugin.name} gestartet`);
  },

  destroy() {
    console.log("Plugin beendet");
  },

  onMetadata(meta) {
    console.log("Titel:", meta.StreamTitle);
  },

  onStop() {
    console.log("Wiedergabe gestoppt");
  }
};
```

### Lifecycle

| Hook | Zeitpunkt |
| --- | --- |
| `init(context)` | Plugin wurde geladen oder aktiviert |
| `destroy()` | Plugin wird deaktiviert oder entladen |

Regel: Alles, was in `init()` gestartet wird, muss in `destroy()` wieder beendet werden. Dazu zaehlen Timer, offene Verbindungen, Event-Listener und externe Clients.

```javascript
let interval = null;

module.exports = {
  init(context) {
    interval = setInterval(() => {
      context.events.emit("plugin:heartbeat", {
        pluginId: context.plugin.id,
        time: Date.now()
      });
    }, 30000);
  },

  destroy() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }
};
```

### Aktuelle Event-Hooks

Der Legacy-Manager erkennt diese Hook-Namen. Neue Plugins duerfen sie weiter nutzen, solange `activate/deactivate` noch nicht final als stabile API verdrahtet ist:

| Hook | internes Event | Zweck |
| --- | --- | --- |
| `onMetadata(meta)` | `metadata` | neue Stream-Metadaten |
| `onStationChange(station)` | `stationchange` | Senderwechsel |
| `onPlay(data)` | `play` | Wiedergabe gestartet |
| `onStop()` | `stop` | Wiedergabe gestoppt |
| `onVolumeChange(value)` | `volumechange` | Lautstaerke geaendert |
| `onThemeChange(theme)` | `themechange` | Theme geaendert |

Beim Portieren wichtig: Die Hook-Namen sind gross geschrieben nach `on...`, die internen EventBus-Namen sind aktuell lowercase.

## Plugin Context und API

`init(context)` bekommt derzeit einen Context aus `electron/core/plugins/PluginContext.js`.

Aktuell verfuegbar:

```javascript
module.exports = {
  init(context) {
    console.log(context.plugin.id);

    context.events.on("metadata", (meta) => {
      console.log(meta.StreamTitle);
    });

    context.storage.set("lastStart", Date.now());
  }
};
```

### `context.plugin`

Enthaelt die Daten aus dem Manifest:

```javascript
module.exports = {
  init(context) {
    const { id, name, version } = context.plugin;
    console.log(`Plugin ${name} (${id}) v${version}`);
  }
};
```

### `context.events`

```javascript
module.exports = {
  init(context) {
    this.onMetadata = (meta) => {
      console.log("Event via API:", meta.StreamTitle);
    };

    context.events.on("metadata", this.onMetadata);
  },

  destroy() {
    // Fuer eigene context.events.on Listener spaeter off() nutzen,
    // sobald die API stabil finalisiert ist.
  }
};
```

Empfehlung: Fuer neue Plugins aktuell noch die klassischen Hooks nutzen, aber den Code intern schon so organisieren, dass er spaeter leicht nach `activate(api)` und `deactivate(api)` verschoben werden kann. Fuer Core-nahe Tests kann `context.events` bereits helfen.

### `context.storage`

Plugin-Daten werden unter dem Electron-UserData-Verzeichnis abgelegt, getrennt pro Plugin-ID.

```javascript
module.exports = {
  init(context) {
    const count = context.storage.get("starts") || 0;
    context.storage.set("starts", count + 1);

    console.log(`Dieses Plugin wurde ${count + 1} mal gestartet.`);
  }
};
```

Storage eignet sich fuer kleine JSON-kompatible Werte. Keine grossen Dateien, keine Zugangsdaten und keine Cache-Massen speichern.

## Renderer-Plugin

Renderer-Plugins werden aktuell noch ueber den Legacy-Manager als Skript-URL geliefert und im Renderer durch `renderer/plugins/RendererPluginManager.js` injiziert. Die Registrierung sollte aber bereits zur neuen Lifecycle-Idee passen.

### Aktuelle Registrierung

```javascript
let button = null;

window.registerPluginRenderer("meinPlugin", {
  init() {
    const host = document.getElementById("plugin-area") || document.body;

    button = document.createElement("button");
    button.textContent = "Mein Plugin";
    button.addEventListener("click", () => {
      console.log("Plugin Button geklickt");
    });

    host.appendChild(button);
  },

  destroy() {
    if (button) {
      button.remove();
      button = null;
    }
  }
});
```

### Alternative Registrierung

Der Renderer-Manager kennt auch `window.registerPlugin(plugin)`:

```javascript
window.registerPlugin({
  id: "meinPlugin",

  activate(context) {
    console.log("Renderer aktiv:", context.pluginId);
  },

  deactivate(context) {
    console.log("Renderer deaktiviert:", context.pluginId);
  }
});
```

Fuer neue Renderer-Plugins ist diese Form besser erweiterbar, weil sie naeher an `activate` und `deactivate` als Lifecycle-Begriffe heranrueckt.

### Renderer-Regeln

- Keine Node.js-APIs im Renderer erwarten.
- Nur ueber `window.api`, `window.pluginAPI`, `window.radioAPI` und spaetere definierte Bridges kommunizieren.
- DOM-Elemente, Timer und Listener in `destroy()` oder `deactivate()` entfernen.
- Keine globalen Styles ungefragt ueberschreiben.
- UI-Erweiterungen klein halten, bis feste Plugin-Slots fuer React existieren.

## Komplettes Beispiel: Logger-Plugin

```txt
plugins/loggerPlus/
  plugin.json
  plugin.js
  renderer.js
```

`plugin.json`:

```json
{
  "name": "Logger Plus",
  "id": "loggerPlus",
  "version": "1.0.0",
  "apiVersion": "1.0",
  "main": "plugin.js",
  "renderer": "renderer.js",
  "author": "WebRadio",
  "description": "Loggt Metadaten und zeigt den letzten Titel im Renderer.",
  "permissions": ["events", "storage", "ui"]
}
```

`plugin.js`:

```javascript
module.exports = {
  init(context) {
    const starts = context.storage.get("starts") || 0;
    context.storage.set("starts", starts + 1);

    console.log(`[Logger Plus] gestartet (${starts + 1})`);
  },

  onMetadata(meta) {
    console.log("[Logger Plus] Metadaten:", meta.StreamTitle || meta);
  },

  onStationChange(station) {
    console.log("[Logger Plus] Sender:", station?.name || station);
  },

  destroy() {
    console.log("[Logger Plus] beendet");
  }
};
```

`renderer.js`:

```javascript
let panel = null;
let unsubscribe = null;

window.registerPlugin({
  id: "loggerPlus",

  activate() {
    panel = document.createElement("div");
    panel.textContent = "Logger Plus aktiv";
    panel.style.position = "fixed";
    panel.style.right = "16px";
    panel.style.bottom = "88px";
    panel.style.padding = "8px 10px";
    panel.style.borderRadius = "6px";
    panel.style.background = "rgba(0, 0, 0, 0.72)";
    panel.style.color = "#fff";
    panel.style.fontSize = "12px";

    document.body.appendChild(panel);

    if (window.radioAPI?.onMetadata) {
      window.radioAPI.onMetadata((meta) => {
        if (panel) {
          panel.textContent = meta.StreamTitle || "Keine Metadaten";
        }
      });
    }
  },

  deactivate() {
    if (typeof unsubscribe === "function") {
      unsubscribe();
      unsubscribe = null;
    }

    if (panel) {
      panel.remove();
      panel = null;
    }
  }
});
```

Hinweis: `window.radioAPI.onMetadata` gibt aktuell noch keine Unsubscribe-Funktion zurueck. Wenn Renderer-APIs erweitert werden, sollten Listener immer wieder entfernbar sein.

## Legacy-Plugins portieren

Alte Plugins muessen nicht sofort umgebaut werden. Sie laufen weiter, solange der Legacy-Manager aktiv ist. Bei jeder groesseren Aenderung sollte ein Plugin aber auf die neue Struktur vorbereitet werden.

### Vorher: Legacy-Minimal-Plugin

```javascript
module.exports = {
  init() {
    console.log("Plugin aktiv");
  },

  onMetadata(meta) {
    console.log(meta.StreamTitle);
  }
};
```

### Nachher: vorbereitet fuer neue Struktur und Legacy-kompatibel

```javascript
let pluginId = "unknown";

module.exports = {
  init(context = {}) {
    pluginId = context.plugin?.id || pluginId;
    console.log(`${pluginId} aktiv`);
  },

  onMetadata(meta) {
    console.log(`[${pluginId}]`, meta.StreamTitle || meta);
  },

  destroy() {
    console.log(`${pluginId} beendet`);
  }
};
```

### Portierungs-Checkliste

1. `plugin.json` pruefen: stabile `id`, `name`, `version`, `main`.
2. `apiVersion` ergaenzen, auch wenn sie noch nicht erzwungen wird.
3. `permissions` deklarieren, wenn Storage, Events oder UI genutzt werden.
4. `init(context)` statt parameterlosem `init()` unterstuetzen.
5. Ressourcen in `destroy()` freigeben.
6. Direkte Imports aus `electron/core/...` entfernen.
7. Renderer-Code auf `window.api` und `window.pluginAPI` begrenzen.
8. Event-Namen zentral halten und nicht im Plugin verstreuen.
9. Fehler in externen Clients selbst abfangen.
10. Plugin per Toggle testen: aktivieren, deaktivieren, erneut aktivieren.

## Migration des Core-Systems

Die Runtime selbst sollte in kleinen Schritten migriert werden.

### Schritt 1: Manifest-Laden isolieren

`PluginLoader` sollte nur lesen und validieren:

```javascript
const fs = require("fs");
const path = require("path");
const { validatePermissions } = require("./PluginPermissions");

function loadManifest(pluginPath) {
  const manifestPath = path.join(pluginPath, "plugin.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error("plugin.json fehlt");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  if (!manifest.id || !manifest.name) {
    throw new Error("plugin.json braucht mindestens id und name");
  }

  return {
    ...manifest,
    permissions: validatePermissions(manifest.permissions || [])
  };
}

module.exports = {
  loadManifest
};
```

Wichtig: In der aktuellen Datei steht `manifesst.json`; das sollte beim Umbau zu `plugin.json` korrigiert werden.

### Schritt 2: Config aus Manager herausziehen

Der Aktivierungsstatus liegt heute in `plugins/plugins.json`.

Ziel:

```javascript
class PluginConfig {
  constructor(configPath) {
    this.configPath = configPath;
  }

  isEnabled(pluginId) {
    const config = this.read();
    return config.plugins?.[pluginId]?.enabled !== false;
  }

  setEnabled(pluginId, enabled) {
    const config = this.read();
    config.plugins ||= {};
    config.plugins[pluginId] ||= {};
    config.plugins[pluginId].enabled = enabled;
    this.write(config);
  }
}
```

Dadurch muss `PluginManager` nicht mehr wissen, wie JSON-Dateien geschrieben werden.

### Schritt 3: PluginManager als Orchestrator

Zielbild:

```javascript
class PluginManager {
  constructor({ loader, config, apiFactory, eventBus }) {
    this.loader = loader;
    this.config = config;
    this.apiFactory = apiFactory;
    this.eventBus = eventBus;
    this.plugins = new Map();
  }

  loadPlugin(pluginPath) {
    const manifest = this.loader.loadManifest(pluginPath);

    if (!this.config.isEnabled(manifest.id)) {
      return;
    }

    const instance = this.loader.loadMain(pluginPath, manifest);
    const context = this.apiFactory.create(manifest);

    if (typeof instance.init === "function") {
      instance.init(context);
    }

    this.plugins.set(manifest.id, {
      manifest,
      instance,
      pluginPath
    });
  }

  disablePlugin(id) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    if (typeof plugin.instance.destroy === "function") {
      plugin.instance.destroy();
    }

    this.plugins.delete(id);
    this.config.setEnabled(id, false);
  }
}
```

Der Manager koordiniert nur noch, waehrend Loader, Config und API eigene Verantwortlichkeiten haben.

### Schritt 4: Event-Namen stabilisieren

Alte Hook-Namen sollten weiter funktionieren, intern aber auf stabile Events gemappt werden:

```javascript
const HOOK_EVENTS = {
  onMetadata: "metadata",
  onStationChange: "station:change",
  onPlay: "player:play",
  onStop: "player:stop",
  onVolumeChange: "player:volume-change",
  onThemeChange: "theme:change"
};
```

Fuer eine Uebergangsphase kann der Core beide Namen senden:

```javascript
eventBus.emit("stationchange", station);
eventBus.emit("station:change", station);
```

Sobald `apiVersion` greift, kann die Version entscheiden, welche Event-Namen ein Plugin bekommt.

## Permissions

`PluginPermissions.js` kennt aktuell:

```javascript
const VALID_PERMISSIONS = [
  "events",
  "storage",
  "settings",
  "theme",
  "ui"
];
```

Empfohlene Bedeutung:

| Permission | Zugriff |
| --- | --- |
| `events` | EventBus lesen oder Events senden |
| `storage` | PluginStorage nutzen |
| `settings` | Plugin-eigene Einstellungen lesen/schreiben |
| `theme` | Theme-bezogene Daten lesen oder reagieren |
| `ui` | Renderer-Erweiterungen registrieren |

Im Zielsystem sollte `PluginAPI.create(meta)` nur die API-Bereiche freigeben, die im Manifest deklariert sind.

```javascript
function create(meta) {
  const permissions = new Set(meta.permissions || []);
  const api = { plugin: meta };

  if (permissions.has("events")) {
    api.events = createEventsApi(meta);
  }

  if (permissions.has("storage")) {
    api.storage = createStorageApi(meta);
  }

  return api;
}
```

## Fehlerbehandlung

Plugins duerfen die App nicht mit in den Fehlerzustand ziehen. Deshalb:

- Externe SDKs immer mit `.catch()` oder `try/catch` absichern.
- `destroy()` defensiv schreiben.
- Beim Deaktivieren auch halb gestartete Ressourcen aufraeumen.
- Keine Fehler verschlucken, sondern mit Plugin-ID loggen.

```javascript
module.exports = {
  async init(context) {
    this.context = context;

    try {
      await startExternalClient();
    } catch (err) {
      console.error(`[${context.plugin.id}] Client konnte nicht starten`, err);
    }
  },

  async destroy() {
    try {
      await stopExternalClient();
    } catch (err) {
      console.error("[meinPlugin] Cleanup fehlgeschlagen", err);
    }
  }
};
```

## Entwicklungsworkflow

1. Plugin-Ordner unter `plugins/` anlegen.
2. `plugin.json` schreiben.
3. `plugin.js` mit `init(context)` und `destroy()` bauen.
4. Optional `renderer.js` registrieren.
5. App mit `npm start` starten.
6. Einstellungen oeffnen und Plugin toggeln.
7. Console-Logs im Main- und Renderer-Prozess pruefen.
8. Deaktivieren und erneut aktivieren.
9. App neu starten und Persistenz pruefen.

## Regeln fuer neue Plugins

- Keine direkten Imports aus `electron/core/*`.
- Keine Annahmen ueber interne Dateipfade ausser dem eigenen Plugin-Ordner.
- Manifest-ID stabil halten.
- `apiVersion` setzen.
- `permissions` setzen.
- `init(context)` akzeptieren, aber auch ohne Context nicht crashen.
- `destroy()` immer implementieren.
- Renderer-Code ohne Node.js-Abhaengigkeiten schreiben.
- Fuer UI nur dokumentierte Slots oder stabile DOM-Anker nutzen.

## Bekannte technische Schulden

Diese Punkte sollten beim Ausbau des neuen Systems beachtet werden:

| Bereich | Hinweis |
| --- | --- |
| alter Manager | `init()` wird im aktuellen Code mehrfach geprueft; beim Refactoring nur einmal ausfuehren |
| alter Manager | `destroy()`-Branches enthalten doppelte Bedingung |
| `PluginLoader` | sucht aktuell `manifesst.json`, Ziel ist `plugin.json` |
| `PluginAPI` | `storage.exists()` referenziert aktuell `storage`, sollte `PluginStorage` nutzen |
| Renderer Listener | einige Bridge-Listener haben noch keine Unsubscribe-Funktion |
| Permissions | werden vorbereitet, aber noch nicht konsequent erzwungen |
| Event-Namen | alte lowercase Events und neue namespaced Events muessen gemappt werden |

## Zielbild fuer v1.2+

Ein Plugin der stabilen API sollte langfristig so aussehen:

```javascript
module.exports = {
  async activate(api) {
    api.logger.info("Plugin aktiv");

    api.events.on("player:metadata", (meta) => {
      api.storage.set("lastTitle", meta.StreamTitle);
    });
  },

  async deactivate(api) {
    api.logger.info("Plugin inaktiv");
  }
};
```

Der Unterschied zum alten System:

- Lifecycle heisst klar `activate` und `deactivate`.
- Zugriff laeuft nur ueber `api`.
- Events haben stabile, namespaced Namen.
- Storage, Settings und UI sind permission-basiert.
- Die Runtime entscheidet anhand von `apiVersion`, welche Kompatibilitaet gilt.

Bis dieses Zielsystem voll umgesetzt ist, sollten Plugins so geschrieben werden, dass sie heute mit `init/destroy` funktionieren und spaeter leicht auf `activate/deactivate` umgestellt werden koennen.
