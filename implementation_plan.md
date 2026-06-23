# Modernisierung des Theme-Systems & Plugin-API-Design

Dieser Plan beschreibt die Modernisierung und Restrukturierung des Theme-Systems vor der geplanten Version 1.1 sowie das Architekturdesign für die zukünftige Plugin-API. Das Ziel ist es, das System wartbarer, robuster und erweiterbarer zu machen, ohne die bestehende Plugin-API in dieser Zwischenversion funktional zu brechen.

---

## Eingehaltene Architekturprinzipien

Während des gesamten Refactorings halten wir uns strikt an folgende Architekturregeln der WebRadio-Anwendung:

1. **Keine God Classes**: Jede Datei besitzt nur eine Hauptverantwortung (z. B. `ThemeLoader` für Verzeichnis/Datei-Operationen, `ThemeManager` für Zustandsverwaltung).
2. **Services statt Logik in IPC-Handlern**: IPC-Handler delegieren die Arbeit direkt an Services (z. B. `ThemeManager`). Sie führen selbst keine Business-Logik aus.
3. **WindowManager bleibt zentrale Instanz**: Kommunikation und Zustandsänderung zwischen Fenstern erfolgt ausschließlich über `WindowManager.broadcast()`, den `EventBus` oder IPC. Fenster kennen sich nicht gegenseitig.
4. **Themes dürfen nur Design verändern**: Themes modifizieren ausschließlich Farben, Schriftarten, Icons und Bilder (über CSS-Variablen in `variables.css`). Layout, Fensterlogik und Pluginverhalten werden nicht verändert.
5. **Plugins kommunizieren nur über die Plugin-API**: Plugins importieren keine internen Core-Dateien direkt (kein `require("../../core/...")`). Sie greifen ausschließlich über das übergebene `context`-Objekt zu.
6. **EventBus verwenden**: Systeme kommunizieren entkoppelt über Ereignisse auf dem zentralen EventBus.
7. **Keine unnötigen Frameworks**: Es werden keine überflüssigen Enterprise-Muster oder DI-Container eingeführt.
8. **Rückwärtskompatibilität beachten**: Bestehende Themes und Plugins bleiben lauffähig (z. B. Fallback-Pfade bei Themes).
9. **Dateien klein halten**: Alle refaktorierten Dateien bleiben kompakt (idealerweise unter 300 Zeilen, maximal 500 Zeilen).
10. **Einfachheit bevorzugen**: Die Code-Struktur bleibt so simpel, dass neue Entwickler sie in wenigen Minuten verstehen können.

---

## Neue Architekturregeln & Konventionen

### 1. EventBus Namenskonvention: `domain:event`
Um Wildwuchs bei Events zu verhindern, gilt ab sofort ein einheitliches Namensschema für alle Core- und Plugin-Ereignisse:
- `audio:play` (statt `play`)
- `audio:stop` (statt `stop`)
- `audio:metadata` (statt `metadata`)
- `theme:change` (statt `themechange`)
- `plugin:toggled` (statt `pluginToggled`)

### 2. Plugin API Versionierung
Das Plugin-Manifest (`plugin.json`) deklariert das Feld `apiVersion`. 
- Ältere Plugins ohne `apiVersion` werden als Legacy (`v1.0`) behandelt.
- Der Core validiert die Kompatibilität beim Laden und verhindert das Ausführen inkompatibler Plugins.

### 3. Theme-Vererbung
In der `theme.json` wird das Feld `extends` reserviert (z. B. `"extends": "dark"`). 
- Der `ThemeLoader` liest dieses Feld ein.
- Zukünftig kann ein Theme auf einem anderen Theme aufbauen, wodurch nur abweichende Variablen in der eigenen `variables.css` definiert werden müssen.

### 4. Keine zirkulären Abhängigkeiten in Core Services
Core-Dienste dürfen sich niemals gegenseitig importieren (z. B. `AudioService` importiert `SettingsService` und umgekehrt). 
Die Kommunikation erfolgt ausschließlich über:
- Den **EventBus** (lose Kopplung über Publisher-Subscriber).
- Öffentliche **Service-APIs** (Einweg-Abhängigkeit).
- **`WindowManager.broadcast()`** (für die Verteilung an Renderer-Fenster).

---

## Technische Analyse & Schulden (Ist-Zustand)

