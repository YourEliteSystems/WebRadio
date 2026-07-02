// Event listeners for when plugins register new UI
const listeners = new Set();

// Store for full page views
export const views = new Map();
// Store for smaller UI injections
export const slots = new Map();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Register a full page view for a plugin.
 * @param {string} id - Unique identifier (e.g. 'discordRPC')
 * @param {string} title - Human readable title for the Sidebar
 * @param {function} renderFn - Function that returns a DOM Node
 */
export function registerView(id, title, renderFn) {
  views.set(id, { title, renderFn });
  notifyListeners();
}

/**
 * Register a UI component into a specific slot.
 * @param {string} slotId - The slot name (e.g. 'sidebar-bottom')
 * @param {string} pluginId - Unique identifier of the plugin
 * @param {function} renderFn - Function that returns a DOM Node
 */
export function registerSlot(slotId, pluginId, renderFn) {
  if (!slots.has(slotId)) {
    slots.set(slotId, new Map());
  }
  slots.get(slotId).set(pluginId, renderFn);
  notifyListeners();
}

// Remove plugin UI when plugin is deactivated
export function unregisterPluginUI(pluginId) {
  views.delete(pluginId);
  slots.forEach(slot => {
    slot.delete(pluginId);
  });
  notifyListeners();
}