# Erweiterbare Package-Architektur – Implementierungsplan

## Ziel

Jede neue Funktion (Theme, Plugin, Extension) soll installierbar, aktualisierbar und
entfernbar sein — sowohl lokal als auch über einen zukünftigen Store — **ohne Änderungen
am Core**. Der Core kennt nur einen einzigen Vertragstyp: das `Package`.

---

## User Review Required

> [!IMPORTANT]
> Dieser Plan legt die Grundarchitektur für alle zukünftigen Erweiterungen fest.
> Bitte die offenen Fragen am Ende prüfen bevor die Implementierung startet.

> [!WARNING]
> Der Plan beinhaltet eine **Migration bestehender Themes und Plugins** auf das neue
> einheitliche Manifest-Format. Bestehende `theme.json` und `plugin.json` müssen
> erweitert werden. Das ist rückwärtskompatibel gestaltbar, aber erfordert Entscheidung.

---

## Kernidee: Alles ist ein Package

```
                  ┌─────────────────────────────────┐
                  │           PackageManager         │
                  │  (kennt keine Typen, nur Verträge)│
                  └──────────┬──────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        PackageSource  PackageRegistry  PackageInstaller
        (Interface)    (Datenbank)      (install/update/remove)
              │
    ┌─────────┴──────────┐
    ▼                    ▼
LocalSource          StoreSource          ← gleiche Schnittstelle
(Dateisystem)        (HTTP/zukünftig)     ← Core weiß nichts davon
```

---

## Unified Package Manifest

Beide bestehenden Formate werden in ein **universelles Manifest** überführt:

```json
{
  "id": "discord-rpc",
  "type": "plugin",
  "name": "Discord Rich Presence",
  "version": "1.2.0",
  "author": "WebRadio",
  "description": "Zeigt aktuellen Radiosong in Discord",
  "minAppVersion": "1.0.0",
  "permissions": ["events", "network"],
  "main": "plugin.js",
  "renderer": "renderer.js",
  "css": null,
  "preview": "preview.png",
  "changelog": "CHANGELOG.md"
}
```

```json
{
  "id": "neon-theme",
  "type": "theme",
  "name": "Neon Dark",
  "version": "2.0.0",
  "author": "WebRadio",
  "description": "Neon-Optik für Nachtschwärmer",
  "minAppVersion": "1.0.0",
  "permissions": [],
  "css": "variables.css",
  "preview": "preview.png",
  "changelog": "CHANGELOG.md"
}
```

**Pflichtfelder:** `id`, `type`, `name`, `version`  
**Dateiname:** immer `package.json` (ersetzt `theme.json` und `plugin.json`)

---

## Verzeichnisstruktur nach Migration

```
userData/
├── packages/               ← neues einheitliches Verzeichnis
│   ├── registry.json       ← installierte Packages + Metadaten
│   ├── themes/
│   │   ├── default/
│   │   │   ├── package.json
│   │   │   └── variables.css
│   │   └── neon/
│   │       ├── package.json
│   │       └── variables.css
│   └── plugins/
│       ├── discord-rpc/
│       │   ├── package.json
│       │   ├── plugin.js
│       │   └── renderer.js
│       └── logger/
│           ├── package.json
│           └── logger.js
│
└── package-data/           ← Plugin-eigene Datenspeicher (bisher: plugins/*.json)
    └── discord-rpc.json
```

---

## Proposed Changes

### Core — Package-Infrastruktur

---

#### [NEW] `electron/core/packages/PackageManifest.js`

Typdefinition + Schema-Konstanten für das unified Manifest.

```js
const PACKAGE_TYPES = Object.freeze({
  PLUGIN: 'plugin',
  THEME:  'theme',
  // zukünftig: EXTENSION: 'extension', PRESET: 'preset'
});

const REQUIRED_FIELDS = ['id', 'type', 'name', 'version'];
```

---

#### [NEW] `electron/core/packages/PackageValidator.js`

Einheitlicher Validator für alle Package-Typen. **Ersetzt** `ThemeValidator` und `PluginValidator`.

