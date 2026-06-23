# Theme Development Guide

Dieser Guide beschreibt die neue Theme-Struktur von WebRadio ab Version 1.1. Das modernisierte Theme-System trennt Design sauber von Logik, bietet Unterstützung für Echtzeit-Theme-Wechsel (Runtime Switching), Vorschau-Bilder im Einstellungsmenü und ist für zukünftige Theme-Vererbung vorbereitet.

Der Guide richtet sich an Theme-Entwickler und Core-Entwickler, die das Aussehen der Anwendung anpassen oder erweitern möchten.

| Bereich | Stand |
| --- | --- |
| App-Version | `v1.0.4` (in Entwicklung für `v1.1`) |
| Empfohlene Struktur | `themes/<themeId>/variables.css` |
| Legacy-Kompatibilität | Ja (Themes mit `style.css` und altem JSON-Schema laufen weiter) |
| API-Status | Modernisiert & Abwärtskompatibel |
| Roadmap-Ziel | Theme-Vererbung (`extends`) und visuelle Theme-Einstellungen |

> Kurzfassung: Themes steuern das visuelle Erscheinungsbild von WebRadio ausschließlich über vordefinierte CSS-Variablen. Sie dürfen keine Layouts verändern oder Programmlogik enthalten. Jedes Theme besteht aus einem Ordner mit einer Metadatendatei (`theme.json`), einem Stylesheet (`variables.css`) und einer optionalen Vorschaugrafik (`preview.png`).

---

## Architekturprinzipien

Um die Stabilität und Wartbarkeit der Anwendung langfristig zu sichern, müssen Themes folgende Prinzipien einhalten:

* **Strikte Deklarativität**: Themes dürfen ausschließlich Design und Darstellung verändern (Farben, Schriftarten, Glow-Effekte, Icons und Hintergrundbilder).
* **Keine Geschäftslogik**: Themes dürfen keine Programmlogik (Javascript/Node.js) enthalten oder die Anwendungslogik beeinflussen.
* **Kein Plugin-Ersatz**: Themes dürfen nicht dazu verwendet werden, Funktionen zu implementieren, die in den Bereich des Plugin-Systems fallen.
* **Layout-Erhalt**: Struktur- und Layout-Änderungen (z. B. Überschreiben von Positionierungen, Flexbox-Ausrichtungen oder festen Breiten von Core-Komponenten) müssen vermieden werden. Layout-CSS verbleibt exklusiv im Core unter `renderer/styles/core.css`.
* **CSS-Variablen als Standard**: Die Anpassung erfolgt primär über das Überschreiben von CSS-Variablen im `:root`-Bereich. Direkte, tiefe Selektor-Überschreibungen bergen das Risiko, bei Core-Layout-Updates zu brechen.

---

## Ordnerstruktur

Jedes Theme muss in einem eigenen Unterordner im Verzeichnis `themes/` abgelegt werden:

```txt
themes/
├─ mein-theme/
│  ├─ theme.json          # Metadaten des Themes (erforderlich)
│  ├─ variables.css       # CSS-Variablendeklaration (erforderlich)
│  └─ preview.png         # Visuelle Vorschau des Themes (empfohlen)
```

---

## Metadaten (`theme.json`)

Die Datei `theme.json` beschreibt die Eigenschaften des Themes. 

### Empfohlenes Manifest ab Version 1.1

```json
{
  "id": "neon-glow",
  "name": "Neon Glow",
  "version": "1.0.0",
  "author": "WebRadio Team",
  "description": "Ein futuristisches Theme mit leuchtenden Neon-Farben",
  "extends": "dark",
  "css": "variables.css",
  "preview": "preview.png"
}
```

### Parameter-Erklärung:

