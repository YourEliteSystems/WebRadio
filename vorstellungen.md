# 📢 WebRadio – Vorstellungstexte

---

## 🗣️ Forum-Vorstellung

> Formuliert für klassische Foren (z. B. Reddit, GitHub Discussions, ComputerBase, Deskmodder, eigene Community-Foren).  
> Ausführlicher Text, übersichtlich gegliedert, erklärt das Projekt, die Funktionen und alle Neuerungen ab Version 1.0.6-beta.2.

---

### 📻 WebRadio v1.0.6-beta.2 – Plattformübergreifender Desktop-Radioplayer mit Update-Kanälen, Plugin- & Theme-System

Hallo zusammen! 👋

Ich möchte euch **WebRadio** vorstellen – einen kostenlosen, Open-Source Desktop-Radioplayer für **Windows und Linux**, entwickelt mit Electron, React und ESBuild.

---

#### 🤔 Was ist WebRadio?

WebRadio ist ein schlanker, nativer Desktop-Player, mit dem ihr direkt von eurem Rechner aus tausende Internet-Radiosender weltweit hören könnt – komplett ohne Browser-Overhead und ohne Werbung. Sender suchen, anklicken und die Musik läuft.

Das Besondere an WebRadio: Die Anwendung ist modular aufgebaut und lässt sich vollständig anpassen und erweitern – durch ein modulares **Theme-System** und ein erweiterbares **Plugin-System**.

---

#### ✨ Kern-Features im Überblick

- 🔍 **Sendersuche & Filter** – Riesige Auswahl an weltweiten Sendern, filterbar nach Land, Sprache oder Genre
- ▶️ **Zuverlässige Audiowiedergabe** – Schnelles Buffering, stabiler Stream und Codec-Unterstützung (inkl. integrierter FFmpeg-Unterstützung)
- ⭐ **Favoriten & Hörverlauf** – Eure Lieblingssender mit einem Klick speichern und sortieren
- 🎨 **Theme-Engine** – Schneller Wechsel zwischen modernen Themes ohne Neustart
- 🧩 **Plugin-Architektur** – Erweiterung der Kernfunktionen durch ein strukturiertes Plugin-SDK
- 🔄 **Neues Update System v1** – Direkte Updates über GitHub Releases mit Wahl zwischen **Stable-** und **Beta-Kanal**
- 🐧 **Echte Cross-Platform-Unterstützung** – Bereitgestellt für Windows sowie Linux (AppImage und natives Arch Linux `.pkg.tar.zst`)
- 🎮 **Discord Rich Presence** – Zeigt euren aktuell gespielten Sender und Titel live im Discord-Status an
- ⌨️ **Medientasten & Tray-Steuerung** – Play, Pause, Mute und Senderwechsel über Tastatur und System-Tray
- 🔒 **Sicherheit & Integrität** – Vollständige Validierung aller Pakete, XSS-bereinigte Release-Notes und kein Tracking

---

#### 🆕 Was ist neu in v1.0.6-beta.2?

Seit Version 1.0.5 und 1.0.6-beta.1 hat sich unter der Haube und an der Oberfläche enorm viel getan:

- 🔄 **Update System v1 (Stable & Beta Kanäle)**:
  - Vollständig integrierter UpdateManager basierend auf `electron-updater` und GitHub Releases.
  - **Zwei Kanäle**: Wählt in den Einstellungen flexibel zwischen dem erprobten **Stable-Kanal** oder dem **Beta-Kanal** für frühe Vorabversionen.
  - **Sicherer Kanalwechsel**: Nahtloser Wechsel zwischen Beta und Stable (unterstützt automatisches Downgrade auf die letzte stabile Version).
  - Neuer Update-Dialog mit Fortschrittsbalken, Übertragungsrate, Release-Notes-Vorschau und Optionen wie `[Später]` oder `[Beim Start prüfen]`.
- 🐧 **Arch Linux & Linux-Packaging**:
  - Offizielles Arch Linux Paket (`.pkg.tar.zst`) mit passendem `PKGBUILD`, Hicolor-Icons und Desktop-Integration.
  - Automatisierte Build-Workflows für Linux AppImages und Arch-Pakete via GitHub Actions.
