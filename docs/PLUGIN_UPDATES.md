# Plugin-Updates

Das Plugin-Update-System aktualisiert installierte Plugins aus einer vom
Entwickler betriebenen Update-Quelle. Die WebRadio-Website bleibt die zentrale
Registrierungs- und Metadatenquelle; Pakete werden in dieser Phase **nicht**
zentral von WebRadio ausgeliefert.

> Status: Implementierungsphase für v1.0.8. Die Anwendung bleibt auf Version
> 1.0.7. Es gibt keinen automatischen Installationsvorgang ohne ausdrückliche
> Benutzerentscheidung.

---

## Verantwortlichkeiten

| Ebene | Aufgabe |
| --- | --- |
| WebRadio-Website | Veröffentlichungsstatus, Name, Entwickler, aktuelle Version (öffentliche Katalog-API) |
| Entwickler-Update-Server | Update-Manifest und Plugin-Paket (ZIP) über HTTPS |
| WebRadio Desktop | Prüfung, Download, Verifikation, Installation, Backup, Rollback |

Die Desktop-Anwendung ruft **keine** beliebigen URLs aus Manifesten auf, ohne
sie gegen die HTTPS-/Host-Policy zu prüfen.

---

## Website-API: tatsächlich vorhandener Umfang

Öffentlich existiert genau eine Plugin-Schnittstelle:

```http
GET /api/plugins?page=1
```

Antwort:

```json
{
  "data": [
    {
      "id": "01a183d9-18c8-77ec-a7fa-1cf8d77289c7",
      "slug": "mediahub",
      "name": "MediaHub",
      "description": "…",
      "developerName": "Snip3r",
      "tags": [],
      "downloads": 0,
      "latestVersion": "0.12.0",
      "updatedAt": "2026-10-30T20:19:59.883Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 9, "hasNext": false }
}
```

Die Route liefert ausschließlich Einträge mit `isPublished = true` **und**
`status = APPROVED`; der Filter liegt im Datenlayer der Website. Weitere
Abfrageparameter sind `q`, `sort` und `page`.

**Nicht vorhanden** (und deshalb nicht verwendet): Detail-Endpunkt pro Plugin,
Manifest-URL, Update-Kanal, Kompatibilitätsangaben, Changelog, Download-URL,
Signatur oder Moderationsdetails. Die Desktop-Anwendung nimmt diese Felder
auch nicht an – sie stammen ausschließlich aus dem Update-Manifest.

Die Plugin-ID der Desktop-App entspricht dem `slug` der Website. Weicht sie ab,
wird kein Update angeboten (`not_published`).

---

## Update-Manifest (Schema-Version 1)

Jede angebotene Version wird durch ein Manifest beschrieben. Es wird über HTTPS
geladen, streng validiert und – sofern signiert – kryptografisch geprüft.

```json
{
  "schemaVersion": 1,
  "pluginId": "mediahub",
  "version": "0.13.0",
  "channel": "stable",
  "engines": { "webradio": ">=1.0.7" },
  "release": {
    "downloadUrl": "https://updates.example.com/mediahub/mediahub-0.13.0.zip",
    "sha256": "9f2c…64 hex…",
    "size": 183424,
    "releasedAt": "2026-11-12T09:00:00.000Z"
  },
  "changelog": "- Playlisten-Suche beschleunigt\n- Fix: Tonspur nach Pause",
  "dependencies": [
    { "id": "audio-tools", "range": ">=1.0.0", "optional": false }
  ],
  "permissions": ["navigation", "player"],
  "capabilities": ["http-origin", "player"],
  "webSessionOrigins": ["https://music.youtube.com"],
  "signature": {
    "algorithm": "ed25519",
    "keyId": "snip3r-2026",
    "value": "base64…"
  }
}
```

