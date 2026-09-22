# Plugin API

Die WebRadio Plugin API ist die einzige offizielle Schnittstelle zwischen Plugins und dem WebRadio Core.

Plugins dürfen niemals direkt auf Klassen innerhalb von `electron/core/`, `electron/main/` oder `renderer/` zugreifen.

---

# Zweck

Die Plugin API:

- **Kapselt** interne WebRadio-Komponenten
- **Stabilisiert** die Plugin-Schnittstelle
- **Ermöglicht** interne Refactorings ohne Plugin-Änderungen
- **Isoliert** Plugins von Core-Implementierungen

---

# Erhalt der API

Die Plugin API wird automatisch über den `context` Parameter an die `init()` Funktion übergeben.

```javascript
module.exports = {
  init(context) {
    // context enthält die vollständige Plugin API
    const logger = context.logger("MyComponent");
    const version = context.version;
  }
};
```

---

# API-Struktur (1.0.7-alpha.1)

```javascript
context = {
  plugin: {...},                  // Plugin-Metadaten
  version: {...},                 // Versionsinformationen
  logger: (context),              // Logger-Funktion
  events: {...},                  // EventBus-Wrapper
  storage: {...},                 // Plugin-spezifischer Speicher
  settings: {...},                // Globale Settings-Zugriff
  ui: {...},                      // UI-Registrierung
  navigation: {...},              // Navigation Extension API
  httpOrigin: {...},              // Plugin-HTTP-Ursprung (Capability-abhängig)
  player: {...}                   // Unified Player API (Berechtigung abhängig)
}
```

In dieser Version gibt es **keine** `context.hooks`, `context.commands`, `context.notifications` und `context.windows` als öffentliche Plugin-API.


---

# Logger

Plugins sollen Logging über die Plugin API durchführen, nicht über `console.log()`.

## loggercontext)

Erstellt einen Logger für einen spezifischen Kontext.

```javascript
const logger = context.logger("MyComponent");

logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message");
logger.fatal("Fatal error message");
```

### Log-Level

- **debug**: Detaillierte Debug-Informationen
- **info**: Allgemeine Informationen
- **warn**: Warnungen
- **error**: Fehler
- **fatal**: Kritische Fehler

### Best Practices

✔ Verwende spezifische Kontexte für verschiedene Komponenten

✔ Logge nur relevante Informationen

✔ Vermeide sensible Daten in Logs

---

# Events

Plugins können auf WebRadio-Events reagieren und eigene Events emittieren.

## events.on(event, callback)

Registriert einen Event-Listener.

```javascript
context.events.on("play", (data) => {
  context.logger.info("Playback started:", data);
});
```

## events.once(event, callback)

Registriert einen einmaligen Event-Listener.

```javascript
context.events.once("ready", () => {
  context.logger.info("Application ready");
});
```

## events.off(event, callback)

Entfernt einen Event-Listener.

```javascript
const handler = (data) => console.log(data);
context.events.on("play", handler);
// ...
context.events.off("play", handler);
```

## events.emit(event, payload)

Emittiert ein Event.

```javascript
context.events.emit("customEvent", { key: "value" });
```

### Verfügbare Core-Events (aktuell)

- `play`: Wiedergabe gestartet
- `stop`: Wiedergabe gestoppt
- `metadata`: Metadaten aktualisiert
- `volumechange`: Lautstärke geändert
- `themechange`: Theme geändert
- `stationchange`: Sender gewechselt

> **Hinweis:** Die Liste der verfügbaren Events kann sich zwischen Releases ändern. Plugins sollten sich nicht auf ein festes, nicht dokumentiertes Event-Menü verlassen.

### Best Practices

✔ Entferne Listener im `destroy()` Hook

✔ Vermeide synchrone schwere Operationen in Handlern

✔ Nutze `once()` für einmalige Events

---

# Storage

Plugin-spezifischer persistenter Speicher. Jedes Plugin hat einen isolierten Speicherbereich.

## storage.exists()

Prüft ob der Plugin-Speicher existiert.

```javascript
if (!context.storage.exists()) {
  // Initialisiere Standardwerte
  context.storage.set("initialized", true);
}
```

## storage.read()

Liest den kompletten Plugin-Speicher.

```javascript
const data = context.storage.read();
console.log(data); // { key1: value1, key2: value2 }
```

## storage.write(data)

Schreibt Daten in den Plugin-Speicher (überschreibt alles).

```javascript
context.storage.write({
  key1: "value1",
  key2: "value2"
});
```

## storage.delete()

Löscht den gesamten Plugin-Speicher.

```javascript
context.storage.delete();
```

## storage.get(key)

Liest einen spezifischen Wert.

```javascript
const value = context.storage.get("myKey");
```

## storage.set(key, value)

Setzt einen spezifischen Wert.

```javascript
context.storage.set("myKey", "myValue");
```

## storage.remove(key)

Entfernt einen spezifischen Wert.

```javascript
context.storage.remove("myKey");
```

