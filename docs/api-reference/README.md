# WebRadio API-Referenz

Willkommen bei der API-Referenz von WebRadio.

Diese Referenz dokumentiert die aktuellen APIs für Plugins und kennzeichnet geplante oder noch nicht implementierte Dienste ausdrücklich.

Während das Plugin-SDK und das Theme-SDK das Lernen und praktische Beispiele in den Mittelpunkt stellen, dient die API-Referenz als offizielle technische Spezifikation des WebRadio-SDK.

---

# Zweck

Die API-Referenz beschreibt detailliert alle öffentlichen Klassen, Schnittstellen und Dienste, die WebRadio bereitstellt.

Zu jeder API findest du:

- Überblick
- Zuständigkeiten
- Konstruktoren
- Eigenschaften
- Methoden
- Parameter
- Rückgabewerte
- Ereignisse
- Berechtigungen
- Beispiele
- bewährte Vorgehensweisen

Diese Dokumentation sollte zusammen mit dem Plugin-SDK verwendet werden.

---

# Für wen ist die Referenz gedacht?

Die API-Referenz richtet sich an Entwickler, die bereits die Grundlagen der WebRadio-Entwicklung kennen und detaillierte Informationen zu einer bestimmten API benötigen.

Wenn du neu in der WebRadio-Entwicklung bist, empfiehlt es sich, zuerst das Plugin-SDK durchzuarbeiten.

---

# API-Kategorien

Das WebRadio-SDK ist in mehrere Kategorien unterteilt.

```text
Application

↓

Plugin-System

↓

Theme-System

↓

Speicher

↓

Ereignisse

↓

Einstellungen

↓

Navigation

↓

Audio- und Radio-Dienste

↓

Player (Unified Player)

↓

Update- und Laufzeitdiagnose

↓

Hilfsfunktionen
```

Jede Kategorie wird separat dokumentiert.

---

# Zentrale Manager

- [Application](./Application.md)
- [PluginManager](./PluginManager.md)
- [ThemeManager](./ThemeManager.md)
- [StorageManager](../architecture/02-StorageManager.md)

---

# Zentrale Dienste

- [StreamManager](./StreamManager.md)
- [RadioBrowserService](./RadioBrowserService.md)

---

# Plattform- und Update-Core

- [RuntimeDetector](../UPDATE_ARCHITECTURE.md)
- [UpdateManager](../UPDATE_ARCHITECTURE.md)

---

# Player-API

- [Unified Player](./UnifiedPlayer.md) – PlayerManager, Provider, Zustände, IPC sowie die Schnittstellen für Renderer und Plugins

---

# Plugin-HTTP-Origin-API

- PluginHttpOrigin

---

# Erweiterungspunkte für Plugins (aktuell)

- [Ereignisse](./Events.md)
- [Speicher](./Storage.md)
- [Einstellungen](./Settings.md)
- [Navigation](../plugin-sdk/08-Navigation.md)
- [Benutzeroberfläche](../plugin-sdk/09-UI.md)

> Einige API-Referenzseiten beschreiben zukünftige Plugin-Dienste, die noch nicht implementiert sind. Prüfe den Status der jeweiligen Seite, bevor du dich auf einen Dienst verlässt.

---

# Geplante Erweiterungspunkte (noch nicht implementiert)

- [Hooks](./Hooks.md)
- [Befehle](./Commands.md)
- [Menüs](./Menus.md)
- [Benachrichtigungen](./Notifications.md)
- [Fenster](./Windows.md)

---

# Umfang der API-Referenz

Einige API-Referenzseiten beschreiben zukünftige Plugin-Dienste, die noch nicht implementiert sind.

Informationen zu den aktuell verfügbaren Plugin-Schnittstellen findest du hier:

- Plugin-SDK
- Capabilities und Plugin-HTTP-Umgebung
- Plugin-API-Dokumentation im SDK

---

# Aufbau der Dokumentation

Jedes API-Dokument folgt derselben Struktur.

```text
Überblick

Zuständigkeiten

Konstruktor

Eigenschaften

Methoden

Ereignisse

Berechtigungen

Beispiele

Bewährte Vorgehensweisen

Verwandte APIs
```

Ein einheitlicher Aufbau erleichtert die Navigation durch die Dokumentation.

---

# Stabilität

Nur dokumentierte APIs gelten als öffentlich.

Plugins sollten sich niemals auf Folgendes verlassen:

- interne Klassen
- private Methoden
- undokumentierte Eigenschaften
- interne Implementierungsdetails

Die ausschließliche Verwendung öffentlicher APIs verbessert die Kompatibilität mit zukünftigen WebRadio-Versionen.

---

# Versionierung

Jede dokumentierte API gehört zu einer bestimmten Version des WebRadio-SDK.

Künftige Versionen können Folgendes ergänzen:

- neue Methoden
- neue Dienste
- zusätzliche Ereignisse
- neue Erweiterungspunkte

Änderungen sollen nach Möglichkeit abwärtskompatibel bleiben.

---

# Codebeispiele

Die meisten API-Dokumente enthalten praktische Beispiele.

Beispiel:

```javascript
const logger = context.logger;

logger.info("Plugin started.");
```

Die Beispiele sind bewusst einfach gehalten und konzentrieren sich auf die Darstellung der API.

---

# Konventionen

In dieser Referenz gelten folgende Konventionen:

- JavaScript-Beispiele verwenden moderne Syntax.
- Öffentliche Klassen verwenden PascalCase.
- Methoden verwenden camelCase.
- Konstanten verwenden UPPER_CASE.
- Ereignisnamen verwenden, sofern zutreffend, Punktnotation.

Diese Konventionen werden im gesamten SDK einheitlich verwendet.

---

# Verwandte Dokumentation

Die API-Referenz ergänzt folgende Dokumentation:

- Architektur
- Plugin-SDK
- Theme-SDK

Zusammen bieten diese Dokumente einen vollständigen Überblick über die Entwicklung für WebRadio.

---

# Nächster Schritt

Beginne mit **Application.md**, um den zentralen Lebenszyklus der Anwendung und die Rolle der Klasse Application zu verstehen.
