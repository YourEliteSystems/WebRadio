import React from 'react';
import InlineSvg from './InlineSvg.jsx';
import { resolveNavIcon } from '../ui/iconLibrary.js';

/**
 * NavIcon
 *
 * Löst den Icon-Wert eines Navigationseintrags zu einem rendbaren SVG auf.
 *
 * why: Navigationseinträge des Core und von Plugins referenzieren ihr Symbol
 * nur über einen Namen (`icon: "radio"`, `icon: "media"`). Gibt React diesen
 * Namen als JSX-Kind aus, steht in der Sidebar das nackte Wort statt eines
 * Symbols; liefert ein Plugin dagegen SVG-Markup als String, wäre der
 * Markup-Schnipsel als Text lesbar. `resolveNavIcon()` beide Fälle an einer
 * Stelle, sodass Plugins weder Icon-Server, Datei-Icons noch
 * React-Komponenten mitbringen müssen.
 *
 * Konvention: `icon` ist ein Name aus `NAV_ICON_LIBRARY` (case-insensitive),
 * ein SVG-String oder ein fertiges React-Element.
 */
export default function NavIcon({ icon, className = 'nav-icon', fallback = null }) {
  // Bereits ein fertiges React-Element (z. B. Settings-Navigation) – nutzen.
  if (icon && typeof icon !== 'string') return icon;

  const markup = resolveNavIcon(icon);
  if (!markup) return fallback;

  return (
    <span className={className}>
      <InlineSvg markup={markup} />
    </span>
  );
}