- 🧩 **Dynamischer Plugin-Rescan**:
  - Neue oder aktualisierte Plugins im Plugin-Ordner können jetzt direkt zur Laufzeit neu eingelesen werden (`rescan`), ohne die App neu starten zu müssen.
  - Plugin-gesteuerte Navigation für noch flexiblere Erweiterungen.
- 🧹 **Bereinigte Build-Infrastruktur & Qualität**:
  - Umstellung auf konsistentes SemVer (`v1.0.6-beta.2`).
  - Schnelleres Bundling via ESBuild, Node >= 20.
  - Über 60 automatisierte Integrationstests für Updater, Navigation, Themes und Linux-Artefakte.

---

#### 🛠️ Für wen ist WebRadio interessant?

- Für alle Musik- und Radiobegeisterten, die einen **ressourcenschonenden Desktop-Player** suchen.
- Für **Arch Linux**- und **Linux**-Nutzer, die native Pakete und saubere Desktop-Integration schätzen.
- Für **Entwickler & Designer**, die mit JavaScript/CSS eigene Plugins und Themes entwickeln möchten.

---

#### 🔗 Downloads & Links

- 📦 **Releases & Downloads:** [GitHub Releases](https://github.com/YourEliteSystems/WebRadio/releases)
- 💻 **Quellcode:** [GitHub Repository](https://github.com/YourEliteSystems/WebRadio)
- 📚 **SDK-Dokumentation:** Im `docs/`-Ordner (Plugin SDK, Theme SDK, Architektur-Handbuch)
- 🐛 **Feedback & Fehler melden:** [GitHub Issues](https://github.com/YourEliteSystems/WebRadio/issues)
- 🤝 **Mitwirken:** [Contributing Guide](https://github.com/YourEliteSystems/WebRadio/blob/master/CONTRIBUTING.md)

---

Da Version 1.0.6 im Beta-Stadium ist, freue ich mich riesig über Feedback, Anregungen und Tester für Windows und Linux! 😊

Viel Spaß beim Hören!  
*– YourEliteSystems*

---
---

## 💬 Discord-Vorstellung

> Formuliert für Discord-Server & Community-Chats. Knackig, modern, mit Emojis und leicht scannbar.

---

**📻 WebRadio v1.0.6-beta.2 ist am Start!** 🚀

Hey zusammen! Ich entwickle **WebRadio** – einen kostenlosen, schlanken Desktop-Radioplayer für **Windows & Linux**.  
Tausende weltweite Sender direkt auf dem Desktop – ohne Browser, ohne Werbung, einfach einschalten und genießen. 🎵

**Highlights:**
- 🔍 Schnelle Sendersuche nach Land, Genre & Sprache
- ⭐ Favoritenliste & Verlauf
- 🔄 **NEU: Update System v1** – Updates direkt in der App mit Wahl zwischen **Stable**- und **Beta-Kanal**
- 🐧 **NEU: Arch Linux Support** – Native `.pkg.tar.zst`-Pakete & AppImages
- 🎨 Theme-Engine für sofortigen Look-Wechsel
- 🧩 Modulares Plugin-System mit **Live-Rescan** (Plugins ohne Neustart nachladen)
- 🎮 Discord Rich Presence (zeigt deinen aktuellen Track/Sender im Profil)
- ⌨️ Tastatur-Medientasten & Tray-Steuerung

**Was ist neu in v1.0.6-beta.2?**
- Neues Einstellungs-Menü für Updates (Kanalwahl Stable/Beta, Fortschrittsanzeige, flexible Neustart-Optionen)
- Nahtloses Umschalten zwischen Beta und Stable (Downgrade-Support)
- Arch Linux Paketierung via PKGBUILD
- Plugin-Discovery zur Laufzeit aktualisierbar
- 60+ automatisierte Tests & sauber optimierte Build-Pipeline

Wir sind aktuell in der Beta-Phase und freuen uns über jeden Tester auf Windows & Linux! Feedback und Wünsche sind herzlich willkommen! 🙌

> 📦 **Download:** [GitHub Releases](https://github.com/YourEliteSystems/WebRadio/releases)  
> 💻 **GitHub:** [YourEliteSystems/WebRadio](https://github.com/YourEliteSystems/WebRadio)  
> 🐛 **Bugs & Ideen:** [GitHub Issues](https://github.com/YourEliteSystems/WebRadio/issues)

*– YourEliteSystems* 🎶

---
