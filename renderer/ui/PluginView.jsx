import React, { useEffect, useRef } from 'react';
import { views } from './componentRegistry';

/**
 * Renders a full-page plugin view based on the current active view ID.
 */
export default function PluginView({ viewId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing children
    container.innerHTML = '';

    const view = views.get(viewId);
    if (view && view.renderFn) {
      try {
        const node = view.renderFn();
        if (node instanceof Node) {
          container.appendChild(node);
        } else if (typeof node === 'string') {
          container.innerHTML = node;
        }
      } catch (err) {
        console.error(`Error rendering plugin view ${viewId}:`, err);
        container.innerHTML = `<div class="error">Error rendering plugin view: ${err.message}</div>`;
      }
    } else {
      container.innerHTML = `<div class="error">Plugin view '${viewId}' not found.</div>`;
    }

  }, [viewId]);

  return (
    <div className={`plugin-view-container plugin-${viewId}`} style={{ padding: '20px', height: '100%', overflowY: 'auto' }} ref={containerRef}></div>
  );
}
