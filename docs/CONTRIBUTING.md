# Zu WebRadio beitragen

Vielen Dank für dein Interesse an WebRadio! Beiträge sind willkommen – von kleinen Fehlerbehebungen bis hin zu neuen Funktionen, Plugins, Themes und Dokumentation.

## Bevor du startest

Bitte lies zuerst:

- [Verhaltenskodex](./CODE_OF_CONDUCT.md)
- [Sicherheitsrichtlinie](./SECURITY.md)
- [README](https://github.com/YourEliteSystems/WebRadio/blob/main/README.md)
- [Roadmap](https://github.com/YourEliteSystems/WebRadio/blob/main/ROADMAP.md)

Bei größeren Änderungen empfiehlt es sich, vor der Implementierung ein Issue oder eine Discussion zu eröffnen. So lassen sich Architektur, Umfang und Kompatibilität frühzeitig abstimmen.

## Entwicklungsumgebung

WebRadio ist eine plattformübergreifende Electron-Anwendung mit React-Renderer und einer auf FFmpeg basierenden Audio-Pipeline.

Die grundlegenden Voraussetzungen und aktuellen Build-Befehle findest du in der Haupt-README und in der Projektdokumentation.

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
2. Halte die Änderungen möglichst fokussiert.
3. Berücksichtige die bestehende Architektur und die öffentlichen APIs.
4. Ergänze oder aktualisiere Tests, wenn sich das Verhalten ändert.
5. Aktualisiere die relevante Dokumentation.
6. Führe vor dem Pull Request mindestens die verfügbaren Tests und den Build aus.

## Architekturregeln

### Der Core bleibt allgemein gehalten

Neue Integrationen sollten nach Möglichkeit über die vorhandenen Erweiterungs- und Plugin-Mechanismen umgesetzt werden.

Insbesondere sollen konkrete MediaHub-Integrationen nicht direkt in den Core eingebaut werden, wenn sie als Plugin umgesetzt werden können.

### Sicherheit

WebRadio behandelt Plugins und ihre Berechtigungen bewusst restriktiv. Neue Fähigkeiten, IPC-Endpunkte, HTTP-Funktionen oder Dateizugriffe müssen das bestehende Berechtigungs- und Capability-Modell berücksichtigen.

Committe keine Secrets, Tokens oder lokalen Konfigurationsdateien mit sensiblen Daten.

### Plattformen

Änderungen sollten – soweit technisch möglich – Windows und Linux berücksichtigen. Plattformspezifisches Verhalten oder Einschränkungen sollten dokumentiert werden.

## Hinweise zu Commits und Pull Requests

Commit-Nachrichten sollten kurz und eindeutig beschreiben, was geändert wurde.

Ein Pull Request sollte folgende Informationen enthalten:

- Was wurde geändert?
- Warum ist die Änderung notwendig?
- Welche Dateien oder Bereiche sind betroffen?
- Wurde getestet?
- Gibt es Hinweise zu Plattformen oder Migrationen?
- Gibt es hilfreiche Screenshots oder Logs?

Vermische keine unnötigen Formatierungs- oder Refactoring-Änderungen mit einem fachlich unabhängigen Feature.

## Plugins und Themes

Beiträge zu Plugins und Themes sollten die jeweiligen SDK- und Sicherheitsvorgaben berücksichtigen.

Für die Plugin-Entwicklung:

- `docs/plugin-sdk/`
- [Capabilities](./plugin-sdk/13-Capabilities.md)
- [Bewährte Vorgehensweisen](./plugin-sdk/10-BestPractices.md)

Für Themes:

- `docs/theme-sdk/`

## Tests

Führe vor dem Öffnen eines Pull Requests Folgendes aus:

```bash
npm test
npm run build
```

Falls ein Test aufgrund der lokalen Umgebung nicht ausgeführt werden kann, dokumentiere im Pull Request, welcher Test betroffen ist und warum.

## Pull Requests

Pull Requests sollten möglichst klein und nachvollziehbar bleiben. Änderungen können vor dem Merge überprüft, angepasst oder in kleinere Pull Requests aufgeteilt werden.

Ein Pull Request bedeutet nicht automatisch, dass die Änderung übernommen wird. Bei der Prüfung werden Architektur, Wartbarkeit, Sicherheit, Kompatibilität und Projektziele berücksichtigt.

Vielen Dank für deinen Beitrag zu WebRadio!
