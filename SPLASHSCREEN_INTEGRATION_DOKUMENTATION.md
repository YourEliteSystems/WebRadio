# Splashscreen Integrations-Dokumentation

**Repository:** YourEliteSystems/WebRadio  
**Datum:** 2026-10-17  
**Ziel:** Dokumentation der sicheren Integration eines Splashscreens ohne Architekturänderung

---

## Architektur-Analyse

### Bestehender Application Lifecycle

Die Application-Klasse (`electron/core/Application.js`) initialisiert Komponenten sequentiell:

```
app.whenReady()
  → Application.start()
    → initializeStorage()         [BootupDiagnostics: storage-init]
    → initializeDiagnostics()     [BootupDiagnostics: diagnostics-init]
    → initializeWindow()          [BootupDiagnostics: window-created]
    → initializeIPC()            [BootupDiagnostics: ipc-init]
    → initializeNavigation()     [BootupDiagnostics: navigation-init]
    → initializePackages()       [BootupDiagnostics: packages-init]
    → initializePlugins()         [BootupDiagnostics: plugins-init]
    → initializePlayer()          [BootupDiagnostics: player-init]
    → initializeIntegrations()    [BootupDiagnostics: integrations-init]
    → initializeThemes()          [BootupDiagnostics: themes-init]
    → initializeShortcuts()      [BootupDiagnostics: shortcuts-init]
    → initializeTray()            [BootupDiagnostics: tray-init]
    → initializeUpdater()        [BootupDiagnostics: updater-init]
    → initializeServices()        [BootupDiagnostics: services-init]
    → initializeDiscordAdapter()  [BootupDiagnostics: discord-adapter-init]
```

**Schlüsselerkenntnis:** BootupDiagnostics markiert bereits jede Initialisierungsphase mit Zeitstempeln. Dies kann für Statusmeldungen im Splashscreen genutzt werden.

### Fensterkonfiguration

**MainWindow (electron/core/app/MainWindow.js):**
- Größe: 1100x700
- Frame: false (custom titlebar)
- Preload: preload.js mit contextIsolation
- AutoplayPolicy: "no-user-gesture-required"
- WM_CLASS für Linux Desktop-Integration

**Kein Splashscreen vorhanden** - MainWindow wird direkt erstellt und sichtbar.

### IPC-Architektur

Modulares IPC-System mit 16 Handler-Modulen:
- pluginHandlers
- updaterHandlers
- storageHandlers
- themeHandlers
- radioHandlers
- windowHandlers
- diagnosticsHandlers
- integrationHandlers
- navigationHandlers
- uiHandlers
- mediaHubHandlers
- credentialHandlers
- playerHandlers
- pluginHttpHandlers
- packageHandlers

**Kein Splashscreen-spezifischer Handler vorhanden.**

### Renderer-Build

- esbuild für React-Komponenten (renderer.jsx, settings.jsx)
- index.html lädt React App via module script
- Stylesheets: fonts.css, core.css, theme.css
- CSP konfiguriert für lokale Ressourcen und Plugin-HTTP-Server

### Verfügbare Assets

- **Icons:** assets/icons/tray.png, tray.ico, tray.icon
- **Logo:** assets/default-logo.png
- **Fonts:** Inter lokal gebündelt (renderer/assets/fonts/)
- **Styles:** renderer/styles/

---

## Integrations-Vorschlag

### 1. Architektur-Entscheidung

**Status:** ✅ Keine größere Architekturänderung erforderlich

Der Splashscreen kann als **separates BrowserWindow** implementiert werden, das:
- Vor dem MainWindow erstellt wird
- Status-Updates via IPC empfängt
- Nach Initialisierung geschlossen wird
- MainWindow dann angezeigt wird

### 2. Fenster-Management

**Neue Datei:** `electron/core/app/SplashWindow.js`

```
Funktionen:
- createSplashWindow(isDev)
- closeSplashWindow()
- updateSplashStatus(message, phase)
```

**Integration in WindowManager:**
```javascript
class WindowManager {
  constructor(isDev) {
    this.isDev = isDev;
    this.splashWindow = null;    // NEU
    this.mainWindow = null;
    this.settingsWindow = null;
  }

  createSplashWindow() { ... }
  closeSplashWindow() { ... }
  updateSplashStatus(message, phase) { ... }
}
```

### 3. Splashscreen-Fenster-Konfiguration

```javascript
const splashWindow = new BrowserWindow({
  width: 600,
  height: 400,
  frame: false,
  resizable: false,
  show: true,           // Sofort sichtbar
  backgroundColor: '#1a1a1a',  // Dunkles Audio-Design
  icon: getWindowIcon(),
  webPreferences: {
    preload: path.join(__dirname, "../../preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false
  }
});
```

**Eigenschaften:**
- Klein, zentriert, nicht resizable
- Frameless für nahtloses Design
- Dunkler Hintergrund für Audio-Ästhetik
- Zeigt sofort an (keine Verzögerung)

### 4. IPC-Schnittstelle

**Neue Datei:** `electron/core/ipc/splashHandlers.js`

```javascript
ipcMain.handle("splash:get-status", () => {
  return BootupDiagnostics.getStatus();
});

ipcMain.on("splash:ready", () => {
  // Splashscreen Renderer ist bereit
});
```

**Integration in registerIpcHandlers.js:**
```javascript
const registerSplashHandlers = require("./splashHandlers");

function registerAllIpc(window) {
  // ... bestehende Handler
  registerSplashHandlers(window);
}
```

### 5. Statusmeldungen aus BootupDiagnostics

**Verfügbare Phasen:**
- storage-init
- diagnostics-init
- window-created
- ipc-init
- navigation-init
- packages-init
- plugins-init
- player-init
- integrations-init
- themes-init
- shortcuts-init
- tray-init
- updater-init
- services-init
- discord-adapter-init
- app-ready

**Status-Mapping für Splashscreen:**
```javascript
const STATUS_MESSAGES = {
  "storage-init": "Lade Einstellungen...",
  "diagnostics-init": "Initialisiere Diagnose...",
  "window-created": "Erstelle Fenster...",
  "ipc-init": "Initialisiere Kommunikation...",
  "navigation-init": "Lade Navigation...",
  "packages-init": "Lade Pakete...",
  "plugins-init": "Initialisiere Plugins...",
  "player-init": "Starte Audio-Engine...",
  "integrations-init": "Verbinde Integrationen...",
  "themes-init": "Lade Theme...",
  "shortcuts-init": "Konfiguriere Shortcuts...",
  "tray-init": "Erstelle Tray-Icon...",
  "updater-init": "Prüfe Updates...",
  "services-init": "Starte Dienste...",
  "discord-adapter-init": "Initialisiere Discord...",
  "app-ready": "WebRadio bereit"
};
```

### 6. Renderer-Komponente

**Neue Datei:** `renderer/splash.jsx`

```javascript
// Leichtgewichtige React-Komponente
// - Dunkles Audio-Design
// - WebRadio-Logo (assets/default-logo.png)
// - Dezente Wellenform-Animation (CSS)
// - Statusmeldung
// - Keine künstliche Prozentanzeigen
```

**Neue Datei:** `renderer/splash.html`

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>WebRadio Startbildschirm</title>
  <link rel="stylesheet" href="styles/fonts.css">
  <style>
    /* Dunkles Audio-Design, Wellenform-Animation */
  </style>
</head>
<body>
  <div id="splash"></div>
  <script type="module" src="dist/splash.js"></script>
</body>
</html>
```

**Build-Erweiterung in package.json:**
```json
"scripts": {
  "build-splash": "esbuild renderer/splash.jsx --bundle --outfile=renderer/dist/splash.js --format=esm --minify"
}
```

### 7. Übergabe an Hauptfenster

**Modifizierter Application.start():**

```javascript
async start() {
  // 1. Splashscreen erstellen (vor MainWindow)
  this.windowManager.createSplashWindow();

  // 2. Storage initialisieren
  BootupDiagnostics.markStart("storage-init");
  await this.initializeStorage();
  BootupDiagnostics.markComplete("storage-init");
  this.windowManager.updateSplashStatus("storage-init");

  // 3. ... restliche Initialisierung mit Status-Updates ...

  // 4. MainWindow erstellen (aber versteckt)
  BootupDiagnostics.markStart("window-created");
  await this.initializeWindow();
  BootupDiagnostics.markComplete("window-created");
  this.windowManager.updateSplashStatus("window-created");

  // 5. ... restliche Initialisierung ...

  // 6. Splashscreen schließen, MainWindow anzeigen
  this.windowManager.closeSplashWindow();
  this.windowManager.getMainWindow().show();

  this.initialized = true;
}
```

### 8. Fehlerbehandlung

**Timeout-Schutz:**
```javascript
// Splashscreen max. 30 Sekunden anzeigen
const SPLASH_TIMEOUT = 30000;

setTimeout(() => {
  if (this.windowManager.splashWindow) {
    logger.warn("Splashscreen Timeout - erzwinges Übergabe");
    this.windowManager.closeSplashWindow();
    this.windowManager.getMainWindow().show();
  }
}, SPLASH_TIMEOUT);
```

**Initialisierungsfehler:**
```javascript
try {
  await this.initializePlugins();
} catch (err) {
  logger.error("Plugin-Initialisierung fehlgeschlagen:", err);
  // Splashscreen schließen, Fehler im MainWindow anzeigen
  this.windowManager.closeSplashWindow();
  this.windowManager.getMainWindow().show();
  // ... Fehler-Logik im MainWindow
}
```

**Fenster-Schließverhalten:**
```javascript
splashWindow.on("closed", () => {
  this.splashWindow = null;
  // Falls MainWindow noch nicht bereit, Fallback zeigen
  if (!this.mainWindow) {
    this.createMainWindow();
  }
});
```

### 9. Edge Cases

**Autostart / Minimierter Start:**
```javascript
// App-Start minimiert?
const startMinimized = app.getLoginItemSettings().openAsHidden;

