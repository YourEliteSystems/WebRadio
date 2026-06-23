# WebRadio Theme Development Guide

Dieses Dokument beschreibt die Erstellung von Themes für die WebRadio-Anwendung ab Version 1.1.

---

## 🎨 Theme-Ordnerstruktur

Jedes Theme muss in einem eigenen Unterordner im Verzeichnis `themes/` liegen:

```txt
themes/
├─ mein-theme/
│  ├─ theme.json          # Metadaten des Themes (erforderlich)
│  ├─ variables.css       # CSS-Variablen des Themes (erforderlich)
│  └─ preview.png         # Vorschau-Bild (empfohlen, 300x200px)
```

---

## 📄 Metadaten (`theme.json`)

Die Datei `theme.json` enthält alle wichtigen Informationen über dein Theme.

### Beispiel:
```json
{
  "id": "mein-theme",
  "name": "Mein cooles Theme",
  "version": "1.0.0",
  "author": "Dein Name",
  "description": "Ein modernes Theme mit Neon-Farben",
  "css": "variables.css",
  "preview": "preview.png"
}
```

### Parameter-Erklärung:

| Feld | Typ | Erforderlich | Beschreibung |
| --- | --- | --- | --- |
| `id` | String | Ja (Fallback auf Ordnername) | Eindeutige Kennung des Themes. Darf keine Sonderzeichen oder Leerzeichen enthalten. |
| `name` | String | Ja | Der Name des Themes, wie er in den Einstellungen angezeigt wird. |
| `version` | String | Nein (Standard: `1.0.0`) | Versionsnummer des Themes. |
| `author` | String | Nein | Der Name des Theme-Erstellers. |
| `description` | String | Nein | Eine kurze Beschreibung des Themes. |
| `css` | String | Nein (Standard: `variables.css`) | Relativer Pfad zur CSS-Datei im Theme-Ordner. |
| `preview` | String | Nein (Standard: `preview.png`) | Relativer Pfad zum Vorschau-Bild. |

---

## 🎨 CSS-Variablen (`variables.css`)

Themes verändern das Aussehen der Anwendung durch das Überschreiben von CSS-Variablen des globalen Design-Systems. 
Die Datei sollte mit dem `:root` Selektor deklariert werden.

### Wichtigste CSS-Variablen:

```css
:root {
  /* --- Hintergrundfarben --- */
  --bg-main: #0f1115;          /* Haupt-Hintergrund der Anwendung */
  --bg-sidebar: #161921;       /* Hintergrund der Sidebar */
  --bg-card: #232834;          /* Standard-Kartenhintergrund */
  --bg-card-hover: #323949;    /* Kartenhintergrund beim Hovern */
  --titlebar-bg: #161921;      /* Hintergrund der Titelleiste */

  /* --- Textfarben --- */
  --text-main: #e2e8f0;        /* Primärer Text */
  --text-muted: #94a3b8;       /* Sekundärer/gedämpfter Text */

  /* --- Akzent- & Fokusfarben --- */
  --accent-color: #6366f1;     /* Primäre Akzentfarbe (z.B. Buttons, aktive Tabs) */
  --accent-hover: #4f46e5;     /* Akzentfarbe im Hover-Zustand */
  --accent-glow: rgba(99, 102, 241, 0.4); /* Glow-Farbe für Schatten und Effekte */

  /* --- Rahmen & Ränder --- */
  --border-color: rgba(255, 255, 255, 0.08); /* Standard-Rahmenfarbe */
}
```

---

## 📸 Theme-Vorschau (`preview.png`)

- **Format**: PNG oder JPG.
- **Größe**: Empfohlen wird ein Seitenverhältnis von 3:2 (z.B. `300 x 200` Pixel).
- Das Bild wird direkt in der Theme-Auswahlliste in den Einstellungen angezeigt.
- Ohne dieses Bild wird ein stilvoller Platzhalter mit dem Theme-Namen gerendert.

---

## 🔌 Plugin-Integration (`onThemeChange`)

Wenn du ein Plugin schreibst und auf Theme-Wechsel reagieren möchtest (z.B. um Canvas-Grafiken oder Discord-RPC-Statusfarben anzupassen), kannst du in deiner `plugin.js` den Hook `onThemeChange` implementieren:

```javascript
module.exports = {
  init(context) {
    console.log("Plugin geladen");
  },

  onThemeChange(data) {
    console.log("Das Theme wurde gewechselt auf:", data.theme);
    // Hier kannst du auf die Theme-ID reagieren
  }
};
```
