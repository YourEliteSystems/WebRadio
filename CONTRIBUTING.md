# Zu WebRadio beitragen

Danke, dass du WebRadio verbessern möchtest! Ob Fehlerbericht, Idee, Plugin, Theme, Übersetzung oder Code: Jeder Beitrag hilft.

## Bevor du loslegst

- **Fehler oder Idee?** Öffne ein [Issue](https://github.com/YourEliteSystems/WebRadio/issues) und wähle die passende Vorlage (Bug, Feature, Plugin-API, Refactoring). Suche vorher kurz, ob es das Thema schon gibt.
- **Größere Änderung geplant?** Beschreibe sie zuerst in einem Issue oder in den [Discussions](https://github.com/YourEliteSystems/WebRadio/discussions), bevor du viel Arbeit investierst. So vermeiden wir doppelte Arbeit.
- **Sicherheitslücke gefunden?** Bitte **nicht** öffentlich melden, sondern den Weg in der [SECURITY.md](SECURITY.md) nutzen.
- **Verhaltensregeln:** Wir erwarten einen respektvollen Umgang, siehe [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Entwicklungsumgebung einrichten

Voraussetzungen:

- **Node.js 26 oder neuer** (die Version steht in der `.nvmrc`). (Aufgrund der Compatiblitäts Probleme von React zu Electron wird bewusst zu dieser version geraten.)
- **npm 10 oder neuer**

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm install
npm run dev
```

`npm run dev` baut das React-Frontend mit esbuild und startet Electron.

## Nützliche Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus |
| `npm run build` | Renderer produktiv bauen |
| `npm test` | Test-Suite ausführen |
| `npm run lint` | Code mit ESLint prüfen |
| `npm run lint:fix` | Lint-Probleme automatisch beheben |
| `npm run format` | Code mit Prettier formatieren |

Vor jedem Pull Request sollten **Lint, Tests und Build** lokal durchlaufen. Die CI prüft dasselbe auf Windows und Linux.

## Pull Requests

1. Forke das Repository und lege einen Branch an, z. B. `fix/discord-presence` oder `feat/sleep-timer`.
2. Halte die Änderung klein und fokussiert. Ein Pull Request sollte ein Thema behandeln.
3. Schreibe oder ergänze Tests, wenn du Verhalten änderst oder Fehler behebst.
4. Führe `npm run lint`, `npm test` und `npm run build` aus.
5. Aktualisiere die Dokumentation, wenn sich etwas für Nutzer oder Entwickler ändert.
6. Öffne den Pull Request gegen `main` und beschreibe kurz, **was** sich ändert und **warum**. Verweise auf das passende Issue, falls es eines gibt.

### Commit-Nachrichten

Wir verwenden aussagekräftige Commit-Nachrichten im Stil von [Conventional Commits](https://www.conventionalcommits.org/de/), weil daraus Versionen und Release Notes entstehen:

```
feat: Sleep-Timer im Player ergänzen
fix: Discord Rich Presence nach Neustart wiederherstellen
docs: Plugin-SDK um Capability-Beispiel erweitern
```

Gängige Typen sind `feat`, `fix`, `docs`, `refactor`, `test` und `chore`.

## Code-Stil

- Formatierung übernimmt Prettier, Regeln prüft ESLint. Bitte keine manuellen Stil-Diskussionen im Review, sondern `npm run format` und `npm run lint:fix` nutzen.
- Der Core bleibt möglichst generisch. Funktionen für einzelne Dienste oder Sonderfälle gehören in **Plugins**, nicht in den Core.

## Plugins und Themes

- Plugins entwickelst du mit dem [Plugin-SDK](docs/plugin-sdk/README.md). Fähigkeiten werden im Manifest als **Capabilities** angefordert, siehe [Capability System](docs/plugin-sdk/13-Capabilities.md).
- Themes baust du mit dem [Theme-SDK](docs/theme-sdk/README.md).
- Bitte gib bei Plugins an, welche externen Dienste sie nutzen und welche Daten sie dorthin senden. Das erleichtert die Prüfung und den Datenschutz.
- Wenn dein Plugin externe Programme startet oder Zugangsdaten verwendet, beschreibe das im README des Plugins.

## Was nicht ins Repository gehört

- Zugangsdaten, Tokens, API-Schlüssel und `.env`-Dateien
- Lokale Einstellungen, Datenbanken und Logs (z. B. Ordner wie `data/` oder `logs/`)
- Build-Ausgaben wie `dist/` oder `out/`

Prüfe vor dem Commit mit `git status`, was tatsächlich hinzugefügt wird.

## Lizenz

Mit deinem Beitrag erklärst du dich einverstanden, dass er unter der [Apache License 2.0](LICENSE) veröffentlicht wird, wie der Rest des Projekts.

## Fragen?

Stelle sie in den [Discussions](https://github.com/YourEliteSystems/WebRadio/discussions) oder auf dem [Discord-Server](https://discord.gg/6PfkRNYw).