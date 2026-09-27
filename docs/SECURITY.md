# Security Policy

## Sicherheitsanspruch

Sicherheit ist ein wichtiger Bestandteil von WebRadio. Das gilt insbesondere für die Electron-Prozessgrenzen, IPC, Plugin-Berechtigungen, lokale Dateizugriffe, HTTP-Schnittstellen und den Umgang mit Updates.

## Unterstützte Versionen

Sicherheitskorrekturen werden grundsätzlich für die aktuell aktiv entwickelte Version berücksichtigt. Bei älteren Releases kann eine Aktualisierung auf eine aktuelle Version erforderlich sein, bevor ein Problem behoben werden kann.

Da WebRadio sich aktiv weiterentwickelt, sollte bei Sicherheitsmeldungen immer die konkrete Version und Plattform angegeben werden.

## Sicherheitslücke melden

Bitte veröffentliche Sicherheitslücken nicht in einem öffentlichen GitHub Issue, solange das Problem noch nicht behoben ist.

Wenn im Repository GitHub Security Advisories bzw. Private Vulnerability Reporting verfügbar ist, nutze diesen vertraulichen Meldeweg.

Falls dieser Weg nicht verfügbar ist, kontaktiere die Projektverantwortlichen über einen privaten GitHub-Kontaktweg und teile dabei möglichst nur die für die Untersuchung notwendigen Informationen.

## Informationen für eine Meldung

Eine hilfreiche Meldung enthält nach Möglichkeit:

- betroffene WebRadio-Version
- Betriebssystem und Architektur
- betroffene Komponente
- reproduzierbare Schritte
- erwartetes und tatsächliches Verhalten
- mögliche Auswirkungen
- Proof of Concept, sofern vorhanden und sicher teilbar
- relevante Logs ohne Passwörter, Tokens oder andere Geheimnisse

Bitte entferne sensible personenbezogene Daten und Zugangsdaten aus Anhängen und Logs.

## Umgang mit gemeldeten Problemen

Gemeldete Sicherheitsprobleme werden zunächst reproduziert und hinsichtlich ihrer Auswirkungen bewertet.

Je nach Schwere und Komplexität können unter anderem folgende Schritte erfolgen:

1. Reproduktion und technische Analyse
2. Eingrenzung der betroffenen Komponenten
3. Entwicklung und Test einer Korrektur
4. Veröffentlichung eines Fixes bzw. eines aktualisierten Releases
5. Dokumentation des Problems, sofern eine Veröffentlichung ohne zusätzliches Risiko möglich ist

Zeitangaben können erst nach der technischen Bewertung zuverlässig gemacht werden.

## Plugin- und Integrationssicherheit

Plugins sind ein wichtiger Bestandteil von WebRadio. Berechtigungen und Capabilities sollen den Zugriff auf geschützte Funktionen begrenzen.

Plugins dürfen das Core-Sicherheitsmodell nicht eigenständig erweitern oder umgehen.

Bei neuen Plugin-Funktionen sind insbesondere folgende Bereiche zu prüfen:

- IPC-Zugriffe
- Dateisystemzugriffe
- Netzwerkzugriffe
- HTTP-Endpunkte
- externe Prozesse
- Speicherung sensibler Daten
- Herkunft und Validierung von Eingaben

## Entwicklerhinweise

Bitte committe niemals:

- API-Keys
- Passwörter
- Tokens
- private Zertifikate
- persönliche Zugangsdaten
- lokale Geheimnisse oder Produktionskonfigurationen

Sicherheitsrelevante Änderungen sollten Tests enthalten und möglichst klein sowie nachvollziehbar bleiben.

## Responsible Disclosure

Wir bitten darum, Sicherheitsprobleme verantwortungsvoll und vertraulich zu melden und ausreichend Zeit für Analyse und Behebung einzuräumen, bevor technische Details öffentlich gemacht werden.

Vielen Dank für verantwortungsvolles Melden und für deinen Beitrag zur Sicherheit von WebRadio.
