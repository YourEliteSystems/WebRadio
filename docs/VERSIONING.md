# Versionierung der Dokumentation

WebRadio nutzt die **native Versionierung von Read the Docs**. Es gibt keinen eigenen
Versionsumschalter und keine eigene Versionsverwaltung im Repository: Read the Docs
baut pro Branch beziehungsweise Tag eine eigene Dokumentationsversion und liefert den
Versionsumschalter (Flyout) selbst aus.

- Projekt: `webradio` (Read the Docs), Repository `YourEliteSystems/WebRadio`
- URL-Schema: **mehrere Versionen mit Sprachsegment**, also `/de/<version>/…`
- Standardversion: derzeit `latest`
- Konfiguration: `.readthedocs.yaml` und `mkdocs.yml` im Wurzelverzeichnis des Repositories

## Wie Versionen entstehen

Read the Docs legt für jeden Branch, jeden Tag und jeden Pull Request eine Version an.
Entscheidend ist der Unterschied zwischen *angelegt* und *aktiv*:

| Auslöser | Version | Standardzustand |
| -------- | ------- | --------------- |
| Default-Branch `main` | `latest` | aktiv und gebaut |
| Tag (z. B. `v1.0.7-beta.2`) | Version mit dem Tag-Namen | **inaktiv**, wird nicht gebaut |
| anderer Branch | Version mit dem Branch-Namen | **inaktiv**, wird nicht gebaut |
| Pull Request | temporäre Version | Build nur zur Vorschau, erscheint nicht im Versionsumschalter |

Eine inaktive Version ist im Dashboard sichtbar, hat aber keine veröffentlichte
Dokumentation – ihre URL liefert `404`. Erst das Aktivieren (oder eine passende
Automatisierungsregel) löst einen Build aus.

## Aliase `latest` und `stable`

Beide Aliase werden von Read the Docs verwaltet und dürfen nicht als eigene Tags oder
Branches angelegt werden:

- **`latest`** folgt dem Default-Branch des Repositories (`main`) und damit dem
  aktuellen Entwicklungsstand.
- **`stable`** folgt dem **größten stabilen SemVer-Release** unter den Tags und
  Branches. Ein `v`-Präfix ist erlaubt; Vorabversionen (`-alpha`, `-beta`, `-rc`)
  sind ausdrücklich ausgeschlossen. Gibt es Tags, haben Tags Vorrang vor Branches.
- Tags außerhalb des Schemas werden für `stable` ignoriert, etwa `v1.0.1a` (kein
  SemVer) oder `v1.0.4-pre-builder` (SemVer-Vorabversion mit ungewöhnlichem Namen).
  Sie werden nicht umbenannt oder gelöscht.

## Tag-Schema des Projekts

Das Projekt taggt nach SemVer mit `v`-Präfix:

```text
v1.0.6            stabiles Release
v1.0.7-alpha.1    Vorabversion
v1.0.7-beta.2     Vorabversion
v1.0.7-rc.1       Vorabversion (Release Candidate)
```

`stable` zeigt dadurch immer auf das letzte stabile Release, nicht auf die neueste
Beta. Vorabversionen erscheinen – sofern aktiviert – als eigene Versionen und werden
von `stable` nie ausgewählt.

## Aktueller Stand (18.10.2026)

| Version | Inhalt | Status |
| ------- | ------ | ------ |
| `latest` | `main` | aktiv, gebaut, Standardversion |
| `stable` | Tag `v1.0.6` | aktiv, letzter Build (26.09.2026) **fehlgeschlagen** – `/de/stable/` liefert `404` |
| `v1.0.7-beta.2` | letzter Beta-Tag | inaktiv, nicht gebaut |
| alle älteren Tags/Branches | – | inaktiv, nicht gebaut |

Der Grund für den fehlgeschlagenen `stable`-Build liegt in der Historie: `v1.0.6` und
alle älteren Tags enthalten weder `.readthedocs.yaml` noch `mkdocs.yml`. Ein Build
dieser Commits kann daher nicht funktionieren – unabhängig von den Einstellungen im
Dashboard. Die Dokumentationsinfrastruktur existiert erst ab `v1.0.7-alpha.4`.

Daraus folgt: `stable` wird automatisch nutzbar, sobald ein **stabiles** Release mit
Dokumentationskonfiguration getaggt wird (also frühestens `v1.0.7`). Bis dahin bleibt
`latest` die richtige Standardversion; `/de/latest/` ist die stabile, verlinkbare URL.

## GitHub-Integration

Die GitHub-Integration von Read the Docs ist eingerichtet und funktioniert; es sind
keine Änderungen an der Repository-Konfiguration nötig:

- Pushes auf `main` lösen einen neuen Build von `latest` aus (der letzte Build lief am
  18.10.2026 nach dem letzten Commit auf `main`).
- Pull Requests erzeugen Vorschau-Builds, ohne dauerhaft eine öffentliche Version
  anzulegen.
- Das Repository ist als `https://github.com/YourEliteSystems/WebRadio.git` mit dem
  Projekt verbunden.

Webhook-Filter (z. B. „Changed files“) setzen die GitHub-App-Integration voraus. Sie
werden hier nicht benötigt. Welche Ereignisse einen Build auslösen, ist eine
Projekteinstellung und nicht Teil von `.readthedocs.yaml`.

## Manuelle Schritte im Dashboard

Die folgenden Einstellungen lassen sich **nicht** über eine Datei im Repository
setzen. `.readthedocs.yaml` steuert nur, *wie* eine Version gebaut wird, nicht *welche*
Versionen aktiv sind. Automatisierungsregeln sind ausschließlich im Dashboard
definiert.

### Vorhandene Versionen aktivieren