| Feld | Pflicht | Typ | Bedeutung / Beschreibung |
| --- | --- | --- | --- |
| `id` | ja | String | Stabile, eindeutige ID des Themes (Kleinbuchstaben und Bindestriche, keine Sonderzeichen). |
| `name` | ja | String | Der Anzeigename des Themes in den Einstellungen der App. |
| `version` | empfohlen | String | Semantische Versionsnummer des Themes (z. B. `1.0.0`). |
| `author` | empfohlen | String | Autor des Themes. |
| `description`| nein | String | Kurze Beschreibung des visuellen Stils. |
| `extends` | nein | String | Reserviert für zukünftige Theme-Vererbung (z. B. `"extends": "dark"`). |
| `css` | nein | String | Relativer Pfad zum Stylesheet. Standardwert: `variables.css`. |
| `preview` | nein | String | Relativer Pfad zum Vorschaubild. Standardwert: `preview.png`. |

---

## API & Events

### Theme wechseln über IPC
Das UI-Frontend steuert das Theme-System über die mittels `contextBridge` exponierten Methoden der `themeAPI`:

```javascript
// Alle installierten Themes abfragen
const themes = await window.themeAPI.getThemes();

// Aktuelle Theme-ID abfragen
const activeId = await window.themeAPI.getActiveTheme();

// Ein Theme aktivieren
await window.themeAPI.setActiveTheme("neon-glow");
```

### Live-Synchronisation im Renderer
Um das Stylesheet bei einem Theme-Wechsel zur Laufzeit ohne App-Neustart in allen Fenstern synchron anzuwenden, registrieren die Fenster einen Listener:

```javascript
window.themeAPI.onThemeChanged((themeId) => {
  console.log(`Theme gewechselt auf: ${themeId}`);
  // Stylesheet-Link im DOM wird vom themeService automatisch ausgetauscht
});
```

### Plugin-Integration (EventBus)
Der Hauptprozess benachrichtigt registrierte Plugins über Theme-Wechsel über ein standardisiertes Event auf dem `eventBus`. Der Eventname folgt der neuen Namenskonvention:

| Event-Name | Payload | Beschreibung |
| --- | --- | --- |
| `theme:change` | `{ theme: "themeId" }` | Wird emittiert, wenn ein neues Theme aktiv geschaltet wird. |

#### Beispiel in einem Main-Plugin:
```javascript
module.exports = {
  init(context) {
    context.events.on("theme:change", (data) => {
      console.log(`[Plugin] Reagiere auf Theme-Wechsel: ${data.theme}`);
      // Z. B. RPC-Statusfarben oder Log-Ausgaben anpassen
    });
  }
};
```

---

## Best Practices

* **Verwendung von CSS-Variablen**: 
  Nutze ausschließlich die vom Core bereitgestellten CSS-Variablen. Überschreibe Klassen (z. B. `.sidebar`, `.player`) nur im Ausnahmefall und verändere niemals deren Layout-Eigenschaften (`display: flex`, `position`, `width` etc.).
* **Konsistente Farbkontraste**: 
  Stelle beim Entwurf von hellen (Light) oder dunklen (Dark) Themes sicher, dass die Kontraste nach WCAG-Richtlinien für Textelemente eingehalten werden. Nutze dazu `--text-main` und `--text-muted`.
* **Optimierung von Vorschau-Bildern**: 
  Die `preview.png` sollte ein Seitenverhältnis von 3:2 aufweisen (empfohlen: `300 x 200` Pixel) und PNG-komprimiert sein, um unnötige Ladezeiten beim Rendern des Einstellungsmenüs zu vermeiden.
* **Saubere Deinstallation / Rückfallebene**: 
  Löscht ein Benutzer ein Theme-Verzeichnis manuell, greift das System automatisch auf das `"default"` Theme zurück. Plane dein Theme so, dass es im Ernstfall vollständig durch Standardwerte des Cores ersetzt werden kann.

---

## Beispiele

### 1. Minimalistisches Dark Theme (`dark`)

