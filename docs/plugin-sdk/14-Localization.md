# Lokalisierung

Plugins deklarieren ihre Übersetzungen im Manifest. WebRadio stellt sie beim
Laden, Update und Rollback automatisch bereit und räumt sie bei der
Deinstallation auf. Zur Laufzeit liest das Plugin seine Texte ausschließlich
über die gescopte Localization API.

## Kataloge im Manifest

```json
{
  "id": "mediahub",
  "name": "MediaHub",
  "version": "1.0.0",
  "localization": {
    "de-DE": {
      "settings": { "title": "Einstellungen" },
      "greet": "Hallo {name}"
    },
    "en-US": {
      "settings": { "title": "Settings" },
      "greet": "Hello {name}"
    }
  }
}
```

Regeln:

- Sprachcodes müssen unterstützte Locales sein (`de-DE`, `en-US`).
- Werte sind ausschließlich Strings; verschachtelte Objekte sind erlaubt.
- Leere Werte, ungültige Typen und zu tiefe Strukturen werden abgelehnt.
- Das Präfix `plugin.` ist in den eigenen Katalogen reserviert.

Die Kataloge landen unter `userData/localization/plugins/mediahub/` und werden
von dort geladen. Im Paket selbst müssen keine JSON-Dateien mitgeliefert
werden; das Manifest ist die Quelle für die initiale Bereitstellung.

## Zugriff im Plugin

```js
module.exports = {
  async activate(context) {
    const i18n = context.localization;

    console.log(i18n.t("settings.title"));          // "Einstellungen"
    console.log(i18n.t("greet", { name: "Ada" }));  // "Hallo Ada"

    // Voll qualifiziert funktioniert ebenfalls:
    console.log(i18n.t("plugin.mediahub.settings.title"));

    this.unsubscribe = i18n.onLocaleChanged((locale) => {
      console.log(`Neue Sprache: ${locale}`);
    });
  },

  async deactivate() {
    // Listener beim Entladen entfernen (der Kontext gibt die API zusätzlich frei).
    if (this.unsubscribe) this.unsubscribe();
  }
};
```

Ist die Lokalisierung in einem Kontext nicht verfügbar (etwa in Headless-
Tests), ist `context.localization` `null`; das Plugin lädt trotzdem. Prüfe in
diesem Fall vor dem Zugriff:

```js
const i18n = context.localization;
if (!i18n) return;
```

Verfügbar sind:

- `t(key, params)`
- `has(key)`
- `getLocale()`
- `getPreferredLocale()`
- `getAvailableLocales()`
- `onLocaleChanged(callback)` → Abmelde-Funktion
- `formatDate`, `formatNumber`, `formatCurrency`, `formatRelativeTime`
- `dispose()`

## Oberflächen ohne React

Plugin-Ansichten, die imperativ gerendert werden, nutzen im Renderer:

```js
const i18n = window.pluginLocalization.forPlugin("mediahub");
element.textContent = i18n.t("settings.title");
const off = i18n.onLocaleChanged(() => render());
```

`forPlugin` liefert `null`, wenn die ID ungültig oder unbekannt ist. Die API
ist eingefroren und besitzt keine Schreibfunktion.

## Isolation

- Relative Schlüssel werden automatisch zu `plugin.<plugin-id>.*`.
- Der Zugriff auf `plugin.<fremde-id>.*` wirft `ACCESS_DENIED`.
- Anwendungstexte (`navigation.radio` usw.) sind nicht erreichbar.
- Es gibt keinen Dateisystemzugriff und keine Ausführung von Übersetzungen.
- Kataloge anderer Plugins werden weder gelesen noch verändert.

Im Main-Prozess ist jeder Plugin-Kontext strikt getrennt. Renderer-Skripte
teilen sich – wie in der bestehenden Architektur – einen Kontext; dort ist die
Isolation auf API-Ebene durchgesetzt.

## Lebenszyklus

| Ereignis | Verhalten |
| --- | --- |
| Installation | Kataloge werden validiert und bereitgestellt |
| Update | Neue Kataloge ersetzen die alten, Sicherung wird angelegt |
| Update-Rollback | Vorherige Kataloge werden wiederhergestellt |
| Deinstallation | Kataloge werden kontrolliert entfernt |
| Deaktivieren | Listener werden über `dispose()` entfernt |

## Sprachwechsel

`getLocale()` liefert immer die aktive Sprache. Nach einem Sprachwechsel ruft
WebRadio alle registrierten Listener auf; `t()` liefert danach die Texte der
neuen Sprache. Ein Plugin muss seine Oberfläche im Listener neu rendern.
