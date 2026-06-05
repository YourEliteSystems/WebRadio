# WebRadio Roadmap

Diese Roadmap zeigt die grobe Richtung für kommende WebRadio-Versionen. Sie ist ein Planungsdokument: Reihenfolge, Inhalte und Versionen können sich durch Tests, Aufwand oder neue Prioritäten ändern.

| Version | Status | Schwerpunkt | Zielbild |
| --- | --- | --- | --- |
| `v1.0.x` | 🔄 in Arbeit | Stabilisierung | React-Version sauber und schlank machen |
| `v1.1` | 🧭 geplant | Core-Aufräumung | wartbare Modulstruktur |
| `v1.2` | 🧭 geplant | Plugin-System | bessere API und mehr Events |
| `v1.3` | 🧭 geplant | Theme-System | stabilere Themes und Vorschau |
| `v1.4` | 💡 vorgesehen | App Shell | Tray, Fenster und Media-Keys |
| `v1.5` | 💡 vorgesehen | Audio & Performance | effizientere Wiedergabe |
| `v1.6` | 💡 vorgesehen | Sentry & Diagnose | bessere Fehlerberichte |
| `v2.0` | 🌟 Vision | Erweiterbarer Player | klare Produktbasis mit Community-Potenzial |

## 🔄 v1.0.x - Stabilisierung

**Ziel:** Die aktuelle React-Version stabilisieren und Altlasten reduzieren.

| Bereich | Geplant |
| --- | --- |
| Code | Relikte aus der Vor-React-Zeit entfernen |
| Dependencies | ungenutzte Pakete reduzieren |
| Audio | Stream-Start, Wechsel und Stop robuster machen |
| Daten | Favoriten und Verlauf prüfen |
| Updates | Update-Check stabil halten |
| Erweiterungen | Plugin- und Theme-Grundsystem funktionsfähig halten |

Mögliche Kandidaten:

- `database.js` entfernen
- alte DOM-basierte Renderer-Services entfernen
- nicht genutzte Tracking-/Analytics-Pakete entfernen
- Sentry parken, aber nicht aufgeben

## 🧱 v1.1 - Core-Aufräumung

**Ziel:** Die interne Struktur besser wartbar machen, damit neue Features nicht direkt in `main.js` landen.

Geplant:

- Core-Struktur neu ordnen
- Plugin-System nach `electron/core/plugins/` verschieben
- Audio-Logik aus `main.js` auslagern
- Update-Logik nach `electron/core/updates/` verschieben
- EventBus und Plugin-Events sauberer trennen
- Window- und Settings-Window-Logik vorbereiten

Mögliche Struktur:

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

## 🔌 v1.2 - Plugin-System Ausbau

**Ziel:** Plugins sollen leichter wartbar, dokumentierbar und erweiterbar werden.

| Thema | Geplant |
| --- | --- |
| API | Plugin-API-Versionen einführen |
| Events | Events vereinheitlichen |
| Settings | Plugin-Einstellungen vorbereiten |
| Runtime | Plugin-Konfiguration vom Laufzeitcode trennen |
| Renderer | Renderer-Plugins klarer einbinden |
| Doku | Developer Guide erweitern |

Mögliche Funktionen:

- Plugin-Einstellungen im Settings-Fenster
- Plugin-Statusanzeige
- besserer Reload ohne App-Neustart
- einfache Beispiel-Plugins

## 🎨 v1.3 - Theme-System Neuordnung

**Ziel:** Das Theme-System von der Übergangslösung zu einem stabileren System machen.

Geplant:

- Theme-Manager einführen
- Theme-Metadaten erweitern
- CSS-Variablen standardisieren
- Theme-Kompatibilität zur App-Version kennzeichnen
- Theme-Wechsel im Renderer sauberer behandeln
- Developer Guide für Themes erweitern

Mögliche Funktionen:

