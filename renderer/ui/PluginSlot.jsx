import React, { useEffect, useRef, useState } from 'react';
import { subscribe, slots } from './componentRegistry';

/**
 * Renders all vanilla DOM elements registered to a specific slot.
 */
export default function PluginSlot({ id }) {
  const containerRef = useRef(null);
  const [slotPlugins, setSlotPlugins] = useState(() => new Map(slots.get(id) || []));

  useEffect(() => {
    // Subscribe to registry changes
    const unsubscribe = subscribe(() => {
      setSlotPlugins(new Map(slots.get(id) || []));
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing children
    container.innerHTML = '';

    // Render registered DOM nodes
    slotPlugins.forEach((renderFn, pluginId) => {
      try {
        const node = renderFn();
        if (node instanceof Node) {
          const wrapper = document.createElement('div');
          wrapper.className = `plugin-slot-item plugin-${pluginId}`;
          wrapper.appendChild(node);
          container.appendChild(wrapper);
        } else if (typeof node === 'string') {
          const wrapper = document.createElement('div');
          wrapper.className = `plugin-slot-item plugin-${pluginId}`;
          wrapper.innerHTML = node;
          container.appendChild(wrapper);
        }
      } catch (err) {
        console.error(`Error rendering plugin slot ${id} for plugin ${pluginId}:`, err);
      }
    });

  }, [slotPlugins]);

  if (slotPlugins.size === 0) return null;

  return (
    <div className={`plugin-slot slot-${id}`} ref={containerRef}></div>
  );
}
