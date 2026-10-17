# Versionierung der Dokumentation

WebRadio nutzt **Read the Docs**, um mehrere Dokumentationsversionen bereitzustellen.

## Funktionsweise

Read the Docs erstellt automatisch Dokumentations-Builds für:

- **Tags** – stabile Releases (z. B. `v1.0.0`, `v1.1.0`)
- **Branches** – Entwicklungsstände (z. B. `main`, `develop`)
- **Pull Requests** – Vorschauversionen

Die Versionsauswahl im Dokumentationskopf wird automatisch von Read the Docs verwaltet.

## Konfiguration

Die Konfiguration befindet sich in `.readthedocs.yaml`:

```yaml
version: 2

build:
  os: ubuntu-24.04
  tools:
    python: "3.12"

mkdocs:
  configuration: mkdocs.yml
  fail_on_warning: true

python:
  install:
    - requirements: docs/requirements.txt
```

## Versionstypen

### Stabile Versionen

Sie werden aus Git-Tags erstellt:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Read the Docs erstellt automatisch die Version `v1.0.0` und kennzeichnet sie als stabil.

### Entwicklungsversionen

Sie werden aus Branches erstellt:

- `main` – aktueller Entwicklungsstand
- `develop` – Entwicklungsbranch für Funktionen, falls verwendet
- eigene Branches – beliebige weitere Branches im Repository

### Vorschauversionen für Pull Requests

Für jeden Pull Request kann ein temporärer Vorschau-Build erstellt werden, mit dem Änderungen an der Dokumentation vor dem Merge geprüft werden können.

## Standardversion festlegen

Im Read-the-Docs-Dashboard:

1. Öffne **Admin** → **Versions**.
2. Wähle die gewünschte Standardversion aus.
3. Klicke auf **Make default**.

Üblicherweise wird der neueste stabile Tag als Standard festgelegt.

## Versionsaliase

Read the Docs unterstützt Versionsaliase:

- `latest` – verweist in der Regel auf die als neueste konfigurierte Version
- `stable` – verweist auf das neueste stabile Release
- `dev` – verweist auf den Entwicklungsbranch

Konfiguriere Aliase im Read-the-Docs-Dashboard unter **Admin** → **Versions**.

## Vorabversionen

Für Alpha-, Beta- oder RC-Releases:

```bash
# Vorabversionen taggen
git tag v1.1.0-alpha.1
git push origin v1.1.0-alpha.1

git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1

git tag v1.1.0-rc.1
git push origin v1.1.0-rc.1
```

Read the Docs erstellt dafür separate Versionen. Aliase können im Dashboard konfiguriert werden.

## Lokale Entwicklung

Starte die Dokumentation lokal mit:

```bash
mkdocs serve
```

Dabei wird der Dokumentationsstand des aktuellen Branches ohne Versionsverwaltung bereitgestellt.

## Alte Versionen löschen

Im Read-the-Docs-Dashboard:

1. Öffne **Admin** → **Versions**.
2. Wähle die zu löschende Version aus.
3. Klicke auf **Deactivate** → **Delete**.

## Bewährte Vorgehensweisen

- Stabile Releases mit semantischer Versionierung taggen (z. B. `v1.0.0`, `v1.1.0`).
- Die letzten zwei bis drei stabilen Versionen als Referenz behalten.
- Sehr alte Versionen löschen, um Speicherplatz zu sparen.
- Dokumentationsänderungen vor dem Merge in PR-Vorschauen testen.
- Aussagekräftige Branchnamen für länger laufende Entwicklungsarbeiten verwenden.

## Weitere Informationen

Weitere Details findest du in der [Dokumentation zur Read-the-Docs-Versionierung](https://docs.readthedocs.io/en/stable/versioning.html).