`theme.json`:
```json
{
  "id": "dark",
  "name": "Classic Dark",
  "version": "1.0.0",
  "author": "WebRadio Team",
  "description": "Das klassische dunkle Design für WebRadio",
  "css": "variables.css",
  "preview": "preview.png"
}
```

`variables.css`:
```css
:root {
  --bg-main: #000000;
  --bg-sidebar: #121212;
  --bg-card: #1c1c1e;
  --bg-card-hover: #2c2c2e;
  
  --titlebar-bg: #121212;
  --text-main: #ffffff;
  --text-muted: #8e8e93;
  
  --accent-color: #ff3d00;
  --accent-hover: #ff6d00;
  --accent-glow: rgba(255, 61, 0, 0.35);
  
  --border-color: rgba(255, 255, 255, 0.08);
}
```

### 2. Modernes Neon Theme (`neon`)

`theme.json`:
```json
{
  "id": "neon",
  "name": "Neon Cyberpunk",
  "version": "1.0.0",
  "author": "YourEliteSystems",
  "description": "Futuristisches Design mit hellen Akzenten",
  "css": "variables.css",
  "preview": "preview.png"
}
```

`variables.css`:
```css
:root {
  --bg-main: #0a0b10;
  --bg-sidebar: rgba(13, 15, 24, 0.8);
  --bg-card: rgba(20, 24, 40, 0.6);
  --bg-card-hover: rgba(30, 36, 60, 0.85);
  
  --titlebar-bg: #0d0f18;
  --text-main: #00f2fe;
  --text-muted: #707e94;
  
  --accent-color: #ff007f;
  --accent-hover: #ff00ab;
  --accent-glow: rgba(255, 0, 127, 0.4);
  
  --border-color: rgba(0, 242, 254, 0.15);
}
```

---

## Kompatibilität

Das neue Theme-System in Version 1.1 wurde so entworfen, dass ältere Themes vollständig lauffähig bleiben.

### Legacy-Unterstützung
Wenn ein älteres Theme eingelesen wird, wendet der `ThemeLoader` automatische Fallbacks an:
1. **Fehlende `id`**: Fehlt die ID in der `theme.json`, ermittelt das System diese automatisch aus dem Namen des Verzeichnisses (z. B. `themes/my-old-theme/` wird zu ID `my-old-theme`).
2. **Dateiname der CSS-Datei**: Zeigt der Pfad in der `theme.json` noch auf `"style.css"` (alter Standard), wird diese Datei korrekt geladen. Wenn kein `css`-Parameter deklariert ist, sucht das System primär nach `variables.css` und weicht bei Fehlen auf `style.css` aus.
3. **Keine Vorschau**: Ist keine `preview.png` vorhanden, rendert die Einstellungsseite automatisch einen dynamischen CSS-Farbkreis auf Basis der Akzentfarbe (`--accent-color`) des Themes als Platzhalter.

---

## Zukünftige Erweiterungen (Roadmap)

Für Version 1.2+ geplante Features:

1. **Theme-Vererbung (`extends`)**:
   Erlaubt es Theme-Entwicklern, auf bestehende Themes aufzusetzen. Ein Theme `"extends": "dark"` lädt zuerst die Farbvariablen des dunklen Standard-Themes und überschreibt anschließend nur die in der eigenen `variables.css` deklarierten Werte (z. B. nur eine andere Akzentfarbe).
2. **Visuelle Theme-Einstellungen (Theme Settings)**:
   Deklaration von anpassbaren Optionen direkt in der `theme.json` (z. B. ein Farbpicker für den Hintergrund). Diese Optionen werden vom Core automatisch im Einstellungsmenü gerendert, sodass Benutzer Themes im UI anpassen können.
3. **Plugin/Theme-Bundles**:
   Ermöglicht Plugins, eigene Themes direkt in ihrem Plugin-Ordner mitzuliefern und über die offizielle Plugin-Schnittstelle im Core zu registrieren.
