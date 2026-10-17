# 📻 WebRadio

> Ein moderner, erweiterbarer und quelloffener Webradio-Player für den Desktop, entwickelt mit Electron.

WebRadio bietet ein schnelles, ressourcenschonendes und anpassbares Hörerlebnis. Für Entwickler und Community stellt das Projekt außerdem ein leistungsfähiges Plugin- und Theme-Ökosystem bereit.

> **Aktueller Status:** Das Projekt wird aktiv entwickelt. Der aktuelle Quellcode-Stand dokumentiert `v1.0.7-beta.2`. Die tatsächlich veröffentlichten Downloads findest du auf der Seite [GitHub Releases](https://github.com/YourEliteSystems/WebRadio/releases).

---

# ✨ Funktionen

* 🎵 Tausende Online-Radiosender streamen
* 🔌 Erweiterbares Plugin-System
* 🎨 Unterstützung eigener Themes
* 🪟 Moderne Desktop-Anwendung auf Basis von Electron
* ⚡ Schneller Start und ressourcenschonende Architektur
* 🩺 Integrierte Diagnose- und Protokollierungsfunktionen
* 💾 Zentrale Speicherverwaltung
* 🌍 Plattformübergreifendes Konzept

---

# 🖥️ Plattformunterstützung

| Plattform | Status |
| -------- | ------ |
| Windows | Unterstützt; wichtigste Testplattform |
| Linux | Veröffentlichte Builds verfügbar; Testabdeckung kann variieren |
| macOS | Derzeit nicht verfügbar |

---

# 🚀 Erste Schritte

Klone das Repository:

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
```

**Voraussetzungen:** Node.js 26 oder neuer und npm 10 oder neuer. Auf dem Zielsystem werden Node.js und npm für die bereits paketierte Anwendung nicht benötigt.

Installiere die Abhängigkeiten und starte die Entwicklungsumgebung:

```bash
npm ci
npm run dev
```

---

# 📚 Dokumentation

Die Entwicklerdokumentation befindet sich im Verzeichnis `docs/`.

Sie umfasst unter anderem:

* Architektur
* Plugin-SDK
* Theme-SDK
* API-Referenz
* Beispiele
* Hinweise zur Mitwirkung am Projekt

---

# 🛣️ Roadmap

Aktuelle Schwerpunkte:

* Stabilisierung des Kerns
* Dokumentation
* Verbesserungen der Benutzeroberfläche
* Plugin-SDK
* Theme-SDK

Künftige Versionen sollen weitere Verbesserungen der Benutzerfreundlichkeit und zusätzliche Erweiterungsmöglichkeiten bieten.

---

# 🤝 Mitwirken

Beiträge zum Projekt sind willkommen.

Bevor du ein Issue oder einen Pull Request erstellst, lies bitte den [Leitfaden für Beiträge](https://github.com/YourEliteSystems/WebRadio/blob/main/CONTRIBUTING.md), den [Verhaltenskodex](CODE_OF_CONDUCT.md), die [Sicherheitsrichtlinie](SECURITY.md) und die [Datenschutzhinweise](PRIVACY.md).

---

# 📄 Lizenz

Dieses Projekt wird unter der Apache-Lizenz 2.0 veröffentlicht.

Den vollständigen Lizenztext findest du in der Datei `LICENSE`.

---

# ❤️ Mit Leidenschaft entwickelt

WebRadio ist ein Open-Source-Projekt mit besonderem Fokus auf eine klare Architektur, Wartbarkeit und Erweiterbarkeit.

Wenn dir das Projekt gefällt, kannst du es auf GitHub mit einem ⭐ unterstützen.

---

## 🔒 Datenschutz und externe Datenflüsse

WebRadio ist eine lokale Desktop-Anwendung, aber einige Funktionen nutzen externe Server oder Plattform-APIs.

- Inhalte von Radio Browser stammen aus der Radio-Browser-API.
- Updates und Release-Informationen stammen aus offiziellen GitHub-Releases.
- Discord Rich Presence wird genutzt, wenn die entsprechende Funktion aktiviert ist.
- Integrationen können zusätzliche Berechtigungen oder externe Dienste nutzen.

Weitere Details und offene Punkte findest du unter [Datenschutz und Datenflüsse](./PRIVACY.md).
