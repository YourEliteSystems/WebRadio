# Bedrohungsmodell für WebRadio

**Status:** Erste technische Bestandsaufnahme, kein formelles Sicherheitsaudit. Dieses Dokument beschreibt den derzeit sichtbaren Architekturstand und priorisiert offene Risiken.

## Umfang und Schutzgüter

WebRadio ist eine Electron-Desktopanwendung mit einem privilegierten Main-Prozess, Renderer-Fenstern, einer Preload-Brücke, Plugins, Themes, Netzwerkzugriff für Radiostreams und einem Aktualisierungssystem.

Zu schützende Werte:

- lokale Einstellungen, Favoriten, Verlauf, Protokolle und Diagnoseinformationen;
- gespeicherte Zugangsdaten beziehungsweise OAuth-Tokens von Integrationen;
- Integrität der Anwendung, ihrer Plugins und ihrer Aktualisierungen;
- Verfügbarkeit und Stabilität der Audio- und UI-Prozesse;
- Kontrolle über Dateisystem, Betriebssystemprozesse und externe Netzwerkverbindungen.

## Vertrauensgrenzen im aktuellen Stand

### Main-Prozess und Plugin-Code

Der Main-Prozess lädt den Einstiegspunkt eines Plugins derzeit mit `require(mainFile)`. Das Plugin läuft damit im Prozess der Anwendung und kann grundsätzlich die dort verfügbaren Node.js-Rechte nutzen. Das Plugin-Manifest und das Capability-/Permission-System ersetzen keine Betriebssystem-Sandbox.

**Folge:** Ein Plugin aus einer nicht vertrauenswürdigen Quelle muss aktuell als ausführbarer, potenziell voll privilegierter Code behandelt werden.

### Renderer und Preload

Die Haupt- und Einstellungsfenster setzen `contextIsolation: true` und `nodeIntegration: false`. Beide setzen derzeit jedoch ausdrücklich `sandbox: false`. Die Preload-Datei stellt zahlreiche APIs über `contextBridge` bereit.

Renderer-Plugins werden über den lokalen Plugin-HTTP-Server als Skripte in den bestehenden Haupt-Renderer geladen. Sie laufen dadurch nicht in einem eigenen Sandbox-iframe und teilen den Renderer-Kontext. Eine globale Preload-API ist daher nicht automatisch auf die Berechtigungen eines einzelnen Plugins begrenzt.

### Lokaler Plugin-HTTP-Server

Der Server bindet an `127.0.0.1` auf einem dynamischen Port und liefert Ressourcen über GET/HEAD aus. Für echte externe Origins werden Capability-Regeln geprüft. Für opake lokale `file://`-Origins ist eine gesonderte CORS-Behandlung vorhanden.

CORS ist jedoch keine Grenze gegen beliebige lokale Prozesse: Ein anderer Prozess auf demselben Rechner kann HTTP-Anfragen senden. Der dynamische Port allein ist keine Authentifizierung.

### Content Security Policy

Die Hauptansicht erlaubt Skripte von `self` und dem Loopback-Plugin-Server. Außerdem sind unter anderem breite `media-src`- und `img-src`-Regeln sowie YouTube-Frames erlaubt. Diese Regeln erfüllen aktuelle Produktanforderungen, sind aber keine Isolation für Plugin-Code.

## Bedrohungen und aktuelle Einschätzung

| Bedrohung | Auswirkung | Aktueller Schutz / Einschränkung |
|---|---|---|
| Bösartiges oder kompromittiertes Main-Prozess-Plugin | Zugriff auf Node.js, Dateien, Prozesse und Anwendungszustand; potenzielle vollständige Kompromittierung | Manifestprüfungen und API-Konventionen, aber keine Prozess-Sandbox |
| Bösartiges Renderer-Plugin | Zugriff auf den gemeinsamen DOM-/Renderer-Kontext und global exponierte Preload-APIs | Context Isolation und deaktivierte Node-Integration helfen gegen direkten Node-Zugriff; sie isolieren Plugin-Skripte untereinander nicht |
| Kompromittierte npm-Abhängigkeit | Codeausführung beim Build oder zur Laufzeit | Lockfile, CI und Dependabot; der Dependency-Audit meldet derzeit noch offene Schwachstellen |
| Missbrauch des lokalen Plugin-HTTP-Servers | Lesen von Plugin-Ressourcen oder Missbrauch von Endpunkten aus einem lokalen Prozess | Loopback-Bindung, erlaubte Methoden und Origin-Prüfungen; keine Authentifizierung allein durch CORS |
| Manipuliertes Radio-Metadatum oder Plugin-Inhalt | UI-Manipulation, Phishing oder Renderer-Codeausführung, falls Inhalte unsicher verarbeitet werden | CSP und bestehende Sanitization; alle dynamischen UI-Ausgaben müssen weiterhin geprüft werden |
| Manipuliertes oder kompromittiertes Update-Artefakt | Ausführung einer schädlichen Programmversion | Release-Infrastruktur und Prüfsummen; Code-Signing und Artefakt-Verifikation sind nicht vollständig etabliert |
| Offenlegung lokaler Diagnoseinformationen | Preisgabe von Pfaden, Stationsverlauf oder anderen lokalen Daten | Diagnosefunktionen und lokale Speicherung; Export und Weitergabe sollten bewusst durch den Benutzer erfolgen |

