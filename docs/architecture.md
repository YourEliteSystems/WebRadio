# 📖 Architekturleitfaden für WebRadio

**Version:** 3.0  
**Gilt für:** WebRadio v1.0.7-alpha.5 und neuer

---

# Einführung

Willkommen beim Architekturleitfaden von WebRadio.

Dieses Dokument gibt einen Überblick über die interne Architektur von WebRadio und erklärt, wie die zentralen Komponenten der Anwendung zusammenarbeiten.

Im Gegensatz zu einer klassischen API-Referenz konzentriert sich dieser Leitfaden auf die Entwurfsentscheidungen hinter dem Projekt. Er erklärt nicht nur, *wie* WebRadio funktioniert, sondern auch, *warum* es auf diese Weise aufgebaut ist.

Wer die Architektur versteht, kann leichter zum Projekt beitragen, Plugins entwickeln, Themes erstellen oder bestehende Funktionen erweitern.

---

# Architekturprinzipien

WebRadio folgt einem einfachen Grundsatz:

> **Der Kern bleibt klein, modular und wartbar. Neue Funktionen kommen über Erweiterungen hinzu.**

Jede größere Komponente hat eine klar definierte Aufgabe.

Anstatt eng gekoppelte Systeme zu schaffen, trennt WebRadio Funktionen in unabhängige Module, die über klar definierte Schnittstellen miteinander kommunizieren.

Dieser Ansatz bietet mehrere Vorteile:

- bessere Wartbarkeit
- einfachere Tests
- bessere Skalierbarkeit
- übersichtlicherer Quellcode
- einfachere Fehlersuche
- bessere Unterstützung für Plugins und Themes

---

# Architektur auf hoher Ebene

Die Anwendung startet an einem zentralen Einstiegspunkt.

```text
main.js
    │
    ▼
Application
```

Die Klasse `Application` ist für die Initialisierung und Verwaltung aller Core-Subsysteme zuständig.

Anstatt die Startlogik in `main.js` abzulegen, wird die Initialisierung an die Klasse `Application` delegiert. Dadurch bleibt der Einstiegspunkt klein und der Startablauf vorhersehbar.

---

# Core-Komponenten

Die Klasse `Application` initialisiert die Subsysteme in einer festgelegten Reihenfolge.

```text
Application
    │
    ├── StorageManager
    ├── Diagnostics
    ├── WindowManager
    ├── IPC
    ├── PluginManager
    ├── ThemeManager
    ├── Media Keys
    ├── Tray
    └── Updater

Unterstützende Core-Module:
    │
    ├── StreamManager (FFmpeg-Stream-Verarbeitung)
    ├── RadioBrowserService (Sendersuche)
    ├── RuntimeDetector (Erkennung von Plattform und Paketierung)
    ├── UpdateProviderFactory (Auswahl des Update-Anbieters)
    ├── NavigationManager (Plugin-gesteuerte Navigation)
    ├── ThemeManager (Erkennung und Aktivierung von Themes)
    ├── PluginManager (Plugin-Lebenszyklus)
    └── Diagnostics (Protokollierung und Absturzberichte)
```

Jedes Subsystem ist für einen klar abgegrenzten Bereich der Anwendung verantwortlich.

Keine Komponente sollte Aufgaben übernehmen, die zu einem anderen Subsystem gehören.

---

# Überblick über die Core-Module

WebRadio unterscheidet zwischen übergeordneten Managern und unterstützenden Core-Modulen.

## Manager auf hoher Ebene

- **Application** – koordiniert Start und Beenden der Anwendung.
- **StorageManager** – speichert Anwendungs- und Plugin-Daten dauerhaft.
- **WindowManager** – verwaltet das Hauptfenster und dessen Lebenszyklus.
- **IPC** – stellt eine kontrollierte Verbindung zwischen Main- und Renderer-Prozess bereit.
- **PluginManager** – findet und verwaltet Plugins.
- **ThemeManager** – erkennt und aktiviert Themes.
- **UpdateManager** – koordiniert Update-Prüfungen und die Auswahl des Anbieters.
- **Tray** – stellt die Integration in den System-Tray bereit.
- **Diagnostics** – sammelt Logs, Laufzeitinformationen und Kontext zu Abstürzen.

## Unterstützende Core-Module (neuere Ergänzungen)

