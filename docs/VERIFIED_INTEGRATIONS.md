# Verified Integrations - Architekturplanung

**Status:** Konzeptionelle Planung  
**Version:** v2.0 Roadmap  
**Datum:** 2026-07-31

---

# Motivation

WebRadio besitzt bereits ein robustes Plugin-System und ein Integration-System für offizielle Komponenten. Langfristig soll eine dritte Ebene eingeführt werden: **Verified Integrations**.

Diese Ebene dient als Brücke zwischen:

- **Offiziellen Integrationen** (WebRadio-Team, intern)
- **Community Plugins** (offen, ungeprüft)

Verified Integrations ermöglichen es vertrauenswürdigen Drittanbietern, ihre Erweiterungen mit einem offiziellen "Verified"-Siegel zu versehen, ohne dass diese Teil des WebRadio-Kerns werden müssen.

---

# Ziele

## Primäre Ziele

1. **Vertrauenswürdigkeit**: Benutzer können verifizierte Integrationen an einem visuellen Badge erkennen
2. **Sicherheit**: Digitale Signaturen garantieren Integrität und Authentizität
3. **Partner-Support**: Hardwarehersteller und Streamingdienste können offizielle Integrationen anbieten
4. **Community-Projekte**: Große Community-Projekte können verifiziert werden
5. **Architektur-Konsistenz**: Keine neuen APIs, Nutzung der bestehenden PluginAPI

## Nicht-Ziele

- ❌ Erweiterung der PluginAPI
- ❌ Einführung einer IntegrationAPI
- ❌ Erhöhung von Berechtigungen
- ❌ Direkter Core-Zugriff für Verified Integrations
- ❌ Öffentliche APIs zwischen Integrationen
- ❌ Breaking Changes für bestehende Plugins

---

# Architekturvision

## Drei-Ebenen-Modell

```text
┌─────────────────────────────────────┐
│         WebRadio Core                │
└─────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼────┐  ┌────▼────┐  ┌────▼────┐
│ Offizielle│ │Verified │ │ Community│
│Integration│ │Integration│ │ Plugins  │
└─────────┘  └─────────┘  └─────────┘
```

### Ebene 1: Offizielle Integrationen

- **Status**: Bereits implementiert
- **Verwaltung**: WebRadio-Team
- **Lokation**: `integrations/` im Repository
- **API**: PluginAPI (keine öffentliche API)
- **Vertrauen**: Höchstes Vertrauen (intern)

### Ebene 2: Verified Integrations (Neu)

- **Status**: Geplant für v2.x
- **Verwaltung**: WebRadio-Team (Verifizierungsprozess)
- **Lokation**: Extern, aber signiert
- **API**: PluginAPI (identisch mit Community Plugins)
- **Vertrauen**: Hoch (verifiziert, signiert)
- **Herausgeber**: Partner, Community-Projekte, Hardwarehersteller

### Ebene 3: Community Plugins

- **Status**: Bereits implementiert
- **Verwaltung**: Community
- **Lokation**: `plugins/` im userData
- **API**: PluginAPI
- **Vertrauen**: Basis (nicht verifiziert)

---

# Sicherheitsmodell

## Digitale Signaturen

### Konzept

Verified Integrations müssen digital signiert sein. Die Signatur garantiert:

1. **Authentizität**: Die Integration stammt vom behaupteten Herausgeber
2. **Integrität**: Die Integration wurde nicht manipuliert
3. **Nichtabstreitbarkeit**: Der Herausgeber kann die Signatur nicht leugnen

### Mögliche Implementierung (Konzeptionell)

```
Integration-Datei
├── manifest.json
├── index.js
├── renderer.js
└── signature.json (neu)
```

**signature.json Struktur:**
```json
{
  "algorithm": "RSA-SHA256",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "signature": "base64-encoded-signature",
  "signedBy": "WebRadio Team",
  "timestamp": "2026-07-31T20:00:00Z",
  "fingerprint": "sha256:abc123..."
}
```

### Public-Key-Verfahren

**WebRadio Team (Root CA):**
- Besitzt den privaten Root-Schlüssel
- Signiert Public Keys von verifizierten Herausgebern

**Herausgeber (Partner/Community):**
- Besitzt einen eigenen Schlüsselsatz
- Lässt Public Key vom WebRadio Team signieren
- Signiert ihre Integrationen mit ihrem privaten Schlüssel

**Verifizierungsprozess:**
1. Integration wird geladen
2. signature.json wird gelesen
3. Herausgeber-Public Key wird gegen WebRadio Root CA verifiziert
4. Integration-Hash wird gegen Signatur verifiziert
5. Bei Erfolg: "Verified"-Badge wird angezeigt

### Zertifikate

**Mögliche Zertifikatsstruktur:**
```
WebRadio Root CA
├── Partner A (Hardwarehersteller)
│   ├── Integration X
│   └── Integration Y
├── Partner B (Streamingdienst)
│   └── Integration Z
└── Community Project C
    └── Integration W
```

### Herausgeberprüfung

