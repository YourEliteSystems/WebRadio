import { unregisterPluginUI, registerView, registerSlot, views } from '../ui/componentRegistry';
import {
  registerSection,
  registerItem,
  updateItem,
  removeItem,
  removeSection,
  toggleSection,
  isSectionExpanded,
  unregisterPluginNavigation,
  getNavigationTree,
  syncWithMain
} from '../ui/navigationRegistry';

const activePlugins = new Map();
const injectedScripts = new Map();
// Renderer-ID → Plugin-ID (Manifest). Wird beim Laden des Renderer-Skripts
// automatisch aus der Skript-URL abgeleitet; `hooks.pluginId` hat Vorrang.
const rendererOwners = new Map();

// Plugin-ID des Renderer-Skripts, das gerade ausgewertet wird. Modul-Skripte
// werden vor ihrem `load`-Event ausgewertet, deshalb lässt sich jede
// Registrierung eindeutig dem ladenden Plugin zuordnen.
let loadingPluginId = null;

// Wurde während der Auswertung des gerade ladenden Skripts tatsächlich ein
// Plugin registriert? Ein Skript kann syntaktisch fehlerfrei geladen werden und
// trotzdem vor/ohne Registrierung abbrechen – das wird damit unterscheidbar.
let registeredDuringLoad = false;

// Letzter CSP-Verstoß, der zum gerade ladenden Skript gehört. Chromium
// blockiert CSP-verweigerte Skripte bereits vor dem Netzwerkzugriff; der
// `error`-Event des Skript-Tags enthält dann keinerlei Grund. Dieser Merker
// macht den tatsächlichen Grund im Log sichtbar.
let lastCspViolation = null;

function handleSecurityPolicyViolation(event) {
  if (!loadingPluginId) return;
  const blocked = event.blockedURI || "";
  // Nur Verstöße erfassen, die zum aktuell ladenden Plugin gehören.
  if (blocked && !blocked.includes(`/plugins/${loadingPluginId}/`)) return;
  lastCspViolation = {
    directive: event.violatedDirective || event.effectiveDirective || "unbekannt",
    effectiveDirective: event.effectiveDirective || event.violatedDirective || "unbekannt",
    blockedURI: blocked || "unbekannt"
  };
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("securitypolicyviolation", handleSecurityPolicyViolation);
}

function markRegistered() {
  if (loadingPluginId) registeredDuringLoad = true;
}

function logError(context, message) {
  window.pluginAPI?.log("error", context, message);
}

function logInfo(context, message) {
  window.pluginAPI?.log("info", context, message);
}

/**
 * Erzeugt den Kontext, den ein Renderer-Plugin in `init()` erhält.
 * Navigationseinträge (und über `renderFn` automatisch deren Ansicht)
 * gehören dem Plugin, das das Renderer-Skript registriert hat.
 */
function createRendererContext(rendererId, ownerId) {
  return {
    id: rendererId,
    pluginId: ownerId,
    navigation: {
      registerSection: (sec) => registerSection(sec, ownerId),
      registerItem: (it) => registerItem(it, ownerId),
      updateItem: (itemId, updates) => updateItem(itemId, updates, ownerId),
      removeItem: (itemId) => removeItem(itemId, ownerId),
      removeSection: (secId) => removeSection(secId, ownerId)
    }
  };
}

/**
 * Ermittelt die Besitzer-ID (Plugin-ID) für ein Renderer-Skript.
 */
function resolveOwnerId(rendererId, hooks = {}) {
  if (hooks && typeof hooks.pluginId === "string" && hooks.pluginId) {
    return hooks.pluginId;
  }
  return rendererOwners.get(rendererId) || rendererId;
}

/**
 * Liefert alle Renderer-IDs, die zu einem Plugin (Manifest-ID) gehören.
 */
function rendererIdsForPlugin(pluginId) {
  const result = new Set();
  if (activePlugins.has(pluginId)) {
    result.add(pluginId);
  }
  for (const [rendererId, owner] of rendererOwners) {
    if (owner === pluginId) result.add(rendererId);
  }
  for (const [rendererId, hooks] of activePlugins) {
    if (hooks && hooks.pluginId === pluginId) result.add(rendererId);
  }
  return result;
}

/**
 * Prüft nach dem Laden eines Renderer-Skripts, ob alle vom Plugin
 * registrierten Navigationseinträge eine Ansicht besitzen.
 *
 * Damit wird der Fehler "Keine Ansicht für <id> registriert" sofort und
 * verständlich protokolliert statt erst beim Öffnen des Menüpunkts.
 */
