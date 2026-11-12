# Localization Engine

WebRadio v1.0.8 – zentrale, erweiterbare Lokalisierung (i18n/l10n).

Die Localization Engine stellt sicher, dass **jeder eigene sichtbare Text** der
Anwendung aus einer Übersetzungsressource stammt. Externe Daten – Sendernamen,
Künstler, Titel, Plugin-Namen, Theme-Namen – werden bewusst **nicht**
übersetzt.

## Unterstützte Sprachen

| Locale | Sprache | Status |
| --- | --- | --- |
| `de-DE` | Deutsch | vollständig |
| `en-US` | English | vollständig (Standard- und Rückfallsprache) |

Die Systemsprache wird beim Start erkannt. Nicht unterstützte Sprachen fallen
auf Englisch zurück (`en-US`). Regionale Varianten (`de-AT`, `en-GB`) werden
auf die passende unterstützte Sprache abgebildet; eine Region allein begründet
keine neue Sprache.

## Architektur

```
electron/core/localization/
├── types.js                 Sprachkonstanten und JSDoc-Typen
├── LanguageDetector.js      Systemsprache erkennen und normalisieren
├── TranslationLoader.js     Sprachdateien laden, validieren, cachen (Main)
├── TranslationResolver.js   Schlüssel auflösen, interpolieren, Fallback
├── CatalogValidator.js      Struktur-, Schlüssel- und Platzhalterprüfung
├── LocaleFormatter.js       Datum/Zeit/Zahl/Währung/Prozent/Relative Zeit
├── LocalizationManager.js   Aktive Sprache, Sprachwechsel, Benachrichtigung
├── PluginLocalization.js    Plugin-Kataloge validieren und namensraumen
├── LocalizationCatalogStore.js  Einzige Laufzeitquelle (userData), atomare Writes
├── LocalizationAPI.js       Gescopte APIs für Core, Plugins und Themes
├── LocalizationService.js   Electron-Anbindung, Persistenz, Bootstrap, IPC-Broadcast
├── index.js                 Öffentliche Exporte
└── locales/                 Mitgelieferte Kataloge (nur initiale Bereitstellung)
    ├── de-DE.json
    └── en-US.json

renderer/localization/
├── resources.js             Nur noch Fallback-Konstante (keine Kataloge im Bundle)
├── LocalizationProvider.jsx React-Provider, Bootstrap + IPC-Synchronisation
├── globals.js               Gescopte APIs für Plugin-/Theme-Oberflächen ohne React
├── useTranslation.js        Hook (useSyncExternalStore)
├── instance.js              Zugriff für imperatives DOM (Plugin-Ansichten)
└── index.js                 Öffentliche Exporte
```

### Verantwortlichkeiten

| Komponente | Aufgabe |
| --- | --- |
| `LanguageDetector` | Systemsprache erkennen, Locale normalisieren, unterstützte Sprache zuordnen, Standardfallback |
| `TranslationLoader` | JSON-Dateien laden, validieren, zwischenspeichern; Ladefehler sammeln statt werfen |
| `TranslationResolver` | Verschachtelte Schlüssel, Platzhalter, Fallback-Kette, fehlende Schlüssel einmalig melden |
| `LocalizationManager` | Aktive Sprache, Präferenz, Sprachwechsel, Listener, Formatierer, Plugin-Namensraum |
| `LocaleFormatter` | Ausschließlich native `Intl`-APIs, gecachte Formatter-Instanzen |
| `LocalizationService` | Einmaliges Laden im Main-Prozess, Persistenz über `SettingsManager`, Broadcast an alle Fenster |
| `LocalizationProvider` / `useTranslation` | React-Anbindung ohne Neustart, ohne inkonsistente Zustände |

### Datenfluss

1. `Application.initializeLocalization()` startet den `LocalizationService`
   **vor** dem ersten Fenster.
2. Der Service liest die gespeicherte Präferenz (`settings.json` → `language`)
   und die Systemsprachen (`app.getPreferredSystemLanguages()`), lädt die
   Kataloge und erzeugt den `LocalizationManager`.
3. Main-Prozess-Texte (Tray, Benachrichtigungen, Fenstertitel) rufen
   `LocalizationService.t()` auf.