### Felder

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `schemaVersion` | ja | muss `1` sein |
| `pluginId` | ja | unveränderlich, `^[a-z0-9][a-z0-9-]{0,63}$` |
| `version` | ja | Semver der neuen Version |
| `channel` | ja | `stable`, `beta` oder `alpha` |
| `engines.webradio` | ja | Semver-Bereich der unterstützten WebRadio-Versionen |
| `release.downloadUrl` | ja | HTTPS-URL des ZIP-Pakets |
| `release.sha256` | ja | SHA-256 des ZIP-Pakets (hex) |
| `release.size` | ja | Größe in Bytes (max. 64 MiB) |
| `release.releasedAt` | ja | ISO-8601-Zeitstempel |
| `changelog` | nein | Text, max. 8000 Zeichen |
| `dependencies` | nein | Liste `{ id, range, optional }` |
| `permissions` | nein | Berechtigungen der neuen Version |
| `capabilities` | nein | Fähigkeiten der neuen Version |
| `webSessionOrigins` | nein | exakte HTTPS-Origins für Web-Session-Capabilities |
| `signature` | nein | `{ algorithm: "ed25519", keyId, value }` |

Unbekannte Felder werden **abgelehnt**. Schemaänderungen erfordern eine neue
`schemaVersion`.

---

## Update-Quelle im Plugin deklarieren

Die installierte `plugin.json` nennt ihre Update-Quelle:

```json
{
  "id": "mediahub",
  "name": "MediaHub",
  "version": "0.12.0",
  "main": "main.js",
  "update": {
    "manifestUrl": "https://updates.example.com/mediahub/manifest.json",
    "channel": "stable"
  }
}
```

Ohne `update.manifestUrl` zeigt die Plugin-Verwaltung „Keine Update-Quelle
hinterlegt“; es wird nichts abgerufen.

---

## Eigenen Update-Server betreiben

Es genügt statisches Hosting über HTTPS:

```text
https://updates.example.com/mediahub/
├── manifest.json          # aktuell angebotene Version
├── mediahub-0.13.0.zip    # Paket
└── mediahub-0.12.0.zip    # ältere Pakete (optional)
```

Anforderungen an den Server:

* HTTPS mit gültigem Zertifikat, Port 443
* korrekte `Content-Length`
* höchstens drei Weiterleitungen, jede über HTTPS und auf einen öffentlichen Host
* keine Zugangsdaten in der URL, keine IP-Literale, keine privaten Netze
* ZIP-Paket mit `plugin.json` im Wurzelverzeichnis

Ein Paket enthält mindestens `plugin.json` und die Einstiegsdatei; die
`plugin.json` im Paket muss dieselbe `id` und `version` wie das Manifest
nennen und **dieselben** Berechtigungen, Fähigkeiten und `webSessionOrigins`
deklarieren.

---

## Update-Kanäle

Der Kanal wird pro Plugin in der Plugin-Verwaltung gewählt (`stable`, `beta`,
`alpha`). Ein Manifest gilt nur für seinen eigenen Kanal; passt der Kanal
nicht, wird das Update als „Anderer Kanal“ angezeigt und nicht installiert.
So lassen sich pro Kanal eigene Manifest-URLs betreiben.

---

## Kompatibilität

`engines.webradio` wird gegen die laufende App-Version geprüft. Unterstützt
werden exakte Versionen sowie `>=`, `>`, `<=`, `<`, `^`, `~` und
Leerzeichen-kombinierte Bereiche (z. B. `>=1.0.7 <2.0.0`). Nicht unterstützte
Schreibweisen gelten als ungültig.

Inkompatible Updates bleiben sichtbar, sind aber nicht installierbar.

---

## Abhängigkeiten

Deklarierte Abhängigkeiten müssen installiert sein und den angegebenen Bereich
erfüllen. Optionale Abhängigkeiten werden nur geprüft, wenn sie installiert
sind. Fehlt eine Pflichtabhängigkeit, wird das Update nicht angeboten
(`missing_dependencies`).

---

## Berechtigungen

Ändern sich Berechtigungen gegenüber der installierten Version, zeigt die
Anwendung die Differenz vor der Installation an:

* **hinzugefügte** Berechtigungen und Fähigkeiten müssen ausdrücklich bestätigt
  werden – ohne Bestätigung wird nichts installiert,
* **entfernte** Berechtigungen werden nur informativ genannt.

Das Paket darf keine anderen Rechte deklarieren als das geprüfte Manifest,
sonst wird die Installation abgelehnt.

---

## Signierung