function verifyPluginViews(pluginId) {
  if (!pluginId) return;

  const tree = getNavigationTree();
  const items = [
    ...(tree.topLevelItems || []),
    ...(tree.sections || []).flatMap((section) => section.items || [])
  ];

  const owned = new Set(rendererIdsForPlugin(pluginId));
  const missing = items
    .filter((item) => owned.has(item.ownerPluginId))
    .map((item) => ({ item, viewId: item.route || item.id }))
    .filter(({ viewId }) => !views.has(viewId));

  if (missing.length === 0) return;

  logError(
    "RendererPluginManager",
    `Plugin ${pluginId}: Navigationseintrag ohne registrierte Ansicht: ` +
    `${missing.map(({ item, viewId }) => `"${item.label}" (${viewId})`).join(", ")}. ` +
    `Das Renderer-Skript muss die Ansicht unter derselben ID registrieren ` +
    `(z.B. window.uiRegistry.registerView("${missing[0].viewId}", …) oder ` +
    `context.navigation.registerItem({ id: "${missing[0].viewId}", renderFn })).`
  );
}

/**
 * Räumt ein Plugin vollständig auf (Deaktivierung/Entfernung).
 */
function teardownPlugin(pluginId) {
  const rendererIds = rendererIdsForPlugin(pluginId);

  for (const rendererId of rendererIds) {
    const hooks = activePlugins.get(rendererId);
    if (hooks && typeof hooks.destroy === "function") {
      try {
        hooks.destroy();
      } catch (err) {
        logError("RendererPluginManager", `Plugin ${rendererId} destroy error: ${err.message}`);
      }
    }
    if (hooks && typeof hooks.deactivate === "function") {
      try {
        hooks.deactivate({ pluginId: rendererId });
      } catch (err) {
        logError("RendererPluginManager", `Plugin ${rendererId} deactivation error: ${err.message}`);
      }
    }
    activePlugins.delete(rendererId);
    rendererOwners.delete(rendererId);
  }

  // Views/Navigation sowohl für die Plugin-ID als auch für die
  // Renderer-IDs freigeben (IDs können je nach Plugin abweichen).
  for (const idToClear of new Set([pluginId, ...rendererIds])) {
    unregisterPluginUI(idToClear);
    unregisterPluginNavigation(idToClear);
  }

  const scriptTag = injectedScripts.get(pluginId);
  if (scriptTag) {
    scriptTag.remove();
    injectedScripts.delete(pluginId);
  }
}

window.uiRegistry = {
  registerView,
  registerSlot,
  navigation: {
    registerSection: (sec, pluginId) => registerSection(sec, pluginId),
    registerItem: (it, pluginId) => registerItem(it, pluginId),
    updateItem: (id, updates, pluginId) => updateItem(id, updates, pluginId),
    removeItem: (id, pluginId) => removeItem(id, pluginId),
    removeSection: (id, pluginId) => removeSection(id, pluginId),
    toggleSection,
    isSectionExpanded,
    getTree: getNavigationTree
  }
};

window.registerPluginRenderer = (id, hooks = {}) => {
  if (!id) {
    logError("RendererPluginManager", "Plugin registration failed: Missing 'id'");
    return;
  }

  markRegistered();

  // Automatische Zuordnung Renderer-ID → Plugin-ID (aus der Skript-URL).
  if (loadingPluginId && !rendererOwners.has(id)) {
    rendererOwners.set(id, loadingPluginId);
  }

  activePlugins.set(id, hooks);

  if (hooks.init) {
    try {
       hooks.init(createRendererContext(id, resolveOwnerId(id, hooks)));
    } catch (err) {
       logError("RendererPluginManager", `Plugin ${id} init error: ${err.message}`);
    }
  }
};

window.registerPlugin = (plugin) => {
  if(!plugin?.id){
    logError("RendererPluginManager", "Plugin registration failed: Missing 'id'");
    return;
  }

  markRegistered();

  // Automatische Zuordnung Renderer-ID → Plugin-ID (aus der Skript-URL).
  if (loadingPluginId && !rendererOwners.has(plugin.id)) {
    rendererOwners.set(plugin.id, loadingPluginId);
  }

  activePlugins.set(plugin.id, plugin);

  if(typeof plugin.activate === "function"){
    try {
      plugin.activate(createRendererContext(plugin.id, resolveOwnerId(plugin.id, plugin)));
    } catch (err) {
      logError("RendererPluginManager", `Plugin ${plugin.id} activation error: ${err.message}`);
    }
  }
};

async function loadRendererScripts(scripts, explicitId = null) {
  // Sequentiell laden: so ist die Zuordnung Renderer-ID → Plugin-ID
  // eindeutig und die Registrierungsreihenfolge deterministisch.
  for (const scriptUrl of scripts) {
    await injectScript(scriptUrl, explicitId);
  }
}

