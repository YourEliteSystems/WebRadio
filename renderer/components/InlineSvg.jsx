import React, { useMemo } from 'react';

/**
 * InlineSvg
 *
 * Rendert ein als String vorliegendes SVG-Markup (z. B. das `icon` aus
 * `electron/core/updates/ChannelMetadata.js`) als echtes Inline-SVG.
 *
 * why: Ein SVG-String ist kein gültiges React-Kind. Wird er direkt als Kind
 * (`{meta.icon}`) verwendet, gibt React ihn als escapten Text aus – das Icon
 * erscheint als Markup-Schnipsel in der Oberfläche. Ein rohes
 * `dangerouslySetInnerHTML` in einem `<span>` wiederum übernommen hätte das
 * SVG mit seinen festen `width`/`height`-Attributen (12×12) und ohne
 * Flex-/Baseline-Verhalten einführen. Dieser Wrapper übergibt die Größe an CSS
 * (`.inline-svg` in `renderer/styles/core.css`), damit Icons sich an Badge- und
 * Optionsgrößen anpassen und über `currentColor` die Theme-Farbe des Containers
 * erben.
 *
 * safety: Die Markup-Strings stammen ausschließlich aus Core-seitigen,
 * eingefrorenen Metadaten bzw. lokalen Fallbacks – niemals aus Nutzereingaben
 * oder Plugin-Daten. Unsichere Konstrukte werden trotzdem vor dem Einfügen
 * entfernt und Nicht-SVG-Markup gar nicht erst gerendert.
 */

// Entfernt XML-Deklaration/Doctype sowie potenziell gefährliche Konstrukte.
const XML_PROLOG = /^\s*(<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>)/gi;
const UNSAFE_CONSTRUCTS = [
  { pattern: /<\s*(script|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, replacement: '' },
  { pattern: /<\s*(script|iframe|object|embed)\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, replacement: '' },
  { pattern: /\b(xlink:href|href)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, replacement: '' }
];

/**
 * Bereitet ein SVG-Markup für das Inline-Rendering auf.
 *
 * @param {string} markup SVG-String (z. B. `<svg viewBox="…">…</svg>`)
 * @returns {string|null} Aufbereitetes Markup oder `null`, wenn kein SVG
 */
export function normalizeSvgMarkup(markup) {
  if (typeof markup !== 'string') return null;

  let svg = markup.replace(XML_PROLOG, '').trim();
  if (!svg || !/<svg[\s>]/i.test(svg)) return null;

  UNSAFE_CONSTRUCTS.forEach(({ pattern, replacement }) => {
    svg = svg.replace(pattern, replacement);
  });

  // Feste Größenattribute entfernen: die Größe kommt ausschließlich aus CSS,
  // damit Icons in Badge-, Options- und Hint-Kontexten skalieren.
  svg = svg.replace(/<svg([^>]*)>/i, (match, attrs) => {
    const cleaned = attrs
      .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\sclass\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<svg${cleaned.trim()} class="inline-svg__icon">`;
  });

  return svg;
}

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
      // Der Inhalt ist lokal definiertes, sanitisiertes SVG-Markup aus
      // Core-Metadaten (siehe Header-Kommentar), keine externe Eingabe.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