- **StreamManager** – startet und steuert Audiostreams auf Basis von FFmpeg.
- **PlayerManager / RadioProvider / MediaHubProvider** – bilden den Unified Player: eine gemeinsame Zustandsmaschine und ein Provider-Register für alle Wiedergabequellen.
- **RadioBrowserService** – ruft Senderlisten und Metadaten über die Radio-Browser-API ab.
- **RuntimeDetector** – erkennt zur Laufzeit Plattform, Architektur und Pakettyp.
- **ProviderFactory** – wählt den passenden Update-Anbieter für die erkannte Laufzeit aus.
- **NavigationManager** – verwaltet Seitenleisten- und Plugin-Navigationseinträge.
- **ThemeAPI / ThemeHandlers** – verbinden Theme-Auswahl und -Aktivierung der Benutzeroberfläche mit dem Core.
- **RadioHandlers / UpdaterHandlers** – stellen Radio-Wiedergabe und Update-Funktionen über IPC bereit.

---

# Warum eine Application-Klasse?

Eine der wichtigsten Architekturentscheidungen bei WebRadio war die Einführung einer eigenen Klasse `Application`.

Anstatt die Initialisierungslogik über viele Dateien zu verteilen, werden Start- und Beendigungsvorgänge zentralisiert.

Das bietet mehrere Vorteile:

- ein klarer Lebenszyklus der Anwendung
- einfachere Fehlersuche
- vorhersehbare Startreihenfolge
- einfachere Wartung
- klare Trennung der Zuständigkeiten

`Application` koordiniert die gesamte Desktop-Anwendung.

---

# Startablauf

Ein vereinfachter Startablauf sieht folgendermaßen aus:

```text
Application.start()

↓

Speicher initialisieren

↓

Diagnose initialisieren

↓

Hauptfenster erstellen

↓

IPC registrieren

↓

Themes laden

↓

Plugins laden

↓

UpdateManager initialisieren

↓

Stream- und Radio-Dienste initialisieren

↓

Medientasten registrieren

↓

System-Tray erstellen

↓

Anwendung bereit
```

Jedes Subsystem wird genau einmal und in einer vorgegebenen Reihenfolge initialisiert.

Die Update- und Radio-Subsysteme werden nach der Plugin- und Theme-Schicht initialisiert, damit die Anwendung plattformspezifische und Plugin-bezogene Entscheidungen zur Laufzeit treffen kann.

---

# Trennung der Zuständigkeiten

WebRadio folgt dem **Single-Responsibility-Prinzip**.

Jede Komponente hat genau eine primäre Aufgabe.

Beispiele:

- **StorageManager** verwaltet Anwendungsdaten.
- **PluginManager** verwaltet Plugins.
- **ThemeManager** verwaltet Themes.
- **WindowManager** verwaltet Anwendungsfenster.
- **Diagnostics** sammelt Logs und Informationen zu Abstürzen.

Durch die klare Trennung lassen sich Funktionen leichter erweitern, ohne unerwünschte Abhängigkeiten einzuführen.

---

# Erweiterbarkeit

WebRadio wurde so entworfen, dass es erweitert werden kann, ohne den Core verändern zu müssen.

Neue Funktionen sollten über folgende Mechanismen umgesetzt werden:

- Plugins
- Themes
- öffentliche APIs

Wenn möglich, sollten Mitwirkende Änderungen am Core vermeiden, sofern keine neue Infrastruktur benötigt wird.

So bleiben Updates stabil, während die Community die Anwendung erweitern kann.

---

# Laufzeitdienste

Zusätzlich zu den Managern verwendet WebRadio verschiedene Core-Dienste zur Laufzeit:

- **StreamManager** – verwaltet die Wiedergabe über FFmpeg.
- **PlayerManager** – Zustände, Provider-Register und Steuerung des Unified Players.
- **RadioBrowserService** – sucht Sender und speichert Metadaten zwischen.
- **RuntimeDetector** – erkennt Plattform, Architektur und Pakettyp.
- **ProviderFactory** – wählt den passenden Update-Anbieter.
- **NavigationManager** – verwaltet Seitenleisten- und Plugin-Navigation.

---

# Nächste Schritte

Die folgenden Dokumente beschreiben die einzelnen Subsysteme ausführlicher:

- Application
- Plugin-System
- Theme-System
- Aktualisierungsarchitektur
- Speicherverwaltung
- Diagnose
- IPC
- API-Referenz
- StreamManager
- Unified Player
- RadioBrowserService

Jeder Leitfaden baut auf den Konzepten dieses Dokuments auf.