- Theme-Vorschau
- Live-Preview
- Theme-Import
- Theme-Export
- bessere Theme-Beispiele

## 🪟 v1.4 - App Shell

**Ziel:** Desktop-Funktionen zentralisieren und wieder aktivieren.

| Bereich | Geplant |
| --- | --- |
| Fenster | WindowManager für MainWindow und SettingsWindow |
| Tray | Tray-System neu anbinden |
| Hintergrund | Minimieren und Wiederherstellen sauber behandeln |
| Steuerung | Media-Keys reaktivieren |
| Start | Autostart und Start minimiert prüfen |

Mögliche Funktionen:

- minimieren in den Tray
- Tray-Menü mit Play, Stop, Einstellungen und Beenden
- globale Media-Tasten
- optionaler Autostart
- optionaler Start minimiert

## 🎧 v1.5 - Audio und Performance

**Ziel:** Die Wiedergabe effizienter und robuster machen.

Geplant:

- PCM-IPC-Verkehr reduzieren oder besser puffern
- AudioWorklet-Buffering verbessern
- Ringbuffer für PCM-Daten prüfen
- Visualizer effizienter zeichnen
- Renderer-Listener mit sauberem Cleanup versehen
- bessere Fehlerbehandlung bei toten oder langsamen Streams

Mögliche Funktionen:

- Stream-Fehleranzeige
- automatische Wiederverbindung
- sauberer Senderwechsel ohne Hänger
- optionale Audio-Diagnose im Debug-Modus

## 🧪 v1.6 - Sentry und Diagnose

**Ziel:** Fehlerberichte für größere Testgruppen wieder sauber nutzbar machen.

Geplant:

- Sentry mit React-Bundle neu anbinden
- Sourcemaps für Renderer-Build erzeugen
- Sentry-Release-Upload prüfen
- Fehlerkontext für Streams, Plugins und App-Version erfassen
- Datenschutz-Hinweise vorbereiten

Mögliche Funktionen:

- opt-in Fehlerberichte
- interne Diagnoseanzeige
- bessere Crash- und Fehlerlogs

## 🌟 v2.0 - Erweiterbarer WebRadio-Player

**Ziel:** WebRadio als klar erweiterbaren Desktop-Radio-Player positionieren.

Mögliche große Funktionen:

- stabilere Plugin-API
- Plugin-Permissions
- Plugin-Settings
- ausgebautes Theme-System
- bessere Senderverwaltung
- erweiterte Suche und Filter
- stabiler Tray- und Media-Key-Support
- bessere Release- und Update-Erfahrung
- Wiki für Plugin- und Theme-Entwicklung

## 💡 Ideen für spätere Versionen

Diese Punkte sind Ideen, aber noch nicht fest geplant:

| Idee | Nutzen |
| --- | --- |
| Equalizer | mehr Kontrolle über Klang |
| Aufnahmefunktion | Streams lokal mitschneiden |
| Sleep-Timer | App automatisch stoppen |
| Wecker | Sender zeitgesteuert starten |
| Benachrichtigungen | neuer Song oder Senderstatus |
| Stream-Health | Qualität und Erreichbarkeit anzeigen |
| eigene Senderquellen | mehr Flexibilität |
| Favoriten-Import/-Export | bessere Sicherung |
| Plugin-/Theme-Galerie | Community-Inhalte leichter nutzen |
| offizielle Linux-Builds | breitere Plattformunterstützung |
| macOS-Builds | spätere Plattformoption |

## 🧭 Prioritäten

| Zeitraum | Fokus |
| --- | --- |
| kurzfristig | `v1.0.4` stabilisieren, Altcode entfernen, Dependencies reduzieren |
| mittelfristig | Core-Struktur umbauen, Plugin-System erweitern, Theme-System neu ordnen |
| langfristig | Sentry reaktivieren, Desktop-Funktionen ausbauen, Wiki und Community-Erweiterungen ermöglichen |
