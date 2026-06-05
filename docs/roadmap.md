# WebRadio Roadmap

Diese Roadmap zeigt die grobe Richtung fuer kommende WebRadio-Versionen. Sie ist bewusst als Planungsdokument gedacht: Reihenfolge, Inhalte und Versionen koennen sich je nach Stabilitaet, Tests und Aufwand noch aendern.

## v1.0.x - Stabilisierung

Ziel: Die aktuelle React-Version sauber stabilisieren und Altlasten reduzieren.

Geplant:

- alte Relikte aus der Vor-React-Zeit entfernen
- ungenutzte Dependencies reduzieren
- Audio-Stabilitaet verbessern
- Stream-Start, Stream-Wechsel und Stop robuster machen
- Favoriten und Verlauf weiter pruefen
- Update-Check stabil halten
- Plugin- und Theme-Grundsystem funktionsfaehig halten
- kleinere UI- und Settings-Korrekturen

Moegliche Kandidaten:

- `database.js` entfernen
- alte DOM-basierte Renderer-Services entfernen
- nicht genutzte Tracking-/Analytics-Pakete entfernen
- Sentry vorerst parken, aber nicht aufgeben

## v1.1 - Core-Aufraeumung

Ziel: Die interne Struktur besser wartbar machen, damit neue Features nicht direkt in `main.js` landen.

Geplant:

- Core-Struktur neu ordnen
- Plugin-System nach `electron/core/plugins/` verschieben
- Audio-Logik aus `main.js` weiter auslagern
- Update-Logik nach `electron/core/updates/` verschieben
- EventBus und Plugin-Events sauberer trennen
- Window- und Settings-Window-Logik vorbereiten

Moegliche neue Struktur:

```txt
electron/core/
  app/
  audio/
  events/
  plugins/
  storage/
  themes/
  updates/
```

## v1.2 - Plugin-System Ausbau

Ziel: Plugins sollen leichter wartbar, dokumentierbar und erweiterbar werden.

Geplant:

- Plugin-API-Versionen einfuehren
- Plugin-Events vereinheitlichen
- neue Events fuer Streamfehler, Favoriten, Verlauf und Senderwechsel
- Plugin-Einstellungen vorbereiten
- Plugin-Konfiguration besser vom Runtime-Code trennen
- Renderer-Plugins sicherer und klarer einbinden
- Developer Guide fuer Plugins erweitern

Moegliche Funktionen:

- Plugin-Einstellungen im Settings-Fenster
- Plugin-Statusanzeige
- Plugin-Reload ohne App-Neustart verbessern
- einfachere Beispiel-Plugins

## v1.3 - Theme-System Neuordnung

Ziel: Das Theme-System von der Uebergangsloesung zu einem stabileren System machen.

Geplant:

- Theme-Manager einfuehren
- Theme-Metadaten erweitern
- CSS-Variablen standardisieren
- Theme-Kompatibilitaet zur App-Version kennzeichnen
- Theme-Wechsel im Renderer sauberer behandeln
- Developer Guide fuer Themes erweitern

Moegliche Funktionen:

- Theme-Vorschau
- Live-Preview
- Theme-Import
- Theme-Export
- bessere Theme-Beispiele

## v1.4 - App Shell

Ziel: Desktop-Funktionen zentralisieren und wieder aktivieren.

Geplant:

- WindowManager fuer MainWindow und SettingsWindow
- Tray-System neu anbinden
- Hintergrundbetrieb vorbereiten
- Media-Keys reaktivieren
- App-Schliessen, Minimieren und Wiederherstellen sauberer behandeln
- Settings-Fenster robuster verwalten

Moegliche Funktionen:

- minimieren in den Tray
- Tray-Menue mit Play, Stop, Einstellungen und Beenden
- globale Media-Tasten
- optionaler Autostart
- optionaler Start minimiert

## v1.5 - Audio und Performance

Ziel: Die Wiedergabe effizienter und robuster machen.

Geplant:

- PCM-IPC-Verkehr reduzieren oder besser puffern
- AudioWorklet-Buffering verbessern
- Ringbuffer fuer PCM-Daten pruefen
- Visualizer effizienter zeichnen
- Renderer-Listener mit sauberem Cleanup versehen
- stabilere Fehlerbehandlung bei toten oder langsamen Streams

Moegliche Funktionen:

- Stream-Fehleranzeige
- automatische Wiederverbindung
- sauberer Senderwechsel ohne Haenger
- optionale Audio-Diagnose im Debug-Modus

## v1.6 - Sentry und Diagnose

Ziel: Fehlerberichte fuer groessere Testgruppen wieder sauber nutzbar machen.

Geplant:

- Sentry mit React-Bundle neu anbinden
- Sourcemaps fuer Renderer-Build erzeugen
- Sentry-Release-Upload pruefen
- Fehlerkontext fuer Streams, Plugins und App-Version erfassen
- Datenschutz-Hinweise vorbereiten

Moegliche Funktionen:

- opt-in Fehlerberichte
- interne Diagnoseanzeige
- bessere Crash- und Fehlerlogs

## v2.0 - Erweiterbarer WebRadio-Player

Ziel: WebRadio als klar erweiterbaren Desktop-Radio-Player positionieren.

Moegliche grosse Funktionen:

- stabilere Plugin-API
- Plugin-Permissions
- Plugin-Settings
- ausgebautes Theme-System
- bessere Senderverwaltung
- erweiterte Suche und Filter
- stabiler Tray- und Media-Key-Support
- bessere Release- und Update-Erfahrung
- Wiki fuer Plugin- und Theme-Entwicklung

## Ideen fuer spaetere Versionen

Diese Punkte sind Ideen, aber noch nicht fest geplant:

- Equalizer
- Aufnahmefunktion
- Sleep-Timer
- Wecker
- Benachrichtigungen bei neuem Song
- Stream-Health-Anzeige
- eigene Senderquellen
- Import und Export von Favoriten
- Plugin-/Theme-Galerie
- offizielle Linux-Builds
- macOS-Builds

## Prioritaet

Kurzfristig:

- 1.0.4 stabilisieren
- Altcode entfernen
- Dependencies reduzieren
- Audio und Update-Check pruefen

Mittelfristig:

- Core-Struktur umbauen
- Plugin-System erweitern
- Theme-System neu ordnen

Langfristig:

- Sentry reaktivieren
- Desktop-Funktionen ausbauen
- Wiki/Dokumentation dezentralisieren
- Community-Plugins und Community-Themes ermoeglichen
