# Zentrale Localization API

WebRadio besitzt genau **eine** Übersetzungslogik. Hauptanwendung, Plugins und
Theme-Metadaten greifen über dieselbe Engine zu, aber über unterschiedlich
weitreichende Schnittstellen (Scopes). Es gibt keine zweite Laufzeitquelle für
Sprachkataloge.

## Laufzeitquelle: `userData/localization/`

Alle aktiven Kataloge werden ausschließlich aus dem `userData`-Verzeichnis
geladen:

```text
userData/
└── localization/
    ├── de-DE.json
    ├── en-US.json
    ├── backups/                     ← Sicherungen ersetzter Kataloge
    ├── trash/                       ← kontrolliert entfernte Kataloge
    ├── plugins/
    │   └── <plugin-id>/
    │       ├── de-DE.json
    │       └── en-US.json
    └── themes/
        └── <theme-id>/
            ├── de-DE.json
            └── en-US.json
```

Die mitgelieferten Kataloge unter `electron/core/localization/locales/` dienen
**nur** der initialen Bereitstellung und der kontrollierten Wiederherstellung
eines beschädigten Katalogs. Fehlt eine Datei in `userData`, wird sie nicht
stillschweigend aus dem Bundle nachgeladen – der Katalog gilt als nicht
verfügbar und die Fallback-Logik der Engine greift.

Die mitgelieferten Sprachen sind `de-DE` und `en-US`. `setLanguage("system")`
verwendet die Betriebssystemsprache und fällt auf die Standardsprache zurück,
wenn keine passende Übersetzung existiert.

## Core-API

Die Hauptanwendung nutzt die API über `LocalizationService` (Main-Prozess) bzw.
den Renderer-Manager; im Renderer stellt der `LocalizationProvider` die
Reaktivität für React bereit.

```js
const LocalizationService = require("electron/core/localization/LocalizationService");

LocalizationService.t("navigation.radio");               // "Radio"
LocalizationService.t("greeting", { name: "Ada" });      // Interpolation
LocalizationService.getLocale();                          // aktive Sprache
LocalizationService.getPreferredLocale();                 // gespeicherte Präferenz
LocalizationService.getAvailableLocales();                 // ["de-DE", "en-US"]
const off = LocalizationService.onLocaleChanged((locale) => { /* … */ });
off();                                                    // Listener entfernen

LocalizationService.formatDate(new Date(), { dateStyle: "medium" });
LocalizationService.formatNumber(1234.5);
LocalizationService.formatCurrency(12.5, "EUR");
LocalizationService.formatRelativeTime(-2, "day");
```

Alternativ kann eine eigenständige Scope-Instanz erzeugt werden:

```js
const { createLocalizationAPI } = require("electron/core/localization/LocalizationAPI");
const api = createLocalizationAPI({ manager, scope: { type: "core" } });
```

Die Core-API darf lesen und formatieren, aber keine Kataloge schreiben. Das
Schreiben ist ausschließlich Aufgabe der Katalogverwaltung (siehe unten).

## Scopes

| Scope | Schlüsselraum | Schreibzugriff |
| --- | --- | --- |
| Core | alle Anwendungsschlüssel | nein (nur Verwaltung) |
| Plugin | `plugin.<plugin-id>.*` | nein |
| Theme | `theme.<theme-id>.*` | nein |

Scopes sind eingefrorene Objekte. Nicht unterstützte Zugriffe auf fremde
Namensräume werfen einen `LocalizationAccessError` mit dem Code
`ACCESS_DENIED`; syntaktisch ungültige Schlüssel (`""`, Leerzeichen, `..`,
nicht-String) werfen `INVALID_KEY`.

### Plugin-Scope

```js
const api = LocalizationService.createPluginAPI("mediahub");
api.t("settings.title");                       // relativ → plugin.mediahub.settings.title
api.t("plugin.mediahub.settings.title");       // qualifiziert → identisch
api.t("greet", { name: "Ada" });
api.getLocale();
api.getAvailableLocales();
api.onLocaleChanged((locale) => { /* … */ });
api.dispose();                                 // entfernt alle Listener
```