**Verifizierungskriterien:**
- Registrierung beim WebRadio Team
- Identitätsnachweis (Organisation, GitHub, etc.)
- Code-Review (bei Bedarf)
- Einhaltung der Sicherheitsrichtlinien
- Aktive Wartungszusage

**Verifizierungsprozess:**
1. Herausgeber beantragt Verifizierung
2. WebRadio Team prüft Antrag
3. Bei Genehmigung: Schlüsselaustausch
4. Herausgeber kann Integrationen signieren
5. WebRadio Team kann Schlüssel widerrufen (bei Missbrauch)

### Integritätsprüfung

**Hash-Verfahren:**
- SHA-256 über alle Integration-Dateien
- Hash wird mit Signatur verglichen
- Bei Abweichung: Integration wird nicht geladen

**Manipulationserkennung:**
- Lokale Änderungen werden erkannt
- Download-Manipulationen werden erkannt
- Man-in-the-Middle-Angriffe werden verhindert

---

# Vertrauensmodell

## Vertrauensstufen

```text
┌─────────────────────────────────────┐
│ Offizielle Integrationen            │
│ Vertrauen: 100% (intern)           │
│ Badge: "Official"                   │
└─────────────────────────────────────┘
              │
┌─────────────────────────────────────┐
│ Verified Integrations               │
│ Vertrauen: 90% (verifiziert)        │
│ Badge: "Verified" + Herausgeber     │
└─────────────────────────────────────┘
              │
┌─────────────────────────────────────┐
│ Community Plugins                  │
│ Vertrauen: Basis (nicht verifiziert) │
│ Badge: "Community"                  │
└─────────────────────────────────────┘
```

## Herausgeber-Informationen

**Anzeige im Plugin Manager:**
```
┌─────────────────────────────────────┐
│ ✓ Verified                          │
│                                     │
│ YouTube Music Integration           │
│ v1.0.0                              │
│                                     │
│ Publisher:                          │
│ WebRadio Team                       │
│                                     │
│ [Toggle]                            │
└─────────────────────────────────────┘
```

**Community Plugin:**
```
┌─────────────────────────────────────┐
│ Community Plugin                    │
│                                     │
│ Custom Theme                        │
│ v0.5.0                              │
│                                     │
│ Publisher:                          │
│ @username                           │
│                                     │
│ [Toggle]                            │
└─────────────────────────────────────┘
```

---

# Unterschiede zu Plugins

## Gemeinsamkeiten

- Beide nutzen die PluginAPI
- Beide nutzen dieselbe Runtime (PluginRuntime)
- Beide erhalten dieselben Events
- Beide haben denselben Zugriff (kein Core-Zugriff)
- Beide sind deaktivierbar

## Unterschiede

| Eigenschaft | Community Plugin | Verified Integration |
|-------------|------------------|----------------------|
| Signatur | Nein | Ja (digital signiert) |
| Herausgeber-Prüfung | Nein | Ja (durch WebRadio Team) |
| Badge | "Community" | "Verified" + Herausgeber |
| Vertrauen | Basis | Hoch |
| Manipulationsschutz | Nein | Ja |
| Widerrufbarkeit | Nein | Ja (Schlüssel widerrufen) |
| Support | Community | Partner/WebRadio |

---

# Unterschiede zu Offiziellen Integrationen

## Gemeinsamities

- Beide nutzen die PluginAPI
- Beide nutzen dieselbe Runtime
- Beide erhalten dieselben Events
- Keine öffentliche API
- Kein direkter Core-Zugriff

## Unterschiede

| Eigenschaft | Offizielle Integration | Verified Integration |
|-------------|------------------------|----------------------|
| Lokation | `integrations/` im Repo | Extern |
| Verwaltung | WebRadio-Team (intern) | Partner (extern) |
| Signatur | Nicht erforderlich | Erforderlich |
| Badge | "Official" | "Verified" + Herausgeber |
| Vertrauen | Höchstes (intern) | Hoch (verifiziert) |
| Code-Review | Intern | Extern (bei Bedarf) |

---

# Mögliche Zukünftige Implementierung

## Erweiterungen (Konzeptionell)

### 1. SignatureValidator

**Aufgabe:**
- Validiert digitale Signaturen
- Prüft Herausgeber-Zertifikate
- Verifiziert Integrität

**Abhängigkeiten:**
- Keine neuen npm-Pakete (Node.js crypto-API nutzen)

### 2. CertificateManager

**Aufgabe:**
- Verwaltet WebRadio Root CA
- Speichert verifizierte Herausgeber-Keys
- Ermöglicht Widerruf von Schlüsseln

**Speicherort:**
- `userData/certificates/`

### 3. VerificationService

**Aufgabe:**
- Zentraler Service für Verifizierungslogik
- Schnittstelle für UI (Badge-Anzeige)
- Logging von Verifizierungsfehlern

### 4. Erweiterte Manifest-Validierung