```js
class PackageValidator {
  validate(manifest) {
    const errors = [];
    // Pflichtfelder prüfen
    for (const field of REQUIRED_FIELDS) {
      if (!manifest[field]) errors.push(`Missing: ${field}`);
    }
    // Typ-spezifische Regeln
    if (manifest.type === 'plugin' && !manifest.main) {
      errors.push('Plugin requires: main');
    }
    if (manifest.type === 'theme' && !manifest.css) {
      errors.push('Theme requires: css');
    }
    // Version-Format prüfen
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('version must be semver (x.y.z)');
    }
    return { valid: errors.length === 0, errors };
  }
}
```

---

#### [NEW] `electron/core/packages/PackageLoader.js`

Scannt das `packages/`-Verzeichnis, liest Manifeste, ruft Validator auf.  
**Ersetzt** `ThemeLoader` und den Filesystem-Scan in `pluginManager.js`.

```js
class PackageLoader {
  constructor(packagesDir) {
    this.packagesDir = packagesDir;
    this.validator = new PackageValidator();
  }

  // Alle installierten Packages eines Typs laden
  loadByType(type) { ... }

  // Ein einzelnes Package laden
  loadOne(packageDir) {
    const manifest = this._readManifest(packageDir);
    const result = this.validator.validate(manifest);
    if (!result.valid) {
      console.warn(`[PackageLoader] ${packageDir}:`, result.errors);
      return null;
    }
    return { manifest, path: packageDir };
  }

  _readManifest(dir) {
    // Liest package.json, mit Fallback auf theme.json/plugin.json (Migration)
  }
}
```

---

#### [NEW] `electron/core/packages/PackageRegistry.js`

Persistente Datenbank aller installierten Packages. Einzige Wahrheitsquelle.

```js
// registry.json Format:
{
  "version": 1,
  "packages": {
    "discord-rpc": {
      "id": "discord-rpc",
      "type": "plugin",
      "version": "1.0.0",
      "installedAt": 1719400000000,
      "updatedAt": 1719400000000,
      "source": "local",          // oder: "store"
      "enabled": true,
      "path": "plugins/discord-rpc"
    },
    "neon-theme": { ... }
  }
}
```

```js
class PackageRegistry {
  register(manifest, source)   // Package als installiert markieren
  unregister(id)               // Package entfernen
  setEnabled(id, enabled)      // Plugin an/aus
  getAll()                     // alle Packages
  getByType(type)              // nach Typ filtern
  isInstalled(id)              // Existenzprüfung
  getEntry(id)                 // einzelner Eintrag
}
```

---

#### [NEW] `electron/core/packages/PackageInstaller.js`

Führt install/update/uninstall durch. Schreibt ins Dateisystem und aktualisiert Registry.  
**Nimmt ein `PackageSource`-Objekt entgegen** — kennt die Quelle nicht direkt.

```js
class PackageInstaller {
  constructor(packagesDir, registry) {
    this.packagesDir = packagesDir;
    this.registry = registry;
  }

  // source: PackageSource-Interface (Local oder Store)
  async install(packageId, source) {
    const pkg = await source.fetch(packageId);
    const destPath = this._getDestPath(pkg.manifest);
    await source.copyTo(pkg, destPath);
    this.registry.register(pkg.manifest, source.name);
    return pkg.manifest;
  }

  async update(packageId, source) {
    await this.uninstall(packageId);  // altes entfernen
    return this.install(packageId, source);
  }

  async uninstall(packageId) {
    const entry = this.registry.getEntry(packageId);
    if (!entry) return false;
    fs.rmSync(path.join(this.packagesDir, entry.path), { recursive: true });
    this.registry.unregister(packageId);
    return true;
  }
}
```

---

#### [NEW] `electron/core/packages/sources/LocalSource.js`

Installationsquelle: **lokales Verzeichnis oder .zip-Datei**.  
Implementiert das `PackageSource`-Interface.