Im Plugin-Kontext steht dieselbe API als `context.localization` bereit (der
Plugin-Kontext stellt die API-Mitglieder direkt bereit, z. B. `context.player`).
Ist die Lokalisierung in einem Kontext nicht verfügbar, ist der Wert `null`;
das Plugin lädt trotzdem.
Plugin-Oberflächen, die nicht über React gerendert werden, verwenden im
Renderer:

```js
const i18n = window.pluginLocalization.forPlugin("mediahub");
i18n.t("settings.title");
```

`forPlugin` liefert `null` für unbekannte oder ungültige IDs. Fremde
Namensräume sind auch dort gesperrt; die Isolation von Plugin-Renderer-Skripten
erfolgt auf API-Ebene, da sie sich – wie in der bestehenden Architektur – einen
Renderer-Kontext teilen.

### Theme-Scope

Themes besitzen keine dynamischen Skripte; ihre Oberfläche ist CSS. Daher ist
die primäre Theme-Lokalisierung **Metadaten**:

```json
{
  "id": "midnight",
  "name": "Midnight",
  "description": "Dark theme",
  "localization": {
    "de-DE": {
      "name": "Mitternacht",
      "description": "Dunkles Theme",
      "settings": { "accent": "Akzent" },
      "help": { "accent": "Akzentfarbe der Oberfläche" }
    },
    "en-US": {
      "name": "Midnight",
      "description": "Dark theme",
      "settings": { "accent": "Accent" },
      "help": { "accent": "Surface accent color" }
    }
  }
}
```

Unterstützt werden `name`, `description`, `settings` (Einstellungs­bezeichnungen)
und `help` (Hilfetexte). Die Werte werden nie ausgeführt, sondern ausschließlich
als Text verwendet. Für Theme-Oberflächen, die später eigenen Text benötigen,
existiert `window.themeLocalization.forTheme(id)` mit demselben Scope-Modell;
es ist derzeit kein Bestandteil des Theme-Vertrags.

## Katalogverwaltung

`LocalizationCatalogStore` ist der einzige Schreibpfad:

- **Bereitstellung** (`provisionPluginCatalogs`, `provisionThemeCatalogs`)
  validiert Locale, Tiefe, Typen und reservierte Präfixe, schreibt atomar über
  ein Staging-Verzeichnis und sichert den vorherigen Stand als Backup.
- **Wiederherstellung** (`restorePluginCatalogs`) spielt ein Backup zurück –
  z. B. nach einem fehlgeschlagenen Plugin-Update.
- **Entfernen** (`removePluginCatalogs`, `removeThemeCatalogs`) verschiebt die
  Kataloge zunächst nach `localization/trash/` und löscht sie von dort
  kontrolliert; schlägt das Löschen fehl, bleibt der Papierkorb liegen.
- **Entfernen ohne Übersetzungen** (`clearPluginCatalogs`) sichert die alten
  Kataloge als Backup, wenn eine neue Plugin-Version keine Übersetzungen mehr
  deklariert.

Ein Plugin-Update stellt seine Kataloge im selben Schritt wie die Dateien
bereit: schlägt das Neuladen fehl, werden Dateien **und** Kataloge
zurückgerollt. Kataloge anderer Plugins werden dabei nie berührt.

## Sprachwechsel

Ein Sprachwechsel wird über `LocalizationService.setLanguage()` ausgelöst und
an alle registrierten Verbraucher verteilt:

- Hauptfenster und Einstellungsfenster über `localization:changed`,
- aktive Plugins über ihre `onLocaleChanged`-Listener,
- Theme-Metadaten werden im Einstellungsfenster neu geladen.

Jeder `onLocaleChanged`-Aufruf liefert eine Abmelde-Funktion. `dispose()` bzw.
`disposePluginAPI(pluginId)` entfernt alle Listener eines Scopes; Plugins rufen
`dispose()` beim Deaktivieren über ihren Kontext auf. Ein dauerhaft
registrierter Callback entsteht dadurch nicht.