4. Der Preload liest die Kataloge einmalig synchron über
   `localization:bootstrap`; der Renderer baut daraus seinen Manager. Danach
   werden `localization:get-state` abgefragt und `localization:changed`
   abonniert. Es gibt **keine** gebündelten Kataloge im Renderer – jede
   Laufzeitkopie stammt aus `userData/localization/`.
5. Ein Sprachwechsel im Renderer wirkt sofort lokal und wird anschließend über
   `localization:set-language` persistiert; der Main-Prozess bestätigt und
   sendet den neuen Zustand an alle Fenster (inklusive Einstellungsfenster).

## Sprachdateien

Aufbau: verschachteltes JSON, Punktnotation beim Zugriff.

```json
{
  "navigation": {
    "title": "Navigation",
    "radio": "Radio"
  },
  "player": {
    "volumeTitle": "Lautstärke: {percent}%"
  }
}
```

Regeln:

- Eindeutige, sprechende Schlüssel in Punktnotation (`bereich.element`).
- Gleiche Schlüsselmenge in allen Sprachen.
- Keine leeren Werte, keine Nicht-String-Werte, kein führender/abschließender
  Leerraum.
- Platzhalter ausschließlich als `{name}` mit `[A-Za-z0-9_]`.
- Platzhalter müssen in allen Sprachen identisch sein.
- Doppelte Schlüssel sind unzulässig (werden auch dann erkannt, wenn
  `JSON.parse` sie verwerfen würde).

## Verwendung in React

```jsx
import { useTranslation } from '../localization/index.js';

export default function Example() {
  const { t, locale } = useTranslation();

  return <button title={t('player.settings')}>{t('navigation.settings')}</button>;
}
```

Der Hook liefert zusätzlich:

| Feld | Bedeutung |
| --- | --- |
| `t(key, params?)` | Übersetzung mit Platzhaltern |
| `locale` | aktive Sprache (z. B. `de-DE`) |
| `preference` | gespeicherte Wahl (`system`, `de-DE`, `en-US`) |
| `systemLocale` | erkannte Systemsprache |
| `languages` | unterstützte Sprachen mit Anzeigename |
| `setLanguage(preference)` | Sprachwechsel inkl. Persistenz |
| `formatDate`, `formatTime`, `formatDateTime`, `formatNumber`, `formatPercent`, `formatCurrency`, `formatRelativeFromNow` | regionale Formatierung |

`useTranslation()` verwendet `useSyncExternalStore`. Nur Komponenten, die den
Hook nutzen, rendern bei einem Sprachwechsel neu; der Snapshot bleibt bis zur
nächsten Änderung referenzgleich. `t` ist über Sprachwechsel hinweg stabil.

Für imperativ erzeugte DOM-Knoten (Plugin-Ansichten) stellt
`renderer/localization/instance.js` dieselbe Manager-Instanz bereit:

```js
import { t } from '../localization/instance.js';
element.textContent = t('plugins.viewMissing', { id: viewId });
```

## Neue UI-Texte hinzufügen

1. Schlüssel in **beiden** Sprachdateien ergänzen – identische Struktur.
2. Im Code ausschließlich `t('bereich.schluessel')` verwenden, keine
   String-Literale in JSX.
3. Dynamische Werte als Parameter übergeben: `t('key', { count })`, nicht per
   String-Verkettung.
4. `npm run i18n:validate` ausführen (prüft Schlüssel, Platzhalter, leere
   Werte und unbekannte `t()`-Literale).
5. Kurz prüfen, dass die längere der beiden Übersetzungen das Layout nicht
   sprengt (Beschriftungen kurz halten).

## Typsicherheit ohne TypeScript

Das Projekt verwendet JavaScript. Die Absicherung erfolgt deshalb zweistufig:

- **JSDoc-Typen** in `types.js` (`TranslationKey`, `SupportedLocale`,
  `LanguagePreference`, `TranslationParams`) für Editor-Autovervollständigung
  und Dokumentation.
- **Statische Prüfung** durch `npm run i18n:validate`: Jeder literale
  `t('…')`-Aufruf muss im Katalog existieren; dynamische Schlüssel werden
  gezählt, aber nicht aufgelöst. Die Prüfung läuft in `npm test` und in der CI.

## Fallback- und Fehlerverhalten

Priorität der Auflösung:

1. aktive Sprache,
2. Rückfallsprache (`en-US`),
3. der Schlüssel selbst.