## Vorhandene Schutzmaßnahmen

- `contextIsolation: true` und `nodeIntegration: false` in Haupt- und Einstellungsfenster;
- Content Security Policy; `webSecurity` wird nicht deaktiviert;
- Preload-APIs werden über `contextBridge` statt durch direkte Freigabe von `ipcRenderer` bereitgestellt;
- Plugin-HTTP-Server bindet nur an Loopback, erlaubt nur GET/HEAD für Ressourcen und prüft externe Origins anhand von Capabilities;
- Tests prüfen unter anderem Renderer-Plugin-Laden, CSP-Verhalten, Plugin-Navigation und den Loopback-Server;
- CI, Lockfile, Dependabot und SHA-256-Prüfsummen für Release-Artefakte.

Diese Maßnahmen reduzieren bestimmte Risiken, bedeuten aber **nicht**, dass Plugins aktuell sicher isoliert oder gefahrlos aus beliebigen Quellen installierbar sind.

## Priorisierte nächste Maßnahmen

### Priorität 0 – Plugin-Vertrauensmodell klarstellen

1. Plugins aus nicht vertrauenswürdigen Quellen bis zur Isolation als nicht sicher behandeln.
2. Das Plugin-SDK so gestalten, dass Main-Prozess-Plugins nicht direkt mit `require()` in den Hauptprozess geladen werden, sondern über einen eingeschränkten IPC-/RPC-Vertrag in einem separaten Prozess laufen.
3. Renderer-Plugins in isolierten Frames mit restriktiven Sandbox-Attributen ausführen und Nachrichten anhand eines Schemas validieren.
4. Preload-Funktionen nach Fenster und Plugin-Fähigkeit begrenzen, statt allen Renderer-Skripten dieselbe globale API zu geben.

### Priorität 1 – Electron und lokale Ressourcen härten

1. `sandbox: true` für beide BrowserWindows in einem separaten Kompatibilitätsschritt testen; erst nach erfolgreichen Plugin-, Audio- und Settings-Tests übernehmen.
2. CSP-Ausnahmen für Bilder, Medien und Frames minimieren, soweit Senderlogos, Radiostreams und MediaHub weiterhin funktionieren.
3. Den lokalen Plugin-HTTP-Server zusätzlich mit kurzlebigen, nicht erratbaren Zugriffstokens beziehungsweise einer gleichwertigen Request-Bindung absichern und Pfadauflösung gegen Traversal testen.
4. Für Plugins eine explizite Vertrauens-/Installationsentscheidung sowie später Hash- oder Signaturprüfung etablieren.

### Priorität 1 – Lieferkette und Releases

1. Die aktuell gemeldeten npm-Schwachstellen triagieren und beheben; der CI-Audit ist vorerst sichtbar, aber nicht blockierend.
2. FFmpeg-Binärdateien und Drittanbieter-Lizenzpflichten pro veröffentlichtem Artefakt verifizieren.
3. Code-Signing, Release-Prüfsummen und deren Verifikation in die Release-Strategie aufnehmen.

## Akzeptanzkriterien für eine spätere Sicherheitsfreigabe

- Main-Prozess-Plugins können nicht direkt auf Node.js oder das Dateisystem zugreifen.
- Renderer-Plugins haben isolierte DOM-/JavaScript-Kontexte und nur explizit freigegebene APIs.
- IPC-Handler validieren Absender, Payloads und Berechtigungen serverseitig.
- Tests decken unerlaubte IPC-Aufrufe, Pfad-Traversal, lokale HTTP-Missbrauchsversuche und CSP-Regressionsfälle ab.
- Hohe/kritische Abhängigkeitslücken sind behoben oder nachvollziehbar begründet und dokumentiert.
- Die ausgelieferten Binärdateien und deren Lizenz-/Update-Integrität sind überprüft.

Bis diese Kriterien erfüllt sind, sollte WebRadio nicht mit dem Versprechen beworben werden, dass Drittanbieter-Plugins vollständig sandboxed oder sicher isoliert seien.
