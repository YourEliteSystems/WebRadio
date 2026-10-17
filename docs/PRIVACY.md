# Datenschutz und Datenflüsse

WebRadio ist eine lokale Desktop-Anwendung. Viele Funktionen arbeiten ohne einen accountbasierten Dienst, aber ein paar Features kontaktieren externe Server oder nutzen Plattform-APIs.

## Was die Anwendung lokal hält

- Einstellungen, Favoriten, Verlauf und Plugin-Daten werden in der lokalen Anwendungsspeicherung abgelegt.
- Plugins laufen in einer kontrollierten Umgebung mit eigenen Berechtigungen und Capabilities.
- Updates werden ausschließlich aus offiziellen GitHub-Releases bezogen.

## Radio-Browser

- Die Senderauswahl nutzt die Radio-Browser-API.
- Damit werden Anfragen an externe Server für die Suche und den Abruf von Senderlisten gesendet.
- Welche Daten dabei im Einzelfall übertragen werden, hängt von der jeweiligen API-Anfrage ab.

## Updates

- Update-Prüfungen und Downloads stammen aus den offiziellen GitHub-Releases.
- Die Anwendung prüft Verfügbarkeit von neueren Versionen und Release-Informationen.

## Discord Rich Presence

- Wenn aktiviert, wird Discord Rich Presence genutzt, um aktuelle Sender- oder Titelinformationen anzuzeigen.
- Dabei werden die entsprechenden Discord-Funktionen verwendet, sobald die Desktop-Anwendung dazu berechtigt ist.

## Telemetrie und Diagnose

- Die Anwendung enthält Diagnose-, Logging- und Crash-Handling-Funktionen.
- Welche Informationen dabei erfasst werden, soll nachvollziehbar sein und sollte in der Anwendung selbst oder in dieser Datenschutzseite offengelegt werden.
- Wenn Telemetrie oder optionale Diagnosefunktionen vorhanden sind, muss ihre Aktivierung und ihr Umfang klar beschrieben sein.

## Integrationen

- Einige Funktionen, wie etwa Medien- oder Dienst-Integrationen, können zusätzliche Berechtigungen oder externe Dienste nutzen.
- Je nach Integration kann es zusätzliche Datenflows geben.
- Die konkreten Integrationen und ihre Datenverarbeitung sind in der jeweiligen Integrationsdokumentation zu beschreiben.

## Drittanbieter-Komponenten

- Die Anwendung setzt auf Drittanbieter-Bibliotheken und gegebenenfalls auf mitgelieferte Werkzeuge wie FFmpeg.
- Die genauen Lizenz- und Quellenangaben für diese Komponenten sollten separat dokumentiert werden, bevor die Datenschutz- und Lizenzseiten als vollständig gelten.

## Offene Punkte

- Eine vollständige Liste der übertragenen Daten, der genutzten externen Endpunkte und der optionalen Telemetrie sollte erst veröffentlicht werden, wenn die tatsächliche Implementierung abschließend geprüft wurde.
- Maskierungen, Logging-Filter und Crash-Berichtsfunktionen sind im aktuellen Stand als potenziell relevant zu behandeln, solange sie nicht abschließend dokumentiert sind.

## Kontakt

Für Fragen zum Datenschutz und zu externen Datenflows ist das Projekt-Team über GitHub Issues oder die offiziellen Kommunikationskanäle erreichbar.
