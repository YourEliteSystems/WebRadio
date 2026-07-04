# Security Policy

## Unterstützte Versionen

Wir veröffentlichen Sicherheits-Patches für die folgenden Versionen:

| Version | Unterstützt |
| --- | --- |
| 1.0.x (aktuell) | ✅ Ja |
| < 1.0 | ❌ Nein |

---

## Sicherheitslücken melden

> [!CAUTION]
> Bitte melde Sicherheitslücken **niemals** über öffentliche GitHub Issues, Pull Requests oder Diskussionen. So schützt du andere Nutzer vor einer möglichen Ausnutzung, bevor ein Fix verfügbar ist.

### Meldeprozess

1. **Erstelle einen privaten Security Report** direkt auf GitHub:  
   Navigiere zu `Security` → `Report a vulnerability` im Repository.

2. **Alternativ per E-Mail:** Wende dich direkt an den Maintainer via GitHub-Profil.

3. Füge deinem Report folgende Informationen bei:
   - Beschreibung der Schwachstelle
   - Schritte zur Reproduktion
   - Mögliche Auswirkungen (z.B. Datenverlust, Remote Code Execution)
   - Betroffene Version(en)
   - Wenn möglich, einen proof-of-concept

### Was passiert nach deiner Meldung?

- Wir bestätigen den Eingang deines Reports **innerhalb von 72 Stunden**.
- Wir arbeiten gemeinsam mit dir an einem Fix.
- Wir veröffentlichen nach der Behebung einen Sicherheits-Advisory mit Anerkennung deines Beitrags (sofern du das möchtest).

---

## Sicherheits-Architektur von WebRadio

Um das Vertrauen in die App zu stärken, hier eine Übersicht unserer Sicherheitsmaßnahmen:

### Electron Sicherheitskonfiguration

| Einstellung | Wert | Bedeutung |
| --- | --- | --- |
| `contextIsolation` | `true` | Renderer-Kontext ist vom Node-Kontext getrennt |
| `nodeIntegration` | `false` | Node.js APIs sind im Renderer nicht verfügbar |
| `sandbox` | `false` | Deaktiviert für Audio-Worklet-Kompatibilität* |
| `contextBridge` | ✅ aktiv | Einziger sicherer Kommunikationskanal |

> [!WARNING]
> `sandbox: false` ist eine bewusste Entscheidung für die Audio-Pipeline (AudioWorklet). Dies bedeutet, dass Renderer-Plugins grundsätzlich Zugriff auf mehr APIs haben. Plugin-Autoren sind daher besonders in der Pflicht, keinen schadhaften Code einzubringen.

### Plugin-Sicherheit

Plugins werden als lokale JavaScript-Module geladen und laufen im Electron Main-Prozess (Backend-Plugins) oder im Renderer-Prozess (UI-Plugins). Folgende Einschränkungen gelten:

- **Backend-Plugins** dürfen nur über die offizielle Plugin-API (`context.events`, `context.storage`) kommunizieren.
- **Renderer-Plugins** dürfen nur über `window.pluginAPI`, `window.api` und `window.uiRegistry` mit dem System interagieren.
- Direkte Imports aus `electron/core/` sind für Plugins verboten.
- Plugins mit schadhaftem Verhalten werden aus dem Repository entfernt.

> [!IMPORTANT]
> WebRadio lädt **keine** Plugins aus dem Internet. Alle Plugins werden lokal aus dem `plugins/`-Verzeichnis geladen. Nutze nur Plugins aus vertrauenswürdigen Quellen.

### IPC-Sicherheit

Alle Kommunikation zwischen Renderer und Main-Prozess läuft ausschließlich über die in `electron/preload.js` definierte `contextBridge`. Es gibt keine direkte Node.js-Exposition im Frontend.

---

## Bekannte Einschränkungen

| Bereich | Status | Hinweis |
| --- | --- | --- |
| Plugin Sandboxing | ⚠️ Geplant | Volle Sandbox für Plugins ist für v2.0 geplant |
| Plugin Permissions | ⚠️ In Arbeit | Permissions-System wird in v1.2 eingeführt |
| Content Security Policy | ✅ Aktiv | CSP ist in `index.html` und `settings.html` konfiguriert |

---

*Danke, dass du dabei hilfst, WebRadio sicher zu halten! 🔐*