Empfohlen und für produktive Kanäle vorgesehen: Ed25519-Signatur über die
kanonische JSON-Darstellung des Manifests ohne das Feld `signature`
(Schlüssel alphabetisch sortiert, keine Leerzeichen).

### Schlüsselpaar erzeugen

```bash
node -e "
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
console.log('public :', publicKey.export({format:'der',type:'spki'}).toString('base64'));
console.log('private:', privateKey.export({format:'der',type:'pkcs8'}).toString('base64'));
"
```

Der **private** Schlüssel bleibt beim Herausgeber (CI-Secret, HSM, nichts
davon im Repository). Der öffentliche Schlüssel wird in
`electron/core/plugins/update/trusted-keys.json` aufgenommen:

```json
{
  "keys": [
    {
      "keyId": "snip3r-2026",
      "algorithm": "ed25519",
      "publicKey": "MCowBQYDK2VwAyEA…"
    }
  ]
}
```

### Signieren

```js
const crypto = require("crypto");
const SignatureVerifier = require("./electron/core/plugins/update/SignatureVerifier");

const payload = SignatureVerifier.buildPayload(manifest); // ohne signature
const value = crypto.sign(null, payload, privateKey).toString("base64");
const signed = { ...manifest, signature: { algorithm: "ed25519", keyId: "snip3r-2026", value } };
```

Verhalten der Anwendung:

| Signatur | Verhalten |
| --- | --- |
| gültig | Update wird angeboten |
| ungültig / manipuliert | Update wird abgelehnt |
| unbekannter `keyId` | Update wird abgelehnt |
| nicht vorhanden | Update wird angeboten, aber erst nach ausdrücklicher Bestätigung „Trotzdem installieren“ |

Eine Prüfsumme allein belegt keine Authentizität. Ohne Signatur schützt die
SHA-256-Prüfung nur gegen Übertragungsfehler, nicht gegen einen kompromittierten
Update-Server.

---

## Neue Version veröffentlichen (Checkliste)

1. Plugin-Version in `plugin.json` erhöhen.
2. Paket als ZIP bauen (`plugin.json` im Wurzelverzeichnis).
3. SHA-256 und Größe des ZIPs berechnen.
4. Manifest mit `pluginId`, `version`, `channel`, `engines`, `release`,
   `changelog` und den tatsächlichen Berechtigungen schreiben.
5. Manifest signieren und Signaturblock ergänzen.
6. Manifest als `manifest.json` hochladen, ZIP daneben ablegen.
7. Auf der Website eine Veröffentlichung mit derselben Version anstoßen – nur
   freigegebene Plugins erhalten Updates.
8. In WebRadio „Nach Updates suchen“ auslösen und die Anzeige prüfen.

---

## Installationsablauf

1. Installierte Plugins erfassen
2. Katalog-Eintrag über die Website-API prüfen (nur veröffentlichte Plugins)
3. Manifest laden, validieren, Signatur prüfen
4. Kanal, Kompatibilität, Abhängigkeiten und Berechtigungen prüfen
5. Benutzer startet das Update
6. Paket in ein temporäres Verzeichnis laden (Größenlimit, SHA-256)
7. ZIP validieren (Pfade, Symlinks, CRC, Limits) und in ein Staging-Verzeichnis
   entpacken
8. `plugin.json` im Paket prüfen (ID, Version, Rechte)
9. Übersetzungskataloge des Pakets provisionieren (vorheriger Stand als Backup)
10. Installiertes Verzeichnis ins Backup verschieben
11. Staging atomar an die Zielstelle verschieben
12. Plugin neu laden
13. Bei jedem Fehler: Rollback auf die vorherige Version **und** die vorherigen
    Kataloge

Schlägt auch der Rollback fehl, bleibt das Backup erhalten und die Anwendung
meldet „Wiederherstellung fehlgeschlagen“ mit dem Backup-Pfad im Log.

---

## Übersetzungskataloge

Deklariert die neue Version `localization` in ihrer `plugin.json`, werden die
Kataloge im selben Schritt wie die Plugin-Dateien nach
`userData/localization/plugins/<plugin-id>/` geschrieben. Der vorherige Stand
wird als Backup aufbewahrt.