```js
class LocalSource {
  name = 'local';

  // Liest ein Package aus einem lokalen Pfad (entpackt oder Verzeichnis)
  async fetch(localPath) {
    // unterstützt: Ordner, .zip, .tar.gz
    const manifest = await this._readManifest(localPath);
    return { manifest, sourcePath: localPath };
  }

  async copyTo(pkg, destPath) {
    fse.copySync(pkg.sourcePath, destPath);
  }
}
```

---

#### [NEW] `electron/core/packages/sources/StoreSource.js`

**Platzhalter** für zukünftigen Store. Implementiert dasselbe Interface wie `LocalSource`.  
Core muss **nicht geändert** werden wenn Store fertig ist.

```js
class StoreSource {
  name = 'store';

  async fetch(packageId) {
    // Holt Manifest vom Store-API (noch nicht implementiert)
    const response = await net.fetch(`${STORE_API}/packages/${packageId}`);
    return response.json();
  }

  async copyTo(pkg, destPath) {
    // Lädt .zip herunter, prüft SHA-256, entpackt nach destPath
    // (gleiche Logik wie UpdateDownloader — wiederverwendbar!)
  }
}
```

---

#### [NEW] `electron/core/packages/PackageManager.js`

Zentrale Koordination. **Das ist die einzige Klasse die der Rest des Cores kennt.**  
Kein anderes Modul kennt `PackageInstaller`, `PackageRegistry` oder eine `Source` direkt.

```js
class PackageManager {
  constructor(packagesDir) {
    this.registry  = new PackageRegistry(packagesDir);
    this.loader    = new PackageLoader(packagesDir);
    this.installer = new PackageInstaller(packagesDir, this.registry);
    this.sources   = new Map([
      ['local', new LocalSource()],
      ['store', new StoreSource()]   // inaktiv bis Store implementiert
    ]);
  }

  // Lifecycle
  async installFrom(localPathOrZip)       // Lokal installieren
  async installFromStore(packageId)       // Store (zukünftig)
  async update(packageId)                 // Update (quelle aus registry)
  async uninstall(packageId)              // Entfernen + Lifecycle destroy()

  // Abfragen
  getInstalled(type?)                     // alle oder nach Typ
  isInstalled(id)

  // Aktivierung (für Plugins)
  enable(id)
  disable(id)
}
```

---

### Type-spezifische Handler (unveränderte Schicht)

Type-Handler kennen den `PackageManager`, aber der `PackageManager` kennt sie **nicht**.

---

#### [MODIFY] `electron/core/themes/ThemeManager.js`

Erhält statt eigenem Loader einen `PackageManager`-Aufruf:

```js
class ThemeManager {
  constructor(packageManager) {
    this.pm = packageManager;
  }

  getThemes() {
    return this.pm.getInstalled('theme');
  }

  getActiveTheme() { ... }   // unverändert: aus storage
  setActiveTheme(id) { ... } // unverändert: in storage + EventBus
}
```

---

#### [MODIFY] `electron/core/plugins/PluginManager.js` (Core)

```js
class PluginManager {
  constructor(packageManager, runtime) {
    this.pm      = packageManager;
    this.runtime = runtime;  // PluginRuntime (unverändert)
  }

  loadAll() {
    const plugins = this.pm.getInstalled('plugin');
    for (const p of plugins) {
      if (this.pm.registry.getEntry(p.manifest.id)?.enabled !== false) {
        this.runtime.start(p);
      }
    }
  }

  enable(id)  { this.pm.enable(id);  this.runtime.start(...); }
  disable(id) { this.pm.disable(id); this.runtime.stop(...);  }
}
```

---

### IPC-Erweiterung

---

#### [NEW] `electron/core/ipc/packageHandlers.js`

Neue IPC-Kanäle für Package-Lifecycle. Alle bestehenden Handler bleiben unverändert.

