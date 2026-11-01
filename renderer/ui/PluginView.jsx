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
        const errBox = document.createElement('div');
        errBox.className = 'error';
        errBox.style.cssText = 'color: #ef4444; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;';
        errBox.textContent = `Fehler beim Rendern der Ansicht: ${err?.message || err}`;
        container.appendChild(errBox);
      }
    } else {
      const wrapper = document.createElement('div');
      wrapper.style.padding = '24px';

      const title = document.createElement('h2');
      title.style.cssText = 'color: #fff; margin-bottom: 8px;';
      title.textContent = viewId || '';

      const desc = document.createElement('div');
      desc.className = 'error';
      desc.style.cssText = 'color: var(--text-muted, #9ca3af); font-size: 13px;';
      desc.textContent = `Keine Ansicht für '${viewId}' registriert.`;

      wrapper.appendChild(title);
      wrapper.appendChild(desc);
      container.appendChild(wrapper);
    }

  }, [viewId]);

  const safeViewClass = String(viewId || '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return (
    <div className={`plugin-view-container plugin-${safeViewClass}`} style={{ padding: '0', height: '100%', overflowY: 'auto' }} ref={containerRef}></div>
  );
}
