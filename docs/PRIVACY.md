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

- WebRadio erhebt und überträgt **keinerlei Telemetriedaten, Nutzungsstatistiken oder Tracking** an externe Server.
- Es sind keine Telemetrie-Dienste (wie Sentry, Aptabase oder Google Analytics) in der Anwendung integriert.
- Diagnose-Logs und Crash-Berichte verbleiben ausschließlich **lokal auf dem Gerät** des Nutzers (im Verzeichnis `userData/logs` und `userData/crash`) und werden niemals automatisch übertragen.
- Sensible Daten (wie Tokens, Passwörter und Secrets) werden durch integrierte Filter vor dem Schreiben in Crash-Dumps oder Logs automatisch maskiert (`[REDACTED]`).

## Integrationen

- Einige Funktionen, wie etwa optionale Medien- oder Dienst-Integrationen (z. B. MediaHub / Google YouTube), können zusätzliche Berechtigungen oder externe Dienste nutzen.
- Authentifizierungs-Tokens für Google OAuth werden auf dem lokalen System verschlüsselt (AES-256-GCM) abgelegt und niemals im Klartext gespeichert.
- Die konkreten Integrationen und ihre Datenverarbeitung sind in der jeweiligen Integrationsdokumentation beschrieben.

## Drittanbieter-Komponenten

- Die Anwendung verwendet Drittanbieter-Bibliotheken und mitgelieferte Werkzeuge wie `ffmpeg-static`. Das npm-Paket deklariert GPL-3.0-or-later; die Lizenz der konkreten mitgelieferten FFmpeg-Binärdatei muss anhand ihrer Build-Konfiguration separat geprüft werden.
- FFmpeg verarbeitet Audiostreams lokal auf dem Rechner; der Audiostream wird dabei von der ausgewählten Radiostation empfangen, nicht an Server der FFmpeg-Entwickler übertragen.
- Eine erste Übersicht der direkten Abhängigkeiten steht in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Die vollständige Prüfung transitiver Abhängigkeiten und der Release-Binärdateien ist noch offen.

## Zusammenfassung der externen Datenflüsse

1. **Radio-Browser API:** Abruf von Senderlisten und Sendersuche über öffentliche Mirrors (z. B. `api.radio-browser.info`).
2. **Audio-Streams:** Direkter Empfang von PCM-Audiodaten der jeweils vom Nutzer ausgewählten Radiostation.
3. **GitHub Releases API:** Optionale Prüfung auf Anwendungs-Updates sowie Abruf von Versionsinformationen.
4. **Discord Rich Presence (opt-in):** Lokale IPC-Kommunikation mit dem installierten Discord-Desktop-Client zur Anzeige des aktuellen Senders/Titels.
5. **Google OAuth (opt-in):** Nur im MediaHub-Plugin bei ausdrücklicher Anmeldung durch den Nutzer zur Wiedergabe eigener YouTube-Favoriten.

## Kontakt

Für Fragen zum Datenschutz und zu externen Datenflows ist das Projekt-Team über GitHub Issues oder die offiziellen Kommunikationskanäle erreichbar.
