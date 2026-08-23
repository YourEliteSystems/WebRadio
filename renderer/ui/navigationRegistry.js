import { registerView } from './componentRegistry';

const listeners = new Set();

const sections = new Map();
const items = new Map();
const expandedState = new Map(); // sectionId -> boolean

function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (err) {
      console.error("[NavigationRegistry] Listener error:", err);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Registriert eine Navigations-Section im Renderer.
 * @param {Object} section - { id, label, icon, collapsible, expanded, order, visible }
 * @param {string|null} pluginId - Owner Plugin ID
 */
export function registerSection(section, pluginId = null) {
  if (!section?.id || !section?.label) {
    console.error("[NavigationRegistry] Invalid section:", section);
    return;
  }

  const existing = sections.get(section.id);
  if (existing && existing.ownerPluginId !== pluginId && existing.ownerPluginId !== 'core' && existing.ownerPluginId !== null) {
    console.warn(`[NavigationRegistry] Section '${section.id}' is already registered by '${existing.ownerPluginId}'`);
    return;
  }

  const entry = {
    id: section.id,
    label: section.label,
    icon: section.icon || null,
    collapsible: section.collapsible ?? true,
    expanded: section.expanded ?? true,
    order: typeof section.order === 'number' ? section.order : 100,
    visible: section.visible ?? true,
    ownerPluginId: pluginId
  };

  sections.set(section.id, entry);
  if (!expandedState.has(section.id)) {
    expandedState.set(section.id, entry.expanded);
  }

  notifyListeners();
  return entry;
}

/**
 * Registriert ein Navigations-Item im Renderer.
 * Kann mit oder ohne `parent` registriert werden.
 * Optional kann eine renderFn übergeben werden, die automatisch in componentRegistry als View registriert wird.
 * @param {Object} item - { id, parent, label, icon, route, order, visible, disabled, renderFn }
 * @param {string|null} pluginId - Owner Plugin ID
 */
export function registerItem(item, pluginId = null) {
  if (!item?.id || !item?.label) {
    console.error("[NavigationRegistry] Invalid item:", item);
    return;
  }

  const existing = items.get(item.id);
  if (existing && existing.ownerPluginId !== pluginId && existing.ownerPluginId !== 'core' && existing.ownerPluginId !== null) {
    console.warn(`[NavigationRegistry] Item '${item.id}' is already registered by '${existing.ownerPluginId}'`);
    return;
  }

  // Falls renderFn übergeben wurde, automatisch in componentRegistry als View registrieren
  if (typeof item.renderFn === 'function') {
    registerView(item.id, item.label, item.renderFn);
  }

  const entry = {
    id: item.id,
    parent: item.parent || null,
    label: item.label,
    icon: item.icon || null,
    route: item.route || item.id,
    order: typeof item.order === 'number' ? item.order : 100,
    visible: item.visible ?? true,
    disabled: item.disabled ?? false,
    ownerPluginId: pluginId
  };

  items.set(item.id, entry);
  notifyListeners();
  return entry;
}

/**
 * Aktualisiert ein bestehendes Item.
 */
export function updateItem(id, updates = {}, pluginId = null) {
  const item = items.get(id);
  if (!item) return;

  if (item.ownerPluginId !== pluginId && pluginId !== 'core' && pluginId !== null && item.ownerPluginId !== 'core' && item.ownerPluginId !== null) {
    console.warn(`[NavigationRegistry] Permission denied to update '${id}'`);
    return;
  }

  const updated = {
    ...item,
    ...updates,
    id: item.id,
    ownerPluginId: item.ownerPluginId
  };

  items.set(id, updated);
  notifyListeners();
  return updated;
}

/**
 * Entfernt ein Item.
 */
export function removeItem(id, pluginId = null) {
  const item = items.get(id);
  if (!item) return false;

  if (item.ownerPluginId !== pluginId && pluginId !== 'core' && pluginId !== null && item.ownerPluginId !== 'core' && item.ownerPluginId !== null) {
    console.warn(`[NavigationRegistry] Permission denied to remove '${id}'`);
    return false;
  }

  items.delete(id);
  notifyListeners();
  return true;
}

/**
 * Entfernt eine Section und alle darin enthaltenen Items.
 */
export function removeSection(id, pluginId = null) {
  const sec = sections.get(id);
  if (!sec) return false;

  if (sec.ownerPluginId !== pluginId && pluginId !== 'core' && pluginId !== null && sec.ownerPluginId !== 'core' && sec.ownerPluginId !== null) {
    console.warn(`[NavigationRegistry] Permission denied to remove section '${id}'`);
    return false;
  }

  for (const [itemId, item] of items) {
    if (item.parent === id) {
      items.delete(itemId);
    }
  }

  sections.delete(id);
  expandedState.delete(id);
  notifyListeners();
  return true;
}

/**
 * Schaltet den Aufklapp-Status einer Section um (Collapse/Expand).
 */
export function toggleSection(sectionId) {
  const current = isSectionExpanded(sectionId);
  expandedState.set(sectionId, !current);
  notifyListeners();
}

/**
 * Prüft, ob eine Section aufgerollt ist.
 */
export function isSectionExpanded(sectionId) {
  if (expandedState.has(sectionId)) {
    return expandedState.get(sectionId);
  }
  const sec = sections.get(sectionId);
  return sec ? (sec.expanded ?? true) : true;
}

/**
 * Entfernt alle Navigationseinträge eines Plugins bei Deaktivierung/Unload.
 */
export function unregisterPluginNavigation(pluginId) {
  let changed = false;

  for (const [id, item] of items) {
    if (item.ownerPluginId === pluginId) {
      items.delete(id);
      changed = true;
    }
  }

  for (const [id, sec] of sections) {
    if (sec.ownerPluginId === pluginId) {
      // Auch untergeordnete Items entfernen
      for (const [itemId, item] of items) {
        if (item.parent === id) {
          items.delete(itemId);
        }
      }
      sections.delete(id);
      expandedState.delete(id);
      changed = true;
    }
  }

  if (changed) {
    notifyListeners();
  }
}

/**
 * Liefert den sortierten Navigationsbaum mit Sections und Top-Level-Items.
 */
export function getNavigationTree() {
  const sectionsList = [...sections.values()]
    .filter(sec => sec.visible !== false)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  const allVisibleItems = [...items.values()]
    .filter(i => i.visible !== false)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  const topLevelItems = allVisibleItems.filter(item => !item.parent || item.parent === null);

  const sectionsWithItems = sectionsList.map(sec => ({
    ...sec,
    isExpanded: isSectionExpanded(sec.id),
    items: allVisibleItems.filter(item => item.parent === sec.id)
  }));

  return {
    sections: sectionsWithItems,
    topLevelItems: topLevelItems
  };
}

function processTreeData(tree) {
  if (!tree) return;

  if (Array.isArray(tree)) {
    tree.forEach(sec => {
      registerSection(sec, sec.ownerPluginId || null);
      if (Array.isArray(sec.items)) {
        sec.items.forEach(it => {
          registerItem(it, it.ownerPluginId || null);
        });
      }
    });
  } else if (typeof tree === 'object') {
    if (Array.isArray(tree.sections)) {
      tree.sections.forEach(sec => {
        registerSection(sec, sec.ownerPluginId || null);
        if (Array.isArray(sec.items)) {
          sec.items.forEach(it => {
            registerItem(it, it.ownerPluginId || null);
          });
        }
      });
    }
    if (Array.isArray(tree.topLevelItems)) {
      tree.topLevelItems.forEach(it => {
        registerItem(it, it.ownerPluginId || null);
      });
    }
  }
}

/**
 * Synchronisiert die Registry mit dem Main Process über IPC.
 */
export async function syncWithMain() {
  if (window.navigationAPI?.getTree) {
    try {
      const tree = await window.navigationAPI.getTree();
      processTreeData(tree);
    } catch (err) {
      console.warn("[NavigationRegistry] Error syncing with main process:", err);
    }
  }

  if (window.navigationAPI?.onUpdated) {
    window.navigationAPI.onUpdated(tree => {
      processTreeData(tree);
    });
  }
}