## storage.has(key)

Prüft ob ein Schlüssel existiert.

```javascript
if (context.storage.has("myKey")) {
  // ...
}
```

### Speicherort

Der Plugin-Speicher wird automatisch im userData-Verzeichnis verwaltet:

```
userData/plugins/{pluginId}.json
```

Plugins müssen keine Pfade kennen.

### Best Practices

✔ Verwende `get/set` für einzelne Werte

✔ Verwende `read/write` nur für komplette Speicher-Operationen

✔ Strukturiere Daten sinnvoll

---

# Settings

Zugriff auf globale WebRadio-Einstellungen.

## settings.get(key)

Liest eine globale Einstellung.

```javascript
const theme = context.settings.get("theme");
```

## settings.set(key, value)

Setzt eine globale Einstellung.

```javascript
context.settings.set("theme", "dark");
```

## settings.has(key)

Prüft ob eine Einstellung existiert.

```javascript
if (context.settings.has("theme")) {
  // ...
}
```

## settings.delete(key)

Löscht eine globale Einstellung.

```javascript
context.settings.delete("customKey");
```

> **Hinweis:** In WebRadio 1.0.7-alpha.1 gibt es **keine** `settings.reset()`, `settings.resetAll()` und `settings.getDefaults()` als öffentliche Plugin-API.

### Best Practices

✔ Verwende Settings nur für globale Konfiguration

✔ Verwende Storage für plugin-spezifische Daten

✔ Dokumentiere welche Settings dein Plugin nutzt

---

# UI and Navigation

Plugins können über `context.ui` und `context.navigation` UI-Elemente und Sidebar-Einträge registrieren, sofern sie die erforderlichen Berechtigungen haben.

## ui.register(item)

Registriert ein UI-Element.

```javascript
context.ui.register({
  id: "my-plugin-view",
  type: "view",
  name: "My Plugin",
  renderFn: () => {
    const container = document.createElement("div");
    container.textContent = "Hello from Plugin";
    return container;
  }
});
```

## ui.unregister(id)

Entfernt ein UI-Element.

```javascript
context.ui.unregister("my-plugin-view");
```

## Navigation Extension API

Plugins mit der Berechtigung `navigation` können über `context.navigation` Sidebar-Sektionen und -Items registrieren.

```javascript
context.navigation.registerSection({
  id: "my-tools",
  label: "Werkzeuge",
  icon: "tools",
  collapsible: true,
  expanded: true,
  order: 10,
  visible: true
});

context.navigation.registerItem({
  id: "my-converter",
  parent: "my-tools",
  label: "Konverter",
  icon: "exchange",
  route: "my-converter",
  order: 1
});
```

### UI-Element-Typen (aktuell)

- `view`: Vollständige Seite
- `sidebar-item`: Sidebar-Eintrag
- `toolbar-button`: Toolbar-Button

### Best Practices

✔ Entferne UI- und Navigationsregistrierungen sauber

✔ Verwende eindeutige IDs

✔ Integriere dich in das Theme-System

---

# Version

Versionsinformationen für Kompatibilitätsprüfungen.

## context.version

```javascript
{
  pluginAPI: "1.1.0",
  application: "1.0.7-alpha.1"
}
```

### Beispiel: Kompatibilitätsprüfung

```javascript
const requiredAPI = "1.1.0";
const currentAPI = context.version.pluginAPI;

if (currentAPI !== requiredAPI) {
  context.logger.warn(
    `Plugin API version mismatch. Required: ${requiredAPI}, Current: ${currentAPI}`
  );
}
```

> **Hinweis:** Die `application`-Angabe ist derzeit der Core-Build-Stand und kann sich zwischen Releases ändern. Plugins sollten sich bei Kompatibilitätsprüfungen primär auf `pluginAPI` stützen.


---

# Plugin-Metadaten

## context.plugin

Enthält die Informationen aus `plugin.json`:

```javascript
{
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  author: "Author Name",
  description: "Plugin description",
  main: "main.js",
  renderer: "renderer.js"
}
```

---

# Vollständiges Beispiel

```javascript
module.exports = {
  context: null,

  init(context) {
    this.context = context;
    const logger = context.logger("Main");

    // Initialisiere Storage
    if (!context.storage.exists()) {
      context.storage.set("initialized", true);
      context.storage.set("counter", 0);
    }

    // Registriere Event-Listener
    context.events.on("play", this.handlePlay.bind(this));
    context.events.on("stop", this.handleStop.bind(this));

    // Registriere UI
    context.ui.register({
      id: "my-plugin-view",
      type: "view",
      name: "My Plugin",
      renderFn: this.createView.bind(this)
    });

    logger.info("Plugin initialized");
  },

  handlePlay(data, context) {
    const logger = context.logger;
    const counter = context.storage.get("counter") || 0;
    
    context.storage.set("counter", counter + 1);
    logger.info(`Play count: ${counter + 1}`);
  },

  handleStop(context) {
    const logger = context.logger;
    logger.debug("Playback stopped");
  },

  createView() {
    const container = document.createElement("div");
    container.textContent = "My Plugin View";
    return container;
  },

  destroy() {
    const logger = this.context.logger;
    
    // Cleanup
    this.context.ui.unregister("my-plugin-view");
    
    logger.info("Plugin destroyed");
  }
};
```