**Neue Felder (optional):**
```json
{
  "id": "youtube",
  "name": "YouTube",
  "type": "integration",
  "version": "1.0.0",
  "author": "WebRadio Team",
  "verified": true,
  "publisher": "WebRadio Team",
  "signature": "signature.json"
}
```

---

# UI-Konzept

## Plugin Manager

### Verified Integration

```
┌─────────────────────────────────────┐
│ ✓ Verified  YouTube Music           │
│             v1.0.0                  │
│                                     │
│ Publisher: WebRadio Team             │
│                                     │
│ [Toggle: ON]                        │
└─────────────────────────────────────┘
```

### Offizielle Integration

```
┌─────────────────────────────────────┐
│ ★ Official  Discord RPC             │
│             v1.0.0                  │
│                                     │
│ Publisher: WebRadio Team             │
│                                     │
│ [Toggle: ON]                        │
└─────────────────────────────────────┘
```

### Community Plugin

```
┌─────────────────────────────────────�│
│ ○ Community  Custom Theme           │
│             v0.5.0                  │
│                                     │
│ Publisher: @username                │
│                                     │
│ [Toggle: ON]                        │
└─────────────────────────────────────┘
```

## Badge-Design

**Verified Badge:**
- Icon: ✓ (Checkmark)
- Farbe: Grün (#10B981)
- Text: "Verified"

**Official Badge:**
- Icon: ★ (Star)
- Farbe: Blau (#3B82F6)
- Text: "Official"

**Community Badge:**
- Icon: ○ (Circle)
- Farbe: Grau (#6B7280)
- Text: "Community"

## Publisher-Informationen

**Anzeigeformat:**
```
Publisher: [Name]
```

**Beispiele:**
- "Publisher: WebRadio Team"
- "Publisher: Spotify"
- "Publisher: @username"

---

# Roadmap

## Phase 1: Vorbereitung (v1.2)

- [x] Plugin-System konsolidieren
- [x] Integration-System implementieren
- [ ] PluginAPI stabilisieren
- [ ] Dokumentation vervollständigen

## Phase 2: Marketplace (v2.0)

- [ ] Plugin Marketplace implementieren
- [ ] Plugin Repository aufsetzen
- [ ] Auto-Updates für Plugins
- [ ] Plugin-Search und -Discovery

## Phase 3: Verified Integrations (v2.1)

- [ ] SignatureValidator implementieren
- [ ] CertificateManager implementieren
- [ ] VerificationService implementieren
- [ ] Root CA aufsetzen
- [ ] Verifizierungsprozess definieren
- [ ] UI-Badges implementieren
- [ ] Herausgeber-Registrierung

## Phase 4: Partner-Integrationen (v2.2)

- [ ] Erste Partner-Integrationen (Spotify, etc.)
- [ ] Hardware-Integrationen (Razer, Logitech)
- [ ] Community-Projekte verifizieren

## Begründung der Reihenfolge

1. **v1.2**: Stabilisierung der Basis-Systeme (Plugin/Integration)
2. **v2.0**: Marketplace als Voraussetzung für Vertrieb
3. **v2.1**: Verified Integrations auf stabiler Basis
4. **v2.2**: Partner-Integrationen nach Verifizierungs-Infrastruktur

---

# Sicherheitsüberlegungen

## Angriffsszenarien

### 1. Manipulierte Integration

**Schutz:** Digitale Signatur verhindert Manipulation

### 2. Gefälschter Herausgeber

**Schutz:** Public Key gegen WebRadio Root CA verifizieren

### 3. Widerrufener Schlüssel

**Schutz:** CertificateManager verwaltet Widerrufsliste (CRL)

### 4. Man-in-the-Middle

**Schutz:** Signatur verifiziert Integrität nach Download

### 5. Social Engineering

**Schutz:** "Verified"-Badge signalisiert offizielle Verifizierung

## Kryptographie

**Verwendete Algorithmen (konzeptionell):**
- RSA-2048 oder RSA-4096 für Schlüssel
- SHA-256 für Hashing
- PKCS#1 v1.5 oder PSS für Signatur

**Keine externen Bibliotheken:**
- Node.js `crypto` API nutzen
- Keine zusätzlichen npm-Pakete

---

# Nicht-Ziele (Erinnerung)

Diese Architekturplanung führt NICHT zu:

- ❌ Erweiterung der PluginAPI
- ❌ Einführung einer IntegrationAPI
- ❌ Erhöhung von Berechtigungen
- ❌ Direktem Core-Zugriff
- ❌ Öffentlichen APIs zwischen Integrationen
- ❌ Breaking Changes

---

# Zusammenfassung

Verified Integrations sind eine zukünftige Erweiterung des WebRadio-Ökosystems, die:

- Vertrauenswürdigkeit durch digitale Signaturen herstellen
- Partner und Community-Projekte offiziell verifizieren
- Die PluginAPI als einzige Schnittstelle nutzen
- Keine neuen APIs oder Berechtigungen einführen
- Die bestehende Architektur respektieren

Die Implementierung ist für v2.1 geplant, nach der Einführung des Marketplaces in v2.0.
