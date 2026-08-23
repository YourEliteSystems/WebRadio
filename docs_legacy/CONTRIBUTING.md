# Contributing to WebRadio

Vielen Dank, dass du zur Entwicklung von WebRadio beitragen möchtest! Jeder Beitrag ist willkommen, egal ob Bug-Report, Feature-Idee, Dokumentation oder Code.

---

## 📋 Inhaltsverzeichnis

- [Verhaltenskodex](#verhaltenskodex)
- [Erste Schritte](#erste-schritte)
- [Wie kann ich beitragen?](#wie-kann-ich-beitragen)
- [Development Setup](#development-setup)
- [Commit- & Branch-Konventionen](#commit---branch-konventionen)
- [Pull Request Prozess](#pull-request-prozess)
- [Sicherheitslücken melden](#sicherheitslücken-melden)

---

## Verhaltenskodex

Dieses Projekt und alle Beteiligten unterliegen unserem [Code of Conduct](./CODE_OF_CONDUCT.md). Durch deine Teilnahme stimmst du zu, diesen einzuhalten. Bitte melde inakzeptables Verhalten an die Projektbetreuer.

---

## Erste Schritte

1. **Fork** das Repository auf GitHub.
2. **Klone** deinen Fork lokal:
   ```bash
   git clone https://github.com/DEIN_USERNAME/WebRadio.git
   cd WebRadio
   ```
3. **Installiere** die Abhängigkeiten:
   ```bash
   npm install
   ```
4. **Starte** die App im Entwicklungsmodus:
   ```bash
   npm start
   ```

---

## Wie kann ich beitragen?

### 🐛 Einen Bug melden

- Prüfe zuerst die [offenen Issues](https://github.com/YourEliteSystems/WebRadio/issues), ob der Bug bereits gemeldet wurde.
- Wenn nicht, erstelle ein neues Issue mit:
  - Einer klaren Beschreibung des Problems
  - Schritten zur Reproduktion
  - Erwartetem vs. tatsächlichem Verhalten
  - Versionsnummer der App (zu finden in `package.json` oder im Einstellungs-Fenster unter "Über")
  - Betriebssystem und Version

### 💡 Ein Feature vorschlagen

- Öffne ein neues Issue mit dem Label `enhancement`.
- Beschreibe die gewünschte Funktion und warum sie sinnvoll wäre.
- Wenn möglich, beschreibe Alternativen, die du in Betracht gezogen hast.

### 🎨 Ein Theme erstellen

Themes sind eigenständige CSS-Dateien in `themes/`. Lies den [Theme Development Guide](./theme-development-guide.md) für alle Details.

### 🔌 Ein Plugin erstellen

Plugins sind JavaScript-Module in `plugins/`. Lies den [Plugin Development Guide](./plugin-development-guide.md) für alle Details zur API.

---

## Development Setup

### Voraussetzungen

| Tool | Mindestversion |
| --- | --- |
| Node.js | 20.x oder neuer |
| npm | 10.x oder neuer |
| Git | aktuell |

### Wichtige Skripte

| Befehl | Zweck |
| --- | --- |
| `npm start` | Baut React und startet Electron (Dev-Modus) |
| `npm run build-react` | Kompiliert nur den React-Renderer |
| `npm run make` | Erstellt einen Installer / Distributionspaket |
| `npm run package` | Paketiert die App ohne Installer |

### Projektstruktur

```
WebRadio/
├── electron/           # Electron Main-Prozess
│   ├── main.js         # App-Einstiegspunkt
│   ├── preload.js      # Sichere IPC-Bridge
│   └── core/           # Modulare Core-Bausteine
│       ├── app/        # Fenster-Management
│       ├── audio/      # Stream & FFmpeg
│       ├── ipc/        # IPC Handler
│       └── plugins/    # Plugin-Verwaltung
├── renderer/           # React-Frontend
│   ├── App.jsx         # Haupt-Komponente
│   ├── components/     # UI-Bausteine
│   ├── services/       # Player-Logik
│   └── ui/             # Plugin-Registry & Slots
├── plugins/            # Community & Built-in Plugins
├── themes/             # CSS-Themes
└── docs/               # Dokumentation
```

---

## Commit- & Branch-Konventionen

### Branch-Namen

Nutze sprechende Branch-Namen nach folgendem Schema:

| Typ | Schema | Beispiel |
| --- | --- | --- |
| Feature | `feature/kurze-beschreibung` | `feature/sleep-timer` |
| Bugfix | `fix/kurze-beschreibung` | `fix/sigterm-crash` |
| Dokumentation | `docs/kurze-beschreibung` | `docs/plugin-api` |
| Refactoring | `refactor/kurze-beschreibung` | `refactor/stream-manager` |

### Commit-Nachrichten

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/):

```
<typ>(<bereich>): <kurze beschreibung>

[optionaler längerer Textkörper]

[optionaler Footer, z.B. "Fixes #42"]
```

**Typen:**

| Typ | Bedeutung |
| --- | --- |
| `feat` | Neues Feature |
| `fix` | Bugfix |
| `docs` | Nur Dokumentationsänderungen |
| `style` | Formatierung, kein Logik-Change |
| `refactor` | Code-Umbau ohne Feature/Fix |
| `chore` | Wartungsaufgaben (Dependencies, Build) |

**Beispiele:**
```
feat(plugins): add uiRegistry.registerView() support
fix(audio): fix SIGTERM crash on stream stop
docs(contributing): add commit convention section
```

---

## Pull Request Prozess

1. Stelle sicher, dass dein Branch aktuell gegenüber `main` ist.
2. Beschreibe im PR klar, **was** du geändert hast und **warum**.
3. Verlinke relevante Issues (z.B. `Closes #42`).
4. Ein Maintainer reviewed deinen PR. Sei offen für Feedback und Änderungswünsche.
5. Nach Genehmigung wird der PR per Squash-Merge gemergt.

> [!IMPORTANT]
> PRs ohne beschreibenden Titel oder fehlende Beschreibung werden nicht reviewt.

---

## Sicherheitslücken melden

Bitte melde Sicherheitslücken **nicht** über öffentliche GitHub Issues. Lies stattdessen unsere [Security Policy](./SECURITY.md) für den vertraulichen Meldeprozess.

---

*Danke, dass du WebRadio besser machst! 🎧*