Fehlende Schlüssel werden **einmalig** je Sprache und Schlüssel protokolliert.
Im Entwicklungsmodus (`!app.isPackaged`) erscheinen sie zusätzlich als Warnung
in der Konsole. Im Produktivbetrieb entsteht nie ein leerer Text und nie ein
Absturz; der Schlüssel bleibt als Diagnosehinweis sichtbar.

Eine defekte Sprachdatei verhindert den Start nicht: Der Loader sammelt Fehler,
meldet sie im Log und arbeitet mit den übrigen Ressourcen weiter.

## Spracheinstellungen und Persistenz

Einstellungen → **Sprache** bietet:

- Systemstandard (automatische Erkennung, sonst Englisch)
- Deutsch
- English

Die Auswahl wird über den bestehenden `SettingsManager` in `settings.json`
unter `language` gespeichert (`system`, `de-DE` oder `en-US`). Es werden keine
zusätzlichen Datenbanken oder externen Dienste verwendet. Ungültige
gespeicherte Werte werden verworfen und als Systemstandard behandelt.

Der Wechsel ist sofort wirksam: alle Fenster, Dialoge und offenen
Einstellungsseiten erhalten den neuen Zustand über `localization:changed`.
Benutzereinstellungen bleiben unverändert.

## IPC-Schnittstelle

| Kanal | Richtung | Zweck |
| --- | --- | --- |
| `localization:bootstrap` | sendSync (Preload) | Kataloge + Zustand beim Fensterstart (einziger Textpfad in den Renderer) |
| `localization:get-catalogs` | invoke | Fallback für Anwendungskataloge (nur Daten) |
| `localization:get-state` | invoke | Sprache, Präferenz, Systemsprache, unterstützte Sprachen, Plugin-/Theme-IDs |
| `localization:set-language` | invoke | Präferenz validieren, anwenden, persistieren, Broadcast |
| `localization:get-plugin-catalogs` | invoke | Rohkataloge eines Plugins (nur Daten) |
| `localization:get-plugin-translations` | invoke | aufgelöste Texte eines Plugins |
| `localization:get-theme-catalogs` | invoke | Rohkataloge eines Themes (nur Daten) |
| `localization:changed` | Main → Renderer | Zustandsänderung |

Sicherheit:

- Übersetzungstexte fließen ausschließlich als **Ausgabe** aus validierten
  `userData`-Katalogen in den Renderer; es gibt keine Schreib-IPC.
- Plugin- und Theme-Kataloge werden über eigene, ID-validierte Kanäle geliefert.
- Strenge Validierung: `set-language` akzeptiert ausschließlich
  `system`, `de-DE`, `en-US`; alles andere wird abgelehnt.
- Plugin-IDs werden gegen `^[a-z0-9][a-z0-9-]*$` geprüft.
- Context-Isolation, Preload-Grenze und bestehende Kanäle bleiben unverändert;
  es werden keine Node-APIs exponiert.

## Lokalisierung von Plugins

Plugins deklarieren Übersetzungen als **Daten** im Manifest – niemals als
ausführbaren Code:

```json
{
  "id": "mediahub",
  "localization": {
    "de-DE": { "title": "MediaHub", "signIn": "Anmelden" },
    "en-US": { "title": "MediaHub", "signIn": "Sign in" }
  }
}
```

Regeln und Grenzen:

- Schlüssel liegen ausschließlich unter `plugin.<pluginId>.*`; Anwendungstexte
  können nicht überschrieben werden.
- Ein Plugin sieht nur seine eigenen Übersetzungen
  (`localizationAPI.getPluginTranslations(pluginId)`).
- Validierung: Objektform, gültige Locales, keine leeren Werte, maximale Tiefe
  sechs Ebenen, maximal 2000 Zeichen je Wert, maximal 20 Sprachen.
- Es wird kein fremder JavaScript-Code ausgeführt, um Übersetzungen zu laden.
- Plugin-Berechtigungen werden durch Lokalisierung weder erweitert noch
  verändert.
- Deaktivierte Plugins verlieren ihre registrierten Übersetzungen.

Die Kataloge werden beim Laden aus dem Manifest in
`userData/localization/plugins/<id>/` bereitgestellt und anschließend
ausschließlich von dort gelesen. Plugin-Installation, Update und Rollback
verwalten die Kataloge im selben Schritt wie die Plugin-Dateien (siehe
[Plugin-Updates](PLUGIN_UPDATES.md)); bei der Deinstallation werden sie
kontrolliert entfernt. Die vollständige API-Beschreibung steht in
[Localization API](LOCALIZATION_API.md).

