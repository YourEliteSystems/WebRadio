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

# API-Struktur

```javascript
context = {
  plugin: {...},        // Plugin-Metadaten
  version: {...},       // Versionsinformationen
  logger: (context),    // Logger-Funktion
  events: {...},        // EventBus-Wrapper
  storage: {...},       // Plugin-spezifischer Speicher
  settings: {...},      // Globale Settings-Zugriff
  ui: {...}            // UI-Registrierung
}
```

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

### Verfügbare Core-Events

- `play`: Wiedergabe gestartet
- `stop`: Wiedergabe gestoppt
- `metadata`: Metadaten aktualisiert
- `volumechange`: Lautstärke geändert
- `themechange`: Theme geändert
- `stationchange`: Sender gewechselt

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

### Best Practices

✔ Verwende Settings nur für globale Konfiguration

✔ Verwende Storage für plugin-spezifische Daten

✔ Dokumentiere welche Settings dein Plugin nutzt

---

# UI

Registrierung von UI-Elementen im WebRadio Interface.

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

### UI-Element-Typen

- `view`: Vollständige Seite
- `sidebar-item`: Sidebar-Eintrag
- `toolbar-button`: Toolbar-Button

### Best Practices

✔ Entferne UI-Elemente im `destroy()` Hook

✔ Verwende eindeutige IDs

✔ Integriere dich in das Theme-System

---

# Version

Versionsinformationen für Kompatibilitätsprüfungen.

## context.version

```javascript
{
  pluginAPI: "1.0.0",
  application: "1.1.0"
}
```

### Beispiel: Kompatibilitätsprüfung

```javascript
const requiredAPI = "1.0.0";
const currentAPI = context.version.pluginAPI;

if (currentAPI !== requiredAPI) {
  context.logger.warn(
    `Plugin API version mismatch. Required: ${requiredAPI}, Current: ${currentAPI}`
  );
}
```

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