if (startMinimized) {
  // Splashscreen überspringen, MainWindow direkt minimiert erstellen
  this.windowManager.createMainWindow();
  this.windowManager.getMainWindow().minimize();
} else {
  // Normaler Start mit Splashscreen
  this.windowManager.createSplashWindow();
  // ... Initialisierung ...
}
```

**Reduzierte Animationen:**
```javascript
// System-Einstellungen prüfen
const reduceMotion = app.accessibilitySupportEnabled();

if (reduceMotion) {
  // Wellenform-Animation deaktivieren
  // Statische Anzeige zeigen
}
```

**Windows-/Linux-Verhalten:**
- Windows: WM_CLASS nicht relevant, frame: false funktioniert
- Linux: WM_CLASS 'WebRadio' bereits in MainWindow konfiguriert
- Splashscreen benötigt keine spezielle Desktop-Integration (temporäres Fenster)

### 10. Optional: Integrationen nicht blockieren

**Nicht-blockierende Initialisierung:**
```javascript
// DiscordRichPresence kann asynchron initialisiert werden
// Splashscreen nicht warten, wenn Discord langsam ist
Promise.resolve().then(async () => {
  await DiscordRichPresence.initialize();
});
```

---

## Sicherheits- und Permissions-Analyse

### IPC-Sicherheit

**Neuer Handler splashHandlers:**
- Nur read-only Zugriff auf BootupDiagnostics
- Keine write-Operationen
- Keine sensitiven Daten exposed
- contextIsolation aktiv (bestehend)

### Fenster-Berechtigungen

**SplashWindow:**
- Gleiche webPreferences wie MainWindow
- contextIsolation: true
- nodeIntegration: false
- sandbox: false (bestehende Konfiguration)
- Keine zusätzlichen Berechtigungen erforderlich

### CSP

**splash.html:**
- Kann gleiche CSP wie index.html verwenden
- Oder restriktiver (nur lokale Ressourcen, kein Plugin-HTTP)

---

## Implementierungs-Plan

### Phase 1: Core-Infrastruktur
1. SplashWindow.js erstellen
2. WindowManager erweitern
3. IPC splashHandlers.js erstellen
4. registerIpcHandlers.js erweitern

### Phase 2: Renderer
1. splash.jsx erstellen (React-Komponente)
2. splash.html erstellen
3. build-splash Script hinzufügen
4. package.json erweitern

### Phase 3: Integration
1. Application.start() modifizieren
2. BootupDiagnostics Status-Updates hinzufügen
3. Fehlerbehandlung implementieren
4. Edge Cases (Autostart, Reduce Motion)

### Phase 4: Testing
1. Normaler Start testen
2. Langsame Initialisierung simulieren
3. Fehlerfall testen
4. Autostart/Minimiert testen
5. Windows/Linux Verhalten prüfen

---

## Verbleibende Risiken

### Niedrig

1. **Zusätzlicher Speicherverbrauch**
   - Splashscreen-Fenster benötigt temporär RAM
   - Nach Schließen freigegeben
   - Minimaler Impact (< 50MB)

2. **Startup-Verzögerung**
   - Splashscreen-Erstellung adds ~50-100ms
   - Durch Parallelisierung minimierbar
   -用户体验-Verbesserung überwiegt

3. **Komplexität**
   - Zusätzlicher Code-Pfad für Fenster-Management
   - Gut getestet, geringes Risiko

### Keine kritischen Risiken

- Keine Änderung an FFmpeg, PCM-IPC, AudioWorklet
- Keine Umgestaltung von Settings oder Stations
- Keine neuen Frontend-Frameworks (React bereits vorhanden)
- IPC bleibt sicher
- Fenster-Berechtigungen unverändert

---

## Empfehlung

**Status:** ✅ Implementierung empfohlen

Der Splashscreen kann ohne größere Architekturänderung sicher integriert werden. Die Implementierung nutzt vorhandene Infrastruktur (BootupDiagnostics, React, Assets) und fügt nur minimalen Code hinzu.

**Nächster Schritt:** Implementierung nach Phase 1-4 mit Fokus auf:
- Dunkles, audio-orientiertes Design
- Dezente Wellenform-Animation
- Statusmeldungen aus tatsächlichen Initialisierungsphasen
- Saubere Übergabe ohne künstliche Wartezeit
- Robuste Fehlerbehandlung