Automatisierungsregeln gelten nur für **neu angelegte** Versionen. Bereits vorhandene
Tags müssen einmalig von Hand aktiviert werden:

1. <https://app.readthedocs.org/projects/webradio/versions/> öffnen
   (oder **Admin → Versions** im Projekt).
2. Gewünschte Version suchen, z. B. `v1.0.7-beta.2`.
3. **Activate** wählen; der Build startet sofort.
4. Nach dem Build die URL prüfen: `https://webradio.readthedocs.io/de/v1.0.7-beta.2/`.
5. `v1.0.6` und ältere Tags **nicht** aktivieren – sie können nicht bauen (siehe oben).

### Automatisierungsregeln für neue Tags

**Admin → Automation Rules → Add Rule**. Die Reihenfolge der Regeln ist relevant
(oben = höhere Priorität). Empfohlene Regeln:

| Beschreibung | Match | Version type | Action |
| ------------ | ----- | ------------ | ------ |
| Stabile Releases veröffentlichen | Custom match (Regex unten) | Tag | Activate version |
| Beta- und RC-Dokumentation veröffentlichen | Custom match (Regex unten) | Tag | Activate version |

Die beiden regulären Ausdrücke für das Feld **Custom match**:

```text
Stabile Releases:      ^v[0-9]+\.[0-9]+\.[0-9]+$
Beta- und RC-Releases: ^v[0-9]+\.[0-9]+\.[0-9]+-(beta|rc)\.[0-9]+$
```

- Die erste Regel baut jedes stabile Release. `stable` folgt dabei automatisch dem
  neuesten stabilen Tag.
- Die zweite Regel veröffentlicht Beta- und RC-Dokumentation für Tester. Diese
  Versionen sind über ihren Tag-Namen klar als Vorabversion erkennbar und werden von
  `stable` ignoriert.
- Alpha-Tags bleiben bewusst inaktiv, damit die Versionsliste nicht mit Zwischenständen
  gefüllt wird. Sollen sie später doch erscheinen, genügt eine weitere Regel mit
  `^v[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$`.
- Für Branches und Pull Requests sind **keine** Regeln nötig: Sie sind standardmäßig
  inaktiv, und PR-Builds sind temporär. Damit erscheinen keine beliebigen
  Arbeitsbranches dauerhaft als Release-Dokumentation.

### Standardversion

Die Standardversion bestimmt, wohin `https://webradio.readthedocs.io/` weiterleitet.
Sie wird **nicht** in einer Datei festgelegt:

1. **Admin → Versions** öffnen.
2. Zielversion wählen.
3. **Make default** (bzw. **Set as default**) auswählen.

Empfehlung:

- **Jetzt:** `latest` bleibt Standard. Es gibt noch keine baubare stabile Version, und
  `stable` würde derzeit auf `404` zeigen.
- **Ab dem ersten stabilen Release mit Dokumentation** (z. B. `v1.0.7`): `stable` als
  Standard setzen. Endbenutzer landen dann auf der stabilen Dokumentation, während
  `/de/latest/` unverändert den Entwicklungsstand zeigt.
- Alternativ kann eine Automatisierungsregel mit `Set version as default` für stabile
  Tags diesen Wechsel übernehmen.

## URL-Schema und bestehende Links

Das Projekt verwendet bereits `multiple_versions_with_translations`, also URLs der Form
`/de/<version>/…` (Sprachsegment `de`, danach das Versionssegment). Das Aktivieren
weiterer Versionen ändert dieses Schema **nicht**:

- `https://webradio.readthedocs.io/de/latest/` bleibt gültig.
- Neue Versionen erscheinen daneben als `/de/v1.0.7-beta.2/`, `/de/stable/` usw.
- `https://webradio.readthedocs.io/` leitet auf die Standardversion weiter.
- Es sind **keine Weiterleitungen** nötig, solange das Schema unverändert bleibt.
  Würde das Projekt auf „Single Version“ umgestellt, würden alle bestehenden Links
  brechen; das ist nicht vorgesehen.

Die README verlinkt bewusst `/de/latest/` (Entwicklungsstand). Interne Links in `docs/`
sind relativ und funktionieren dadurch in jeder Version.

## Alte Versionen

Alte Versionen bleiben erhalten und werden nicht gelöscht. Wenn eine Version nicht mehr
im Umschalter erscheinen soll, kann sie im Dashboard **versteckt** werden
(**Admin → Versions → Hide**); die URL bleibt dabei erreichbar. Löschen ist nur für
Versionen sinnvoll, die nie veröffentlicht wurden beziehungsweise deren Tag entfernt
wurde – vorhandene Git-Tags werden nicht verändert.

## Lokal bauen

```bash
python -m venv .venv

# Windows
.venv/Scripts/python -m pip install -r docs/requirements.txt
.venv/Scripts/python -m mkdocs build --strict

# Linux/macOS
.venv/bin/python -m pip install -r docs/requirements.txt
.venv/bin/python -m mkdocs build --strict
```

`mkdocs serve` startet denselben Build als lokalen Server.

Lokal gibt es nur eine Version. Der Versionsumschalter wird ausschließlich von Read the
Docs ausgeliefert. Für den kanonischen Link nutzt `mkdocs.yml` die Variable
`READTHEDOCS_CANONICAL_URL`; ohne diese Variable greift ein lokaler Fallback auf
`https://webradio.readthedocs.io/de/latest/`.

## Weiterführende Dokumentation

- [Versionen](https://docs.readthedocs.com/platform/latest/versions.html)
- [URL-Schemata](https://docs.readthedocs.com/platform/latest/versioning-schemes.html)
- [Automatisierungsregeln](https://docs.readthedocs.com/platform/stable/automation-rules.html)
- [Git-Integration](https://docs.readthedocs.com/platform/latest/reference/git-integration.html)
