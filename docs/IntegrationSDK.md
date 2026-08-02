# Integration SDK

WebRadio besitzt ein modernes Plugin-System. Neben Community-Plugins gibt es auch **offizielle Integrationen**, die von WebRadio selbst entwickelt, ausgeliefert und gepflegt werden.

---

# Unterschied: Integration vs Plugin

## Integrationen

- **Offiziell**: Von WebRadio entwickelt
- **Bestandteil des Projekts**: Im Repository unter `integrations/`
- **Automatisch verfügbar**: Werden mit der App ausgeliefert
- **Aktivierbar/Deaktivierbar**: Zur Laufzeit ein-/ausschaltbar
- **PluginAPI**: Nutzen dieselbe PluginAPI wie Plugins
- **Events**: Erhalten dieselben Events wie Plugins

**Beispiele:**
- YouTube
- YouTube Music
- Discord Rich Presence
- Podcasts

## Community Plugins

- **Extern**: Von Drittanbietern entwickelt
- **Marketplace**: Über Plugin-Marketplace verteilt
- **Manuell installierbar**: Benutzer installieren Plugins selbst
- **PluginAPI**: Nutzen dieselbe PluginAPI wie Integrationen

---

# Architektur

Integrationen nutzen dieselbe Runtime wie Plugins:

```text
electron/
    core/
        plugins/
            PluginManager.js
            PluginRuntime.js
            PluginAPI.js
            PluginLoader.js
        integrations/
            IntegrationManager.js
            IntegrationLoader.js

integrations/
    youtube/
    discord-rpc/
    podcasts/

plugins/
    ...
```

**Wichtig:** Es existiert nur eine Erweiterungsarchitektur. Integrationen und Plugins nutzen dieselben Komponenten:

- **PluginRuntime**: Lifecycle-Management
- **PluginAPI**: Offizielle Schnittstelle
- **Logger**: Logging
- **EventBus**: Event-Kommunikation

Es gibt **kein zweites Runtime-System**.

---

# Integration Manifest

Jede Integration benötigt ein `manifest.json` im Wurzelverzeichnis:

```json
{
  "id": "youtube",
  "name": "YouTube",
  "type": "integration",
  "version": "1.0.0",
  "author": "WebRadio Team",
  "description": "YouTube Integration für WebRadio",
  "entry": "index.js",
  "renderer": "renderer.js"
}
```

### Manifest-Felder

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `id` | string | ✅ | Eindeutige ID der Integration |
| `name` | string | ✅ | Anzeigename |
| `type` | string | ✅ | Muss `"integration"` sein |
| `version` | string | ✅ | SemVer-Version |
| `author` | string | ✅ | Autor (z.B. "WebRadio Team") |
| `description` | string | ❌ | Beschreibung der Integration |
| `entry` | string | ✅ | Einstiegsdatei (Main-Process) |
| `renderer` | string | ❌ | Renderer-Script (optional) |

---

# Integration Lifecycle

## Initialisierung

```javascript
module.exports = {
  context: null,

  init(context) {
    this.context = context;
    const logger = context.logger("MyIntegration");

    // Initialisiere Storage
    if (!context.storage.exists()) {
      context.storage.set("initialized", true);
    }

    // Registriere Event-Listener
    context.events.on("play", this.handlePlay.bind(this, context));
    context.events.on("stop", this.handleStop.bind(this, context));
    context.events.on("metadata", this.handleMetadata.bind(this, context));

    logger.info("Integration initialized");
  },

  handlePlay(context, data) {
    const logger = context.logger;
    logger.debug("Play event received");
  },

  handleStop(context) {
    const logger = context.logger;
    logger.debug("Stop event received");
  },

  handleMetadata(context, data) {
    const logger = context.logger;
    logger.debug("Metadata event received");
  },

  destroy() {
    const logger = this.context.logger;
    
    // Cleanup
    logger.info("Integration destroyed");
    this.context = null;
  }
};
```

## Event-Handler

Event-Handler erhalten den `context` als zweiten Parameter:

```javascript
handlePlay(data, context) {
  const logger = context.logger;
  context.storage.set("lastPlay", data);
}
```

### Verfügbare Events

- `play`: Wiedergabe gestartet
- `stop`: Wiedergabe gestoppt
- `metadata`: Metadaten aktualisiert
- `volumechange`: Lautstärke geändert
- `themechange`: Theme geändert
- `stationchange`: Sender gewechselt

---

# Plugin API

Integrationen nutzen **ausschließlich** die bestehende PluginAPI.

## Logger

```javascript
const logger = context.logger("MyComponent");

logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message");
```

## Events

```javascript
// Event abonnieren
context.events.on("play", handler);

// Einmaliger Event-Listener
context.events.once("ready", handler);

// Event abmelden
context.events.off("play", handler);

// Event emittieren
context.events.emit("customEvent", { key: "value" });
```

## Storage

```javascript
// Prüfen ob Storage existiert
if (!context.storage.exists()) {
  context.storage.set("initialized", true);
}

// Wert lesen
const value = context.storage.get("myKey");

// Wert setzen
context.storage.set("myKey", "myValue");

// Kompletten Storage lesen
const data = context.storage.read();

// Kompletten Storage schreiben
context.storage.write({ key: "value" });
```