async function loadRendererPlugins() {
  // Navigation mit Main-Prozess synchronisieren
  await syncWithMain();

  if (window.api && window.api.getRendererScripts) {
    try {
      const scripts = await window.api.getRendererScripts();
      await loadRendererScripts(scripts);
    } catch (err) {
      logError("RendererPluginManager", `Error fetching renderer scripts: ${err.message}`);
    }
  }

  // Listen to live toggles
  if (window.pluginAPI && window.pluginAPI.onPluginToggled) {
    window.pluginAPI.onPluginToggled(async (data) => {
      const { id, enabled } = data;
      if (!enabled) {
        // Destroy and remove
        teardownPlugin(id);
      } else {
        // Fetch new scripts and inject if not already present
        if (window.api && window.api.getRendererScripts) {
          const scripts = await window.api.getRendererScripts();
          for (const scriptUrl of scripts) {
            const match = scriptUrl.match(/\/plugins\/([^/]+)\//);
            const scriptId = match ? match[1] : null;
            if (scriptId === id && !injectedScripts.has(id)) {
              await injectScript(scriptUrl, id);
            }
          }
        }
      }
    });
  }

  // Globaler Rescan: entferne Renderer-Scripte weggefallener Plugins
  // und lade neue/geänderte Scripts nach.
  if (window.api && window.api.onPluginsChanged) {
    window.api.onPluginsChanged(async (result) => {
      const removed = (result?.removed || []).concat(result?.disabled || []);
      removed.forEach(id => teardownPlugin(id));

      const toReload = (result?.added || []).concat(result?.changed || []);
      if (toReload.length > 0 && window.api.getRendererScripts) {
        try {
          const scripts = await window.api.getRendererScripts();
          await loadRendererScripts(scripts);
        } catch (err) {
          logError("RendererPluginManager",
            `Error reloading renderer scripts: ${err.message}`);
        }
      }
    });
  }
}

function injectScript(scriptUrl, explicitId = null) {
  const match = scriptUrl.match(/\/plugins\/([^/]+)\//);
  const pluginId = explicitId || (match ? match[1] : null);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.type = "module";
    // Modul-Skripte werden immer im CORS-Modus geladen; explizit gesetzt,
    // damit der lokale Plugin-HTTP-Server die Anfrage korrekt beantwortet.
    script.crossOrigin = "anonymous";
    script.src = `${scriptUrl}?t=${Date.now()}`;

    lastCspViolation = null;
    registeredDuringLoad = false;

    const finish = (ok) => {
      if (loadingPluginId === pluginId) loadingPluginId = null;
      resolve(ok);
    };

    // Fehlgeschlagene Skripte werden vollständig entfernt. Sonst würde der
    // Eintrag in `injectedScripts` einen späteren erneuten Startversuch
    // dauerhaft verhindern (z. B. nach Aktivierung über die Einstellungen).
    const discardFailedScript = () => {
      if (pluginId && injectedScripts.get(pluginId) === script) {
        injectedScripts.delete(pluginId);
      }
      script.remove();
    };

    script.onload = () => {
      logInfo("RendererPluginManager", `Loaded renderer script: ${scriptUrl}`);

      // Unterscheidet "HTTP/Modul erfolgreich geladen" von
      // "Plugin tatsächlich registriert" – ein Skript kann vor der
      // Registrierung mit einer Exception abbrechen.
      if (loadingPluginId === pluginId && !registeredDuringLoad) {
        logError(
          "RendererPluginManager",
          `Renderer-Skript geladen, hat aber kein Plugin registriert: ${scriptUrl}. ` +
          `Erwartet wird window.registerPlugin({ id: "${pluginId}", … }) oder ` +
          `window.registerPluginRenderer("${pluginId}", …) während der Auswertung ` +
          `des Skripts (nicht erst später).`
        );
      }

      verifyPluginViews(pluginId);
      finish(true);
    };

    script.onerror = (event) => {
      const details = (event && (event.message || event.type)) || "unbekannter Fehler";

      const cspHint = lastCspViolation
        ? ` CSP hat das Laden blockiert (Richtlinie "${lastCspViolation.effectiveDirective}", ` +
          `blockiert: ${lastCspViolation.blockedURI}). Der PluginHttpServer wurde dabei nicht ` +
          `kontaktiert; die Content-Security-Policy in renderer/index.html muss die ` +
          `Loopback-Adresse des Plugin-HTTP-Servers erlauben (script-src http://127.0.0.1:*).`
        : ` Kein CSP-Verstoß registriert – der Fehler liegt damit bei Netzwerk/Origin ` +
          `(CORS) oder bei der Auswertung des Moduls selbst; Details siehe Log-Ausgabe ` +
          `des PluginHttpServer.`;

      logError(
        "RendererPluginManager",
        `Failed to load renderer script: ${scriptUrl} (${details}). ` +
        `Plugin ${pluginId || "unbekannt"} wurde nicht registriert.${cspHint}`
      );

      discardFailedScript();
      finish(false);
    };

    if (pluginId) {
      injectedScripts.set(pluginId, script);
    }

    loadingPluginId = pluginId;
    document.body.appendChild(script);
  });
}

export { loadRendererPlugins };
