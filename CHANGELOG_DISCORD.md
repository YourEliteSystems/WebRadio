# Discord Changelog – WebRadio v1.0.4
# Einfach die zwei Blöcke als separate Nachrichten in Discord einfügen

============================================================
NACHRICHT 1
============================================================

# 🎙️ WebRadio — Update **v1.0.4**

## ✨ Neue Features
- 🎨 **Theme-Engine** — 3 Themes (Default, Dark, Neon), Live-Wechsel, wird gespeichert
- 🔔 **Updater** — SHA-256 Verifikation beim Download, Fallback auf GitHub
- 🖥️ **System-Tray** — Play/Pause, Stop, Einstellungen & Update-Check direkt im Tray
- ⌨️ **Media-Keys** — `MediaPlayPause`, `MediaStop`, `MediaNextTrack` global registriert
- ℹ️ **„Über"-Seite** — neue Seite in den Einstellungen mit Version & Infos
- 🔴 **Update-Badge** — animierter Hinweis in der Titelleiste wenn ein Update bereit ist

## 🐛 Bugfixes
- **Theme-URLs auf Windows** — Backslash-Pfade wurden nicht korrekt aufgelöst
- **Radio-Cache** — Serverliste wurde bei jedem Start neu geladen statt gecacht
- **Tray „Update prüfen"** — Button hatte keine Funktion (Callback fehlte)
- **Plugin `init()`** — wurde mehrfach aufgerufen, jetzt nur noch einmal
- **Favoriten** — Duplikate wurden nicht erkannt wenn `url_resolved` abwich
- **Einstellungen** — Fenster öffnete sich mehrfach, jetzt Singleton

============================================================
NACHRICHT 2
============================================================

## ♻️ Refactoring
- `main.js` auf **35 Zeilen** reduziert — komplette Logik ausgelagert
- IPC aufgeteilt in: `radioHandlers` · `themeHandlers` · `updaterHandlers` · `storageHandlers` · `pluginHandlers` · `windowHandlers`
- Neuer `WindowManager` — verwaltet Main- & Settings-Fenster als Singletons
- `themeService.js` — kapselt alle CSS-Theme-Operationen im Renderer
- `eventBus.js` — zentraler In-Prozess Event-Bus

## 🎨 UI & Design
- Einstellungen komplett neu: **4 Seiten** (Plugins · Themes · Updates · Über)
- Update-Seite mit Puls-Animation & Release-Notes-Box
- Plugin Toggle-Switches, Theme-Karten mit Glow-Effekt
- VU-Meter Visualizer mit Cyan/Blau-Gradient

## 🔧 Post-Release Fixes
- **RadioBrowserService Cache** — Keys `updated`/`servers` stimmten nicht überein → Cache schlug immer fehl *(jetzt gefixt)*
- **Tray Callback** — `checkForUpdates` wurde in `main.js` nicht übergeben *(jetzt gefixt)*

> *WebRadio v1.0.4 — by YourEliteSystems*