## Settings

```javascript
// Globale Einstellung lesen
const theme = context.settings.get("theme");

// Globale Einstellung setzen
context.settings.set("theme", "dark");
```

---

# Wichtige Architekturvorgabe

## Integrationen besitzen KEINE öffentliche API

Integrationen sind ausschließlich interne Bestandteile von WebRadio.

- **Keine IntegrationAPI**: Es darf keine öffentliche API für Integrationen geben
- **Keine öffentlichen Interfaces**: Integrationen exportieren keine Klassen oder Services
- **Keine Abhängigkeiten zwischen Integrationen**: Jede Integration ist vollständig eigenständig

## Zugriff auf den Core

Integrationen kommunizieren ausschließlich über die PluginAPI:

- ✅ Logger
- ✅ EventBus
- ✅ Settings
- ✅ Storage
- ✅ Notifications
- ✅ Player
- ✅ Window
- ✅ Dialoge

❌ **Direkte Core-Imports sind nicht erlaubt**

```javascript
// ❌ VERBOTEN
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");
const eventBus = require("../../electron/core/eventBus");

// ✅ KORREKT
module.exports = {
  init(context) {
    const logger = context.logger("MyComponent");
    context.events.on("play", handler);
  }
};
```

## Zugriff durch Community-Plugins

Community-Plugins dürfen **nicht** auf Integrationen zugreifen:

- ❌ `integrationAPI`
- ❌ `window.integrations`
- ❌ `pluginAPI.integrations`
- ❌ Importieren einer Integration
- ❌ Nutzung interner Klassen einer Integration

Die einzige Kommunikationsmöglichkeit bleibt die PluginAPI und der EventBus.

---

# Projektstruktur

```
integrations/
    youtube/
        manifest.json
        index.js
        renderer.js
        assets/
    discord-rpc/
        manifest.json
        index.js
    podcasts/
        manifest.json
        index.js
```

---

# Best Practices

✔ **Nur die PluginAPI verwenden** – Keine direkten Core-Imports

✔ **Logger verwenden** – Kein `console.log()`

✔ **Storage für Integrations-Daten** – Settings nur für globale Konfiguration

✔ **Listener cleanup** – Im `destroy()` Hook entfernen

✔ **Fehlerbehandlung** – Try-Catch um kritische Operationen

✔ **Keine öffentlichen APIs** – Integrationen sind intern

✔ **Keine Abhängigkeiten** – Jede Integration ist eigenständig

---

# Deprecation

Direkte Importe aus dem Core sind deprecated und werden in Zukunft entfernt.

### Deprecation-Warnungen

Der IntegrationManager gibt Warnungen aus, wenn deprecated Importe erkannt werden.

```javascript
// ❌ VERALTET
const LogManager = require("../../electron/core/diagnostics/logging/LogManager");

// ✅ KORREKT
const logger = context.logger("MyComponent");
```

---

# Konfiguration

Integrationen werden über `userData/integrations/integrations.json` konfiguriert:

```json
{
  "integrations": {
    "youtube": {
      "enabled": true
    },
    "discord-rpc": {
      "enabled": false
    }
  }
}
```

Integrationen können zur Laufzeit ein- und ausgeschaltet werden ohne Neustart.

---

# Renderer Scripts

Integrationen können optionale Renderer-Scripts bereitstellen:

```json
{
  "renderer": "renderer.js"
}
```

Das Renderer-Script wird im Renderer-Prozess geladen und kann UI-Elemente hinzufügen.

---

# Beispiel: Vollständige Integration

```javascript
module.exports = {
  context: null,

  init(context) {
    this.context = context;
    const logger = context.logger("MyIntegration");

    // Initialisiere Storage
    if (!context.storage.exists()) {
      context.storage.set("initialized", true);
      context.storage.set("counter", 0);
    }

    // Registriere Event-Listener
    context.events.on("play", this.handlePlay.bind(this, context));
    context.events.on("stop", this.handleStop.bind(this, context));

    logger.info("Integration initialized");
  },

  handlePlay(context, data) {
    const logger = context.logger;
    const counter = context.storage.get("counter") || 0;
    
    context.storage.set("counter", counter + 1);
    logger.info(`Play count: ${counter + 1}`);
  },

  handleStop(context) {
    const logger = context.logger;
    logger.debug("Playback stopped");
  },

  destroy() {
    const logger = this.context.logger;
    
    // Cleanup
    logger.info("Integration destroyed");
    this.context = null;
  }
};
```

---

# Zusammenfassung

- Integrationen sind offizielle WebRadio-Komponenten
- Sie nutzen dieselbe PluginAPI und Runtime wie Plugins
- Es existiert nur eine Erweiterungsarchitektur
- Integrationen besitzen keine öffentliche API
- Community-Plugins können nicht auf Integrationen zugreifen
- Die Kommunikation erfolgt ausschließlich über PluginAPI und EventBus