```js
function registerPackageHandlers(windowManager, packageManager) {

  // Installierte Packages abfragen
  ipcMain.handle('packages:getInstalled', (_, type) =>
    packageManager.getInstalled(type)
  );

  // Lokale Installation (Drag & Drop / Dateidialog)
  ipcMain.handle('packages:installLocal', async (_, localPath) => {
    return packageManager.installFrom(localPath);
  });

  // Update
  ipcMain.handle('packages:update', async (_, id) =>
    packageManager.update(id)
  );

  // Entfernen
  ipcMain.handle('packages:uninstall', async (_, id) =>
    packageManager.uninstall(id)
  );

  // Store: Verfügbare Packages suchen (zukünftig)
  ipcMain.handle('packages:storeSearch', async (_, query) => {
    // gibt [] zurück bis Store implementiert ist
    return [];
  });
}
```

---

#### [MODIFY] `electron/core/ipc/registerIpcHandlers.js`

Nur eine Zeile hinzufügen:

```js
function registerAllIpc(windowManager, packageManager) {
  // ... bestehende Handler unverändert
  registerPackageHandlers(windowManager, packageManager);  // NEU
}
```

---

#### [MODIFY] `electron/preload.js`

Neue `packageAPI`-Gruppe hinzufügen, bestehende APIs unverändert lassen:

```js
contextBridge.exposeInMainWorld('packageAPI', {
  getInstalled:   (type)  => ipcRenderer.invoke('packages:getInstalled', type),
  installLocal:   (path)  => ipcRenderer.invoke('packages:installLocal', path),
  update:         (id)    => ipcRenderer.invoke('packages:update', id),
  uninstall:      (id)    => ipcRenderer.invoke('packages:uninstall', id),
  storeSearch:    (query) => ipcRenderer.invoke('packages:storeSearch', query),
  onPackageChanged: (cb)  => ipcRenderer.on('package:changed', (_, d) => cb(d))
});
```

---

### Migration bestehender Packages

---

#### [MODIFY] `electron/core/packages/PackageLoader.js` — Fallback-Lesestrategie

Der Loader liest `package.json`, fällt aber auf alte Formate zurück:

```js
_readManifest(dir) {
  // 1. Neues Format
  const newPath = path.join(dir, 'package.json');
  if (fs.existsSync(newPath)) return JSON.parse(fs.readFileSync(newPath));

  // 2. Legacy Themes
  const themeJson = path.join(dir, 'theme.json');
  if (fs.existsSync(themeJson)) {
    const t = JSON.parse(fs.readFileSync(themeJson));
    return { ...t, id: path.basename(dir), type: 'theme' };
  }

  // 3. Legacy Plugins
  const pluginJson = path.join(dir, 'plugin.json');
  if (fs.existsSync(pluginJson)) {
    const p = JSON.parse(fs.readFileSync(pluginJson));
    return { ...p, type: 'plugin' };
  }

  throw new Error(`No manifest found in: ${dir}`);
}
```

→ **Keine bestehenden theme.json/plugin.json Dateien müssen sofort geändert werden.**

---

#### [MODIFY] `electron/core/depackUserdata.js`

Verzeichnisse auf neue Struktur erweitern:

```js
function setupUserDirs() {
  // bestehende Dirs bleiben (Abwärtskompatibilität)
  dirs.packages       = path.join(userDataPath, 'packages');
  dirs.packageThemes  = path.join(userDataPath, 'packages', 'themes');
  dirs.packagePlugins = path.join(userDataPath, 'packages', 'plugins');
  dirs.packageData    = path.join(userDataPath, 'package-data');
  // ...
}
```

---

### Renderer — Package-UI (optional, Phase 2)

---

#### [NEW] `renderer/components/PackageManager.jsx`

Einheitliche UI für Themes und Plugins — kein separater Theme-Selector mehr im PlayerBar.
Zeigt installierte Packages, ermöglicht lokale Installation per Drag & Drop.

```
┌─────────────────────────────────────┐
│  Packages            [+ Installieren]│
├──────┬──────────────────────────────┤
│ Alle │ Themes │ Plugins │ Store (?) │
├──────┴──────────────────────────────┤
│ 🎨 Neon Dark       v2.0  [Aktiv] [×]│
│ 🎨 Default         v1.0        [×] │
│ 🔌 Discord RPC     v1.0  [An]   [×]│
└─────────────────────────────────────┘
```

---

## Verifikationsplan

### Automatisch