1. **Dummy-Klasse `ThemeManager.js`**:
   - Die Datei [ThemeManager.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/themes/ThemeManager.js) ist aktuell ein leerer Platzhalter ohne implementierte Logik.
2. **IPC-Handler als Monolith**:
   - Die komplette Logik für das Einlesen von Theme-Ordnern, das Parsen der `theme.json` und die Verzeichnisauflösung befindet sich direkt im IPC-Handler in [themeHandlers.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/ipc/themeHandlers.js).
3. **Fehlende Trennung und Synchronisation**:
   - Wenn das Theme im Einstellungsfenster geändert wird, erfährt das Hauptfenster nichts davon (und umgekehrt), da es keine Live-Synchronisation zwischen den Fenstern gibt.
4. **Fehlerhafter Parameter im IPC-Handler**:
   - In `registerIpcHandlers.js` wird `registerThemeHandlers(window)` aufgerufen, in `themeHandlers.js` wird das Argument jedoch als `isDev` entgegengenommen. Dadurch wird `isDev` in Produktion als `true` evaluiert, was zu Pfadkonflikten in Builds führt.
5. **Layout-Abhängigkeiten im Default-Theme**:
   - Das Default-Theme ([style.css](file:///d:/Development/Source/Javascript/Sicherung/themes/default/style.css)) enthält viele Layout-Regeln, die in `variables.css` überführt werden müssen.

---

## Vorgeschlagene Architektur (Soll-Zustand)

### 1. Theme-System Dreiteilung
1. **`ThemeLoader`**: Zuständig für das Dateisystem (Einlesen, Validieren der `theme.json`, Auflösung von `extends`, Abwärtskompatibilität, Pfadnormalisierung).
2. **`ThemeManager`**: Steuert den aktiven Status, persistiert Einstellungen via `storage.js`, benachrichtigt Plugins über den `eventBus` (`theme:change`) und kommuniziert mit dem WindowManager zur Synchronisation.
3. **`themeHandlers`**: Registriert die IPC-Endpunkte und leitet Anfragen an den `ThemeManager` weiter (ohne eigene Business-Logik).

### Verzeichnisstruktur für Themes
```txt
themes/
├─ dark/
│  ├─ theme.json
│  ├─ variables.css
│  └─ preview.png
├─ light/
│  ├─ theme.json
│  ├─ variables.css
│  └─ preview.png
```

### Schema der `theme.json` (mit extends-Reservierung)
```json
{
  "id": "neon-glow",
  "name": "Neon Glow",
  "version": "1.1.0",
  "author": "WebRadio Team",
  "description": "A neon theme inheriting from dark theme",
  "extends": "dark",
  "css": "variables.css",
  "preview": "preview.png"
}
```

---

## 2. Entwurf der Plugin API (Zielstruktur)

Um Plugins vollständig vom Core zu entkoppeln und das Prinzip *"Plugins kommunizieren nur über die Plugin-API"* umzusetzen, wird dem Plugin bei der Instanziierung ein gekapseltes `context`-Objekt übergeben.

### Interface-Entwurf (ohne Implementierung)

```javascript
// context-Objekt, das an die init()-Methode des Plugins übergeben wird
const pluginContext = {
  // Plugin-Metadaten
  plugin: {
    id: "discordRPC",
    name: "Discord Rich Presence",
    version: "1.0.0",
    apiVersion: "1.1"
  },

  // 1. EventBus-Schnittstelle (erzwingt domain:event Schema)
  events: {
    on(event, callback),      // z.B. context.events.on("audio:metadata", (meta) => {})
    off(event, callback),     // z.B. context.events.off("audio:metadata", callback)
    emit(event, payload)      // Erlaubt das Senden von Events
  },

  // 2. Isolierter Plugin-Speicher
  storage: {
    get(key),                 // Liest Wert aus plugins/<pluginId>.json
    set(key, value),          // Schreibt Wert in plugins/<pluginId>.json
    remove(key)               // Löscht Wert
  },

  // 3. Theme-Schnittstelle (Nur-Lese-Zugriff auf Theme-Zustand)
  theme: {
    getActiveTheme(),         // Liefert Metadaten des aktuell aktiven Themes
    getThemes()               // Liefert eine Liste aller verfügbaren Themes
  },

  // 4. Radio-Steuerung (Stream-Kontrollen & Suche)
  radio: {
    startStream(url),         // Startet einen Radio-Stream
    stopStream(),             // Stoppt den aktuellen Stream
    search(params)            // Sucht nach Sendern
  },

  // 5. Fenster-Steuerung (Eingeschränkte Desktop-Aktionen)
  window: {
    minimize(),               // Minimiert das Fenster
    maximize(),               // Maximiert/stellt das Fenster wieder her
    close()                   // Schließt die App sauber
  }
};
```

---

## Betroffene Dateien und Änderungen

### 1. Backend-Services & Core
- **[NEW] [ThemeLoader.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/themes/ThemeLoader.js)**: Dateizugriff, Parsing, Normalisierung, extends-Verarbeitung.
- **[MODIFY] [ThemeManager.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/themes/ThemeManager.js)**: Zustandsverwaltung, Storage-Anbindung, EventBus-Trigger (`theme:change`).
- **[MODIFY] [themeHandlers.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/ipc/themeHandlers.js)**: Reduktion auf IPC-Routing; sendet `theme:changed` an alle geöffneten Renderer-Fenster über den WindowManager.
- **[MODIFY] [WindowManager.js](file:///d:/Development/Source/Javascript/Sicherung/electron/core/app/WindowManager.js)**: Hinzufügen der `broadcast(channel, data)`-Methode zur fensterübergreifenden Synchronisation.

### 2. Frontend / Renderer (Live-Wechsel & Previews)
- **[MODIFY] [preload.js](file:///d:/Development/Source/Javascript/Sicherung/electron/preload.js)**: Hinzufügen von `themeAPI.onThemeChanged(callback)`.
- **[MODIFY] [themeService.js](file:///d:/Development/Source/Javascript/Sicherung/renderer/services/themeService.js)**: Anpassung der URL-Normalisierung.
- **[MODIFY] [App.jsx](file:///d:/Development/Source/Javascript/Sicherung/renderer/App.jsx)**: Registriert den `onThemeChanged`-Listener für das Hauptfenster.
- **[MODIFY] [settings.js](file:///d:/Development/Source/Javascript/Sicherung/renderer/settings.js)**: Rendert Theme-Karten mit `preview.png` und synchronisiert den Status.
- **[MODIFY] [settings.html](file:///d:/Development/Source/Javascript/Sicherung/renderer/settings.html)**: CSS-Styles für Bildvorschau hinzufügen.

---

## Bewertung des Systementwurfs

Wir bewerten die vorgeschlagene Architektur hinsichtlich Softwarequalität und Wartung:

| Kriterium | Bewertung | Begründung |
| --- | --- | --- |
| **Wartbarkeit** | **Sehr hoch** | Durch die Trennung von `ThemeLoader` (IO) und `ThemeManager` (State) sind Fehler leicht zu lokalisieren. Zirkuläre Abhängigkeiten werden ausgeschlossen. |
| **Erweiterbarkeit** | **Hoch** | Das reservierte `extends`-Feld ermöglicht zukünftige Vererbungen, ohne die Loader-Logik neu schreiben zu müssen. Die strukturierte Plugin-API legt den Grundstein für sichere API-Erweiterungen ab v1.2. |
| **Risiko technischer Schulden** | **Sehr niedrig** | Altlasten (z. B. fehlerhafte `isDev`-Konfigurationen und die monolithische IPC-Logik) werden vollständig beseitigt. Vorhandene Skelett-Dateien werden entfernt. |
| **Komplexität** | **Niedrig bis Mittel** | Das System verwendet Standard-Javascript (CommonJS im Main, ES-Module im Renderer) und verzichtet bewusst auf schwere DI-Frameworks oder OOP-Overengineering. Ein neuer Entwickler versteht die Datenflüsse innerhalb weniger Minuten. |

### Überprüfung der Architekturprinzipien

* **Entspricht das Theme-System den Prinzipien?**
  - **Ja**. Das System bleibt einfach. Es gibt keine zirkulären Abhängigkeiten. Die Verantwortlichkeiten sind klar getrennt (Loader vs. Manager). IPC-Handler leiten nur weiter. Themes überschreiben nur CSS-Variablen in `variables.css` und verändern kein Layout oder Programmlogik.
