# Lokalisierung

Themes bestehen aus CSS und einem Manifest. Es gibt keine Theme-Skripte und
damit keinen dynamischen Textzugriff. Deshalb unterstützt WebRadio lokalisierte
**Metadaten**: Name, Beschreibung, Einstellungsbezeichnungen und Hilfetexte.

## Metadaten im Theme-Manifest

```json
{
  "id": "midnight",
  "name": "Midnight",
  "version": "1.0.0",
  "author": "Beispiel",
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

Regeln:

- Sprachcodes müssen unterstützte Locales sein (`de-DE`, `en-US`).
- Werte sind Strings; `settings` und `help` sind Objekte mit String-Werten.
- Das Präfix `theme.` ist in den eigenen Katalogen reserviert.
- Fehlt ein Eintrag, zeigt WebRadio den Manifest-Wert (`name`,
  `description`) unverändert an.

Die Kataloge werden nach `userData/localization/themes/midnight/` geschrieben
und von dort gelesen. Das Manifest ist nur die initiale Bereitstellung.

## Verhalten

- Die Theme-Auswahl im Einstellungsfenster zeigt lokalisierte Namen und
  Beschreibungen.
- Ein Sprachwechsel lädt die Theme-Liste neu; offene Theme-Einstellungen zeigen
  sofort die neue Sprache.
- Themes können keine App-, Plugin- oder fremden Theme-Kataloge lesen oder
  verändern und erhalten keinen Dateisystemzugriff.
- Übersetzungen sind reine Daten und werden niemals ausgeführt.

## Eingeschränkte Theme-Schnittstelle

Für künftige Theme-Oberflächen existiert im Renderer eine gescopte API:

```js
const i18n = window.themeLocalization.forTheme("midnight");
i18n.t("name");                    // theme.midnight.name
i18n.getLocale();
i18n.onLocaleChanged(() => {});
```

Sie folgt demselben Scope-Modell wie Plugins (`theme.<id>.*`) und ist derzeit
nicht Teil des Theme-Vertrags, da Themes keine Skripte besitzen. Sobald Themes
eigene Einstellungsoberflächen erhalten, kann dieselbe API ohne
Architekturwechsel verwendet werden.