- [ ] `PackageValidator.validate()` mit korrekten und fehlerhaften Manifesten
- [ ] `PackageRegistry` read/write/update Roundtrip
- [ ] `PackageLoader._readManifest()` mit legacy `theme.json` → korrekt gemappt
- [ ] `LocalSource.fetch()` mit Verzeichnis und (später) .zip
- [ ] `PackageManager.installFrom()` → Datei landet in `packages/themes/` bzw. `packages/plugins/`
- [ ] Bestehende Themes werden nach Migration noch geladen

### Manuell

- [ ] Theme per Drag & Drop auf das Einstellungsfenster installieren
- [ ] Plugin deaktivieren → `destroy()` wird aufgerufen
- [ ] App neu starten → Registry-Zustand ist persistent
- [ ] Store-API gibt leere Liste zurück (kein Absturz)

---

## Open Questions

> [!IMPORTANT]
> **Frage 1: Manifest-Dateiname**  
> Soll der neue unified Dateiname `package.json` heißen (konsistent mit npm-Konvention)
> oder besser `webradio-package.json` / `manifest.json` um Konflikte mit npm zu vermeiden?
> Das Plugin `discordRPC` hat bereits eine eigene `package.json` mit npm-Abhängigkeiten.

> [!IMPORTANT]
> **Frage 2: ZIP-Installation in Phase 1?**  
> Soll die lokale Installation in Phase 1 nur Ordner-basiert (Benutzer entpackt manuell)
> oder auch `.zip`-basiert (App entpackt selbst) sein?  
> ZIP erfordert zusätzliche Abhängigkeit (z.B. `adm-zip`) oder Node.js `zlib`.

> [!IMPORTANT]
> **Frage 3: Legacy-Migration sofort oder parallel?**  
> Option A: Legacy-Pfade (`themes/`, `plugins/`) weiterhin lesen, zusätzlich `packages/` — **kein Breaking Change**  
> Option B: Sofortige Migration, alte Pfade nicht mehr lesen — **sauberer, aber Breaking Change für bestehende Nutzer**  
> Empfehlung: **Option A** (Fallback-Loader für 1-2 Releases, dann deprecaten)

> [!IMPORTANT]
> **Frage 4: Store-Authentifizierung jetzt oder später?**  
> Soll `StoreSource` bereits ein Auth-Token-Konzept (für kostenpflichtige Packages)
> beinhalten oder komplett leer bleiben als reiner Interface-Platzhalter?

> [!CAUTION]
> **Frage 5: Plugin-eigene npm-Dependencies**  
> Das discordRPC-Plugin hat eigene `node_modules`. Bei ZIP-Installation müsste
> `npm install` im Plugin-Verzeichnis ausgeführt werden — sicherheitskritisch.  
> Soll das unterstützt werden oder sollen Plugins keine externen Dependencies haben?

---

## Implementierungsreihenfolge (wenn genehmigt)

```
Phase 1 — Core-Infrastruktur (kein Breaking Change)
  1. PackageManifest.js      ← Konstanten + Typen
  2. PackageValidator.js     ← unified (ersetzt Theme/PluginValidator)
  3. PackageRegistry.js      ← persistence layer
  4. PackageLoader.js        ← mit Legacy-Fallback
  5. PackageInstaller.js     ← local install/uninstall
  6. sources/LocalSource.js  ← lokales Dateisystem
  7. sources/StoreSource.js  ← leerer Platzhalter
  8. PackageManager.js       ← Koordination

Phase 2 — Integration in bestehende Manager
  9. ThemeManager.js         ← nutzt PackageManager
  10. PluginManager.js       ← nutzt PackageManager (Legacy ablösen!)
  11. packageHandlers.js     ← neuer IPC-Handler
  12. registerIpcHandlers.js ← packageHandlers registrieren
  13. preload.js             ← packageAPI hinzufügen
  14. depackUserdata.js      ← neue Verzeichnisse

Phase 3 — Renderer
  15. PackageManager.jsx     ← einheitliche Package-UI
  16. PlayerBar Cleanup      ← ThemeSelector aus PlayerBar entfernen
```
