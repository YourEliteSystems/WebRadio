# WebRadio Roadmap (überarbeitet)

Diese Roadmap beschreibt die technische Weiterentwicklung von WebRadio mit Fokus auf stabile Architektur, klare Schnittstellen und langfristige Erweiterbarkeit. Reihenfolge und Inhalte können sich je nach Implementierungsaufwand anpassen.

---

## 🧭 Gesamtstrategie

Ziel ist der schrittweise Umbau von einer funktionalen Desktop-App hin zu einer klar modularisierten Plattform mit stabiler Plugin- und Theme-Architektur.

Kernprinzipien:

* Strikte Trennung von Core, Plugins und Renderer
* Keine direkte Kopplung von Plugins an interne Implementierungen
* Audio-Pipeline als eigenständiges, isoliertes System
* IPC nur über definierte Schnittstellen
* Versionierte Plugin-API ab v1.2

---

## 🔄 v1.0.x – Stabilisierung (aktueller Fokus)

**Ziel:** React-Integration stabilisieren und Altlasten entfernen

### Aufgaben

* Entfernung alter DOM-/Legacy-Module
* Bereinigung ungenutzter Dependencies
* Stabilisierung von Stream-Start, Wechsel und Stop
* Sicherstellung stabiler Favoriten- und Verlaufssysteme
* Update-System stabilisieren
* Grundlegende Plugin- und Theme-Kompatibilität sicherstellen

### Kritische Punkte

* `main.js` bleibt vorerst zentral, aber ohne neue Logik
* keine neuen Systeme in den Core einführen

---

## 🧱 v1.1 – Architektur-Refactoring (Core-Struktur)

**Ziel:** Einführung klarer Module und Entkopplung des Electron-Main-Prozesses

### Zielstruktur

electron/core/
app/
window/
audio/
ipc/
plugins/
themes/
updates/
events/

### Aufgaben

* Einführung von Manager-Strukturen:

  * WindowManager
  * AudioManager
  * PluginManager
  * IPCManager
  * UpdateManager
* Entfernung von Logik aus `main.js`
* Einführung eines zentralen EventBus (Core-intern)
* Vorbereitung für stabile Plugin-API

### Ergebnis

* `main.js` nur noch Bootstrap-Layer

---

## 🔌 v1.2 – Plugin-System (API-Fundament)

**Ziel:** Stabil definierte Plugin-Schnittstelle mit Versionskontrolle

### Kernfeatures

* Einführung `apiVersion` im Plugin-Manifest
* Standardisierte Plugin-Lifecycle-Events
* Trennung von Core und Plugin Runtime
* Einführung eines kontrollierten API-Layers

### Plugin-Regeln

* Kein direkter Zugriff auf Core-Module
* Zugriff nur über `api.*`
* Event-basierte Kommunikation
* Renderer-Plugins nur über definierte Bridge

### Beispielstruktur

{
"name": "DiscordRPC",
"version": "1.0.0",
"apiVersion": "1.0"
}

### API-Basis

* api.audio
* api.stations
* api.events
* api.settings

---

## 🎨 v1.3 – Theme-System (Standardisierung)

**Ziel:** Einheitliches, stabiles Theme-System ohne Logikabhängigkeit

### Aufgaben

* Einführung ThemeManager
* Standardisierung von CSS Variables
* Trennung Theme-Daten vs. UI-Logik
* Versionierung von Themes

### Funktionen (optional)

* Theme Preview
* Live Switch
* Theme Import/Export

---

## 🪟 v1.4 – App Shell (Desktop-Integration)

**Ziel:** Vollständige Desktop-Integration stabilisieren

### Aufgaben

* WindowManager finalisieren
* Tray-System implementieren
* Media-Key Support aktivieren
* Background Mode stabilisieren
* Autostart optional integrieren

### Funktionen

* Tray Controls (Play/Stop/Exit)
* Fensterzustände synchronisiert
* globale Mediensteuerung

---

## 🎧 v1.5 – Audio & Performance (kritischer Bereich)

**Ziel:** stabile und performante Audio-Architektur

### Aufgaben

* Reduzierung von IPC-Audio-Overhead
* Einführung eines Ringbuffers für PCM
* Optimierung AudioWorklet
* stabiler Stream-Wechsel ohne Unterbrechungen
* Fehler- und Reconnect-Handling

### Zielbild

* Audio läuft unabhängig vom Renderer
* keine UI-Abhängigkeit im Audiofluss

---

## 🧪 v1.6 – Observability & Debugging

**Ziel:** saubere Fehleranalyse und Monitoring

### Aufgaben

* Sentry Integration (React + Electron)
* Sourcemap Pipeline
* strukturierte Error Logs
* optionaler Debug-Mode im UI

### Features

* Opt-in Crash Reporting
* Kontextuelle Fehlerdaten (Stream, Plugin, Version)

---

## 🌟 v2.0 – Plattform-Release

**Ziel:** WebRadio als erweiterbare Plattform

### Kernziele

* stabile Plugin-API (finalisiert)
* erweitertes Theme-System
* Community-Erweiterbarkeit
* stabile Desktop Shell
* langfristige API-Kompatibilität

### Erweiterungen

* Plugin Permissions System
* Plugin Settings UI
* Theme Gallery Konzept
* erweiterte Senderverwaltung
* stabile Update Pipeline

---

## 💡 Zukunftsideen (optional)

* Equalizer
* Sleep Timer / Wecker
* Aufnahmefunktion
* Stream Health Monitoring
* Favoriten Import/Export
* Community Plugin Store
* Linux / macOS Builds

---

## 🧭 Prioritätenmodell

### kurzfristig

* Stabilisierung v1.0.x
* Altcode entfernen
* React sauber integrieren

### mittelfristig

* Core Refactoring (v1.1)
* Plugin API (v1.2)
* Theme System (v1.3)

### langfristig

* App Shell
* Audio Performance
* Observability
* Plattform-Ausbau (v2.0)
