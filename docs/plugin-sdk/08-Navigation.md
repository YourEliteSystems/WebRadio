# Navigation Extension API

Die **Navigation Extension API** ermöglicht es Plugins, sich kontrolliert und standardisiert in die WebRadio-Sidebar und Navigation einzuhängen.

Das WebRadio-Core-System stellt lediglich die generische Infrastruktur bereit. **Plugins entscheiden vollständig selbst**, ob sie:
1. einen **einzelnen Menüpunkt auf oberster Ebene** (Top-Level Item),
2. eine **eigene Menü-Kategorie** (Section), oder
3. **Untereinträge** innerhalb einer bestehenden oder neuen Section registrieren möchten.

---

## 1. Berechtigungen (Permissions)

Um die Navigation API nutzen zu können, muss das Plugin die Berechtigung `"navigation"` in seinem Manifest (`plugin.json` oder `manifest.json`) deklarieren:

```json
{
  "id": "my-plugin",
  "name": "Mein Plugin",
  "version": "1.0.0",
  "permissions": [
    "navigation"
  ]
}
```

---

## 2. Einzelner Navigationseintrag (Top-Level Item)

Wenn ein Plugin lediglich einen direkten Button in der Sidebar benötigt (ohne übergeordnete Section), wird `parent` einfach weggelassen:

```js
context.navigation.registerItem({
  id: "my-radio-tools",
  label: "Radio Tools",
  icon: "radio",
  route: "my-radio-tools",
  order: 20
});
```

---

## 3. Eigene Navigation Section

Eine Section repräsentiert einen Hauptbereich in der Sidebar, der Unterpunkte gruppieren kann und optional aufklappbar (**collapsible**) ist.

```js
context.navigation.registerSection({
  id: "my-tools",
  label: "Werkzeuge",
  icon: "tools",
  collapsible: true,
  expanded: true,
  order: 10,
  visible: true
});
```

### Parameter für Sections:

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | `string` | Ja | Eindeutige Section-ID |
| `label` | `string` | Ja | Anzeigename in der Sidebar |
| `icon` | `string` | Nein | Optionaler Icon-Identifier |
| `collapsible` | `boolean` | Nein | Ob die Section ein- und ausklappbar ist (Standard: `true`) |
| `expanded` | `boolean` | Nein | Initialer Zustand: ausgeklappt (`true`) oder eingeklappt (`false`) (Standard: `true`) |
| `order` | `number` | Nein | Sortierreihenfolge (niedrigere Zahlen zuerst, Standard: `100`) |
| `visible` | `boolean` | Nein | Sichtbarkeit (Standard: `true`) |

---

## 4. Unterpunkte einer Section (Sub-Items)

Um ein Item einer Section zuzuordnen, wird der Parameter `parent` mit der ID der Ziel-Section angegeben:

```js
context.navigation.registerItem({
  id: "my-converter",
  parent: "my-tools",
  label: "Konverter",
  icon: "exchange",
  route: "my-converter",
  order: 1
});

context.navigation.registerItem({
  id: "my-downloader",
  parent: "my-tools",
  label: "Downloader",
  icon: "download",
  route: "my-downloader",
  order: 2
});
```

Ergebnis in der Sidebar:
```text
Radio (Core)
Radio Tools (Plugin Top-Level Item)

Werkzeuge ▼ (Plugin Section)
    ├── Konverter
    └── Downloader
```

### Parameter für Items:

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | `string` | Ja | Eindeutige Item-ID |
| `parent` | `string` | Nein | ID der übergeordneten Section (wenn weggelassen → Top-Level Item) |
| `label` | `string` | Ja | Anzeigename in der Sidebar |
| `icon` | `string` | Nein | Optionaler Icon-Identifier |
| `route` | `string` | Nein | Route / View-Identifier beim Klick (Standard: `id`) |
| `order` | `number` | Nein | Sortierreihenfolge (Standard: `100`) |
| `visible` | `boolean` | Nein | Sichtbarkeit (Standard: `true`) |
| `disabled` | `boolean` | Nein | Deaktiviert/Gesperrt (Standard: `false`) |

---

## 5. UI-Ansichten im Frontend (Renderer)

Wenn ein Benutzer auf einen Navigationseintrag klickt, wechselt der View-State und WebRadio rendert die registrierte Ansicht:

```js
// renderer.js (Frontend)
window.registerPluginRenderer("my-plugin", {
  init(context) {
    // View für das Navigationselement registrieren:
    window.uiRegistry.registerView("my-converter", "Konverter", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div style="padding: 24px;">
          <h1>Podcasts</h1>
          <p>Hier sind deine Lieblings-Podcasts.</p>
        </div>
      `;
      return container;
    });
  }
});
```

---

## 6. Automatischer Lifecycle & Cleanup

Die Navigation API trackt intern die `ownerPluginId` jedes registrierten Elements:

```text
Plugin Stop / Unload
    ↓
NavigationManager.clearPlugin(pluginId)
    ↓
Alle Sections & Items dieses Plugins werden sofort entfernt
    ↓
Sidebar aktualisiert sich live
```

Andere Plugins und die Core-Navigation bleiben dabei vollständig intakt. Es ist **kein manuelles Entfernen erforderlich**.

---

## 7. Duplicate-ID Schutz

Die Navigation API verhindert versehentliche oder unbefugte Überschreibungen:
- Wenn ein Plugin versucht, eine Section oder ein Item zu registrieren, dessen ID bereits von einem anderen Plugin belegt ist, wird ein kontrollierter Fehler geworfen.
- Das registrierende Plugin kann eigene Einträge jederzeit per `updateItem()` aktualisieren.