## Formatierung

`LocaleFormatter` nutzt ausschließlich `Intl`:

| Methode | Beispiel (`de-DE`) | Beispiel (`en-US`) |
| --- | --- | --- |
| `formatNumber(1234.5)` | `1.234,5` | `1,234.5` |
| `formatPercent(0.42)` | `42 %` | `42%` |
| `formatDate(date)` | `12.11.2026` | `11/12/2026` |
| `formatRelativeTime(-3, 'day')` | `vor 3 Tagen` | `3 days ago` |

Formatter-Instanzen werden je Sprache und Optionssignatur gecacht. Ungültige
Werte liefern einen leeren String statt `NaN`.

## Tests und Validierung

| Prüfung | Datei | Inhalt |
| --- | --- | --- |
| Unit-Tests | `scripts/tests/localization.test.js` | Detector, Resolver, Manager, Formatter, Validator, Loader, Plugins |
| API- und Isolations-Tests | `scripts/tests/localization-api.test.js` | Core-/Plugin-/Theme-Scopes, `userData`-Store, Provisionierung, Rollback, Deinstallation, Listener-Cleanup |
| Integrationstests (simuliert) | `scripts/tests/localization-integration.test.js` | Initialisierung, Sprachwechsel, Persistenz, Renderer-Store, Fallback, Plugin-Fluss |
| Vollständigkeitscheck | `scripts/localization/validate-translations.js` | Schlüsselgleichheit, Duplikate, leere Werte, Platzhalter, unbekannte `t()`-Schlüssel |

```bash
npm run i18n:validate
node scripts/tests/localization.test.js
node scripts/tests/localization-integration.test.js
```

Die Integrationstests bilden Main-Prozess, Persistenz und Renderer-Store nach;
sie starten **kein** Electron-Fenster. Ein echter UI-Test (Sprachwechsel im
laufenden Fenster, native Tray-Beschriftung) ist damit nicht abgedeckt und muss
manuell geprüft werden.

## Performance

- Kataloge werden einmalig beim Start aus `userData` gelesen (Bootstrap) –
  keine Dateizugriffe beim Sprachwechsel.
- Plugin- und Theme-Kataloge werden nur bei Zustandsänderungen (IDs) gezielt
  nachgeladen; die Broadcast-Nachricht selbst enthält keine Texte.
- Keine Netzwerkzugriffe, keine externen Dienste, keine KI-Übersetzung.
- Ein Sprachwechsel benachrichtigt nur Abonnenten (`useSyncExternalStore`);
  unveränderte Zustände lösen kein Re-Render aus.
- Der Sprachwechsel ist synchron und ohne Neustart wirksam.
- Zusätzliches Bundle-Gewicht: zwei JSON-Kataloge (rund 20 KB unkomprimiert).

## Erweiterung um eine weitere Sprache

1. `electron/core/localization/locales/<locale>.json` anlegen – vollständig,
   gleiche Schlüsselstruktur.
2. `SUPPORTED_LOCALES` in `types.js` ergänzen und `LANGUAGE_LABELS` um den
   Anzeigenamen erweitern.
3. Gegebenenfalls `LANGUAGE_FAMILIES` ergänzen (Sprachfamilie → Locale), damit
   Regionen derselben Sprache automatisch zugeordnet werden.
4. `npm run i18n:validate` und `npm test` ausführen.
5. Prüfen, ob die neue Sprache als Systemsprache korrekt erkannt wird.

Weitere Änderungen an der Architektur sind dafür nicht erforderlich.

## Bekannte Einschränkungen

- Plugin- und Theme-Namen sowie externe Radiometadaten werden nicht übersetzt.
- Der Splash-Screen zeigt weiterhin neutrale Marken- und Statustexte; er läuft
  vor der Initialisierung der Engine.
- Native Tray-Beschriftungen werden nach einem Sprachwechsel neu aufgebaut;
  unter Linux kann das Betriebssystem das Menü erst beim nächsten Öffnen
  aktualisieren.
- Es gibt keinen automatisierten UI-Test für den Sprachwechsel im laufenden
  Electron-Fenster.
