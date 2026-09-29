import React, { useMemo } from 'react';
import { normalizeSvgMarkup } from '../ui/iconLibrary.js';

/**
 * InlineSvg
 *
 * Rendert ein als String vorliegendes SVG-Markup (z. B. das `icon` aus
 * `electron/core/updates/ChannelMetadata.js` oder ein Navigations-Icon) als
 * echtes Inline-SVG.
 *
 * why: Ein SVG-String ist kein gültiges React-Kind. Wird er direkt als Kind
 * (`{meta.icon}`) ausgegeben, schreibt React ihn als escapten Text in die
 * Oberfläche – sichtbar als Markup-Schnipsel. Rohe
 * `dangerouslySetInnerHTML`-Aufrufe an verschiedenen Stellen hätten zudem die
 * festen `width`/`height`-Attribute (12×12) des Quell-SVGs übernommen und die
 * Größe dem Zufall überlassen. Dieser Wrapper gibt die Größe stattdessen an
 * CSS ab (`.inline-svg` in `renderer/styles/core.css`), damit Icons in
 * Badges, Optionszeilen und der Sidebar skalieren und über `currentColor` die
 * Schriftfarbe des Containers erben.
 *
 * safety: Die Markup-Strings stammen ausschließlich aus Core-seitigen,
 * eingefrorenen Metadaten bzw. der lokalen Icon-Bibliothek – niemals aus
 * Nutzereingaben. `normalizeSvgMarkup()` entfernt unsichere Konstrukte und
 * verwirft Nicht-SVG-Markup, bevor es in den DOM gelangt.
 */
export default function InlineSvg({ markup, className = '', title }) {
  const svg = useMemo(() => normalizeSvgMarkup(markup), [markup]);

  if (!svg) return null;

  const classes = className ? `inline-svg ${className}` : 'inline-svg';

  return (
    <span
      className={classes}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
