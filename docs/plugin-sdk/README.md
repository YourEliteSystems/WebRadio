# WebRadio Plugin-SDK

> 📌 **Architekturhinweis:**  
> WebRadio verwendet ausschließlich dieses modulare Plugin-System (`electron/core/plugins/`). Alle Plugins werden über diesen Plugin-Manager geladen, verwaltet und ausgeführt. Veraltete Plugin-Schnittstellen wurden vollständig entfernt.

Willkommen beim **WebRadio Plugin-SDK**.

Diese Dokumentation erklärt alles, was du wissen musst, um Plugins für WebRadio zu entwickeln.

Egal, ob du deine erste Erweiterung erstellst oder eine komplexe Integration entwickelst: Dieser Leitfaden führt dich durch alle Bereiche der Plugin-Entwicklung.

Das Plugin-SDK stellt eine stabile, einheitliche und leicht nutzbare Schnittstelle zwischen deinem Plugin und dem WebRadio-Core bereit.

---

# Was sind Plugins?

Plugins erweitern WebRadio, ohne dass du den Quellcode der Anwendung ändern musst.

Ein Plugin kann neue Funktionen hinzufügen und dabei unabhängig vom Anwendungskern bleiben.

Beispiele:

- Integrationen für Musikdienste
- Discord Rich Presence
- Anbieter für Benachrichtigungen
- Audio-Visualisierungen
- Eigene Seiten in der Seitenleiste
- Einstellungsseiten
- Hilfswerkzeuge
- Entwicklerwerkzeuge
- Integrationen externer Dienste

Das Plugin-SDK soll die Plugin-Entwicklung vereinfachen und gleichzeitig den WebRadio-Core stabil und wartbar halten.

---

# Warum das Plugin-SDK verwenden?

Das Plugin-SDK bietet eine strukturierte Möglichkeit, mit WebRadio zu interagieren.

Mit dem SDK stellst du sicher, dass dein Plugin:

- sauber in die Anwendung integriert wird,
- mit zukünftigen Versionen kompatibel bleibt,
- denselben Lebenszyklus wie andere Plugins verwendet,
- sicher auf öffentliche APIs zugreifen kann,
- vom Anwendungskern isoliert bleibt.

Plugins sollten interne Anwendungskomponenten niemals direkt verändern.

Stattdessen kommunizieren sie über die öffentliche Plugin-API.

---

# Lebenszyklus eines Plugins

Jedes Plugin durchläuft denselben Lebenszyklus.

```text
Plugin-Ordner

↓

Manifest prüfen

↓

Registrierung

↓

Initialisierung

↓

Ausführung

↓

Beenden
```

Das Verständnis dieses Lebenszyklus ist eine wichtige Voraussetzung für die Plugin-Entwicklung.

Die folgenden Kapitel erläutern jede Phase im Detail.

---

# Was du lernen wirst

Dieser Leitfaden behandelt alle wichtigen Aspekte der Plugin-Entwicklung, darunter:

- das erste Plugin erstellen
- das Manifest verstehen
- Projektdateien strukturieren
- Plugin-Lebenszyklus
- Plugin-Kontext
- Storage-API
- Ereignisse
- Hooks
- Integration der Benutzeroberfläche
- bewährte Vorgehensweisen
- Beispiel-Plugins

Vorkenntnisse über die internen Abläufe von WebRadio sind nicht erforderlich.

---

# Voraussetzungen

Vor der Plugin-Entwicklung solltest du mit Folgendem vertraut sein:

- JavaScript (ES2022 oder neuer)
- Node.js
- JSON
- grundlegende Konzepte von Electron

Kenntnisse der internen WebRadio-Architektur sind hilfreich, aber nicht erforderlich.

---

# Aufbau der Dokumentation

Das Plugin-SDK ist in folgende Kapitel unterteilt.

```text
README

↓

Erste Schritte

↓

Manifest

↓

Projektstruktur

↓

Lebenszyklus

↓

Plugin-Kontext

↓

Plugin-API

↓

Speicher

↓

Ereignisse

↓

Hooks

↓

UI-Integration

↓

Navigation (Seitenleiste und Bereiche)

↓

Capabilities und Plugin-HTTP-Umgebung

↓

Bewährte Vorgehensweisen

↓

Hallo Welt

↓

Häufige Fragen (FAQ)
```

Jedes Kapitel baut auf dem vorherigen auf.

Für den besten Einstieg empfiehlt es sich, die Kapitel der Reihe nach zu lesen.

---

# Architekturprinzipien

Das Plugin-SDK folgt mehreren wichtigen Grundsätzen.

## Stabilität

Öffentliche APIs sollen nach Möglichkeit stabil bleiben.

---

## Einfachheit

Häufige Aufgaben sollen mit möglichst wenig Code umgesetzt werden können.

---

## Isolation

Plugins sollen unabhängig voneinander arbeiten und sich nicht gegenseitig beeinträchtigen.

---

## Erweiterbarkeit

Das SDK soll gemeinsam mit WebRadio wachsen können, ohne bestehende Plugins zu beschädigen.

---

# Hilfe erhalten

Wenn du bei der Plugin-Entwicklung auf Probleme stößt, helfen dir möglicherweise folgende Ressourcen:

- Dokumentation zum Plugin-SDK
- Architekturdokumentation
- API-Referenz
- GitHub-Issues
- GitHub-Discussions

---

# Nächster Schritt

Fahre mit **Erste Schritte** fort, um dein erstes WebRadio-Plugin zu erstellen.