---

# Best Practices

✔ **Nur die Plugin API verwenden** - Keine direkten Core-Imports

✔ **Logger verwenden** - Kein `console.log()`

✔ **Storage für Plugin-Daten** - Settings nur für globale Konfiguration

✔ **Listener cleanup** - Im `destroy()` Hook entfernen

✔ **Fehlerbehandlung** - Try-Catch um kritische Operationen

✔ **Versionsprüfung** - Bei API-Änderungen prüfen

---

# Deprecation

Direkte Importe aus dem Core sind deprecated und werden in Zukunft entfernt.

### Deprecated Importe

```javascript
// ❌ VERALTET - Nicht verwenden
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
const eventBus = require("../../electron/core/eventBus");
const SettingsManager = require("../../electron/core/storage/SettingsManager");
```

### Korrekte Verwendung

```javascript
// ✅ KORREKT - Plugin API verwenden
module.exports = {
  init(context) {
    const logger = context.logger("MyComponent");
    context.events.on("play", handler);
    const settings = context.settings.get("key");
  }
};
```

### Deprecation-Warnungen

Der PluginManager gibt Warnungen aus, wenn deprecated Importe erkannt werden.

---

# Migration Guide (1.0.7-alpha.1)

Die Migration Guide-Beispiele zeigen die aktuelle Plugin-API-Oberfläche.

Sie ersetzen keine reine Code-Referenz. Wenn sich die Plugin-API zwischen Releases ändert, gilt die aktuelle Dokumentation in der API Reference und im Plugin SDK.

---

# Migration Guide

### Von LogManager zu Plugin API Logger

**Vorher:**
```javascript
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
const logger = LogManager.getLogger("MyPlugin");
```

**Nachher:**
```javascript
module.exports = {
  init(context) {
    const logger = context.logger("MyComponent");
  }
};
```

### Von EventBus zu Plugin API Events

**Vorher:**
```javascript
const eventBus = require("../../electron/core/eventBus");
eventBus.on("play", handler);
```

**Nachher:**
```javascript
module.exports = {
  init(context) {
    context.events.on("play", handler);
  }
};
```

### Von StorageManager zu Plugin API Storage

**Vorher:**
```javascript
const PluginStorage = require("../../electron/core/plugins/PluginStorage");
const data = PluginStorage.read("myPlugin");
```

**Nachher:**
```javascript
module.exports = {
  init(context) {
    const data = context.storage.read();
  }
};
```

---

# Plugin-System Architektur

Das WebRadio Plugin-System besteht aus folgenden Komponenten:

## Komponenten

- **PluginManager** (`electron/core/plugins/PluginManager.js`)
  - Zentrale Verwaltung aller Plugins
  - Discovery, Loading, Lifecycle-Management
  - Config-Management (plugins.json)
  - Hot-Toggle zur Laufzeit

- **PluginLoader** (`electron/core/plugins/PluginLoader.js`)
  - Plugin-Discovery im userData/plugins Verzeichnis
  - Manifest-Loading (unterstützt plugin.json und manifest.json)
  - Validierung

- **PluginRuntime** (`electron/core/plugins/PluginRuntime.js`)
  - Plugin-Initialisierung und Shutdown
  - Event-Handler-Registrierung
  - Context-Injektion
  - Deprecation-Checks

- **PluginAPI** (`electron/core/plugins/PluginAPI.js`)
  - Offizielle Plugin-Schnittstelle
  - Logger, Events, Storage, Settings, UI
  - Version-Informationen

- **PluginContext** (`electron/core/plugins/PluginContext.js`)
  - Context-Erstellung für Plugins
  - Kapselt PluginAPI

## Plugin-Lifecycle

```text
1. Discovery
   PluginLoader.discoverPlugins()
   ↓
2. Validation
   PluginValidator.validate(manifest)
   ↓
3. Loading
   PluginManager.loadPlugins()
   ↓
4. Initialization
   PluginRuntime.start(plugin)
   → instance.init(context)
   → Event-Handler registrieren
   ↓
5. Runtime
   Event-Handler reagieren auf Events
   ↓
6. Shutdown
   PluginRuntime.stop(plugin)
   → instance.destroy()
   → Event-Handler entfernen
```

## Manifest-Formate

Der PluginLoader unterstützt beide Formate:

### plugin.json (altes Format)
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "main": "main.js",
  "renderer": "renderer.js"
}
```

### manifest.json (neues Format)
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "main": "main.js",
  "renderer": "renderer.js"
}
```

Beide Formate werden automatisch erkannt und geladen.

---

# Next Step

Weiter zu **Plugin Lifecycle** für Details zur Initialisierung und Deaktivierung.