* **Update**: neue Kataloge ersetzen die alten; andere Plugins bleiben unberührt.
* **Rollback**: schlägt das Neuladen fehl, werden die vorherigen Kataloge
  zusammen mit den Dateien zurückgespielt.
* **Version ohne Übersetzungen**: die alten Kataloge werden gesichert und aus
  dem aktiven Pfad entfernt.
* **Ungültige Kataloge**: das Update wird mit `catalog_provision_failed`
  abgebrochen, bevor Dateien getauscht werden.

Die Kataloge werden ausschließlich im Main-Prozess geschrieben; das Plugin
selbst erhält nur Lesezugriff auf seinen Namensraum (siehe
[Localization](LOCALIZATION_API.md)).

---

## Grenzen

| Grenze | Wert |
| --- | --- |
| Manifest-Größe | 256 KiB |
| Paketgröße | 64 MiB |
| Einträge pro ZIP | 2000 |
| Größe pro Eintrag | 32 MiB |
| Entpackt gesamt | 64 MiB |
| Pfadtiefe | 10 |
| Weiterleitungen | 3 |
| Download-Timeout | 45 s (Manifest 15 s) |

Unterstützt werden ausschließlich „stored“ und „deflate“; verschlüsselte
Einträge, ZIP64 und Symlinks werden abgelehnt.

---

## Fehlercodes und Fehlerbehebung

| Code | Ursache | Lösung |
| --- | --- | --- |
| `no_source` | `update.manifestUrl` fehlt | Feld in `plugin.json` ergänzen |
| `catalog_unavailable` | Website-API nicht erreichbar | Netzwerk/Website prüfen |
| `not_published` | Plugin oder Version nicht freigegeben | Veröffentlichung auf der Website |
| `manifest_invalid` | Feld fehlt/ungültig, unbekanntes Feld | Manifest gegen diese Dokumentation prüfen |
| `signature_invalid` | Signatur ungültig oder Schlüssel unbekannt | Signatur erneuern, Schlüssel aufnehmen |
| `channel_mismatch` | Manifest gehört zu anderem Kanal | Kanal wählen oder Manifest tauschen |
| `incompatible_engine` | `engines.webradio` passt nicht | Bereich anpassen |
| `missing_dependencies` | Abhängigkeit fehlt | Plugin installieren oder Abhängigkeit entfernen |
| `insecure_protocol` | Download nicht über HTTPS | HTTPS-URL verwenden |
| `private_address` | Ziel liegt in einem internen Netz | öffentlichen Host verwenden |
| `too_large` | Limit überschritten | Paket verkleinern |
| `integrity_mismatch` | Prüfsumme/Größe falsch | Manifest neu erzeugen |
| `path_traversal` | ZIP enthält unsichere Pfade | Paket neu bauen |
| `crc_mismatch` | ZIP beschädigt | Paket neu hochladen |
| `permissions_not_approved` | neue Rechte nicht bestätigt | im Dialog bestätigen |
| `catalog_provision_failed` | Übersetzungskataloge ungültig/nicht schreibbar | `localization` im Paket prüfen, Schreibrechte unter `userData` prüfen |
| `install_failed_rolled_back` | Installation fehlgeschlagen | Log prüfen, vorherige Version läuft weiter |
| `rollback_failed` | Wiederherstellung fehlgeschlagen | Backup unter `userData/plugin-updates/backups/` |

Logs: `userData/logs/`, Logger `PluginUpdate`.

---

## Automatische Prüfung

Die automatische Prüfung **sucht** nur. Sie startet 20 Sekunden nach dem
App-Start und danach im eingestellten Intervall (Standard: 6 Stunden). Eine
automatische Installation findet nicht statt; jedes Update erfordert eine
Benutzeraktion.

---

## Nicht Teil dieser Phase

* zentrale Paketbereitstellung über WebRadio-Server
* automatische Installation ohne Benutzerentscheidung
* Website-Endpunkte für Manifest-URL, Kanäle, Changelog oder Download
  (Erweiterung der öffentlichen API bleibt Phase 3)
* Löschen alter Backups (bewusst aufbewahrt)
