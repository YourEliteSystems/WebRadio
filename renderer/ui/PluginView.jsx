import React, { useEffect, useRef } from 'react';
import { views } from './componentRegistry';

/**
 * Renders a full-page view based on the current active view ID.
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
        console.error(`Error rendering view ${viewId}:`, err);
        container.innerHTML = `<div class="error" style="color: #ef4444; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">Fehler beim Rendern der Ansicht: ${err.message}</div>`;
      }
    } else {
      container.innerHTML = `
        <div style="padding: 24px;">
          <h2 style="color: #fff; margin-bottom: 8px;">${viewId}</h2>
          <div class="error" style="color: var(--text-muted, #9ca3af); font-size: 13px;">Keine Ansicht für '${viewId}' registriert.</div>
        </div>
      `;
    }

  }, [viewId]);

  return (
    <div className={`plugin-view-container plugin-${viewId}`} style={{ padding: '0', height: '100%', overflowY: 'auto' }} ref={containerRef}></div>
  );
}
