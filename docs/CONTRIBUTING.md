# Contributing to WebRadio

Vielen Dank für dein Interesse an WebRadio! Beiträge sind willkommen – von kleinen Fehlerbehebungen bis hin zu neuen Features, Plugins, Themes und Dokumentation.

## Bevor du startest

Bitte lies zuerst:

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [README](../README.md)
- [Roadmap](../ROADMAP.md)

Für größere Änderungen ist es sinnvoll, vor der Implementierung ein Issue oder eine Discussion zu eröffnen. So können Architektur, Umfang und Kompatibilität früh abgestimmt werden.

## Entwicklungsumgebung

WebRadio ist eine plattformübergreifende Electron-Anwendung mit React-Renderer und einer Audio-Pipeline auf Basis von FFmpeg.

Grundvoraussetzungen und die aktuellen Build-Befehle findest du im Haupt-README und in der Projektdokumentation.

Typischer Ablauf:

```bash
git clone https://github.com/YourEliteSystems/WebRadio.git
cd WebRadio
npm ci
npm test
npm run build
```

## Änderungen entwickeln

1. Erstelle einen eigenen Branch für deine Änderung.
2. Halte Änderungen möglichst fokussiert.
3. Behalte die bestehende Architektur und öffentliche APIs im Blick.
4. Ergänze oder aktualisiere Tests, wenn sich Verhalten ändert.
5. Aktualisiere relevante Dokumentation.
6. Führe vor dem Pull Request mindestens die verfügbaren Tests und den Build aus.

## Architektur-Regeln

### Core bleibt generisch

Neue Integrationen sollen nach Möglichkeit über die vorhandenen Extension- und Plugin-Mechanismen umgesetzt werden.

Insbesondere sollen konkrete MediaHub-Integrationen nicht direkt in den Core eingebaut werden, wenn sie als Plugin umgesetzt werden können.

### Sicherheit

WebRadio behandelt Plugins und ihre Berechtigungen bewusst restriktiv. Neue Fähigkeiten, IPC-Endpunkte, HTTP-Funktionen oder Dateizugriffe müssen das bestehende Permission-/Capability-Modell berücksichtigen.

Keine Secrets, Tokens oder lokalen Konfigurationsdateien mit sensiblen Daten committen.

### Plattformen

Änderungen sollten – soweit technisch möglich – Windows und Linux berücksichtigen. Bei plattformspezifischem Verhalten sollte die Einschränkung dokumentiert werden.

## Commit- und Pull-Request-Hinweise

Commit-Nachrichten sollten kurz und eindeutig beschreiben, was geändert wurde.

Ein Pull Request sollte enthalten:

- Was wurde geändert?
- Warum ist die Änderung notwendig?
- Welche Dateien bzw. Bereiche sind betroffen?
- Wurde getestet?
- Gibt es Plattform- oder Migrationshinweise?
- Gibt es Screenshots oder Logs, wenn sie für die Änderung hilfreich sind?

Bitte keine unnötigen Formatierungs- oder Refactoring-Änderungen mit einem fachlich unabhängigen Feature vermischen.

## Plugins und Themes

Beiträge zu Plugins und Themes sollten die jeweiligen SDK- und Sicherheitsvorgaben beachten.

Für Plugin-Entwicklung:

- `docs/plugin-sdk/`
- [Capabilities](./plugin-sdk/13-Capabilities.md)
- [Best Practices](./plugin-sdk/10-BestPractices.md)

Für Themes:

- `docs/theme-sdk/`

## Tests

Vor dem Öffnen eines Pull Requests:

```bash
npm test
npm run build
```

Falls ein Test aufgrund einer lokalen Umgebung nicht ausgeführt werden kann, bitte im Pull Request dokumentieren, welcher Test betroffen ist und warum.

## Pull Requests

Pull Requests sollten möglichst klein und nachvollziehbar bleiben. Änderungen können vor dem Merge überprüft, angepasst oder in kleinere PRs aufgeteilt werden.

Ein Pull Request bedeutet nicht automatisch, dass die Änderung übernommen wird. Architektur, Wartbarkeit, Sicherheit, Kompatibilität und Projektziele werden bei der Prüfung berücksichtigt.

Vielen Dank für deinen Beitrag zu WebRadio!
