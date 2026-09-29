/**
 * iconLibrary.js
 *
 * Reine (JSX-freie) Icon-Logik für den Renderer:
 *   - `normalizeSvgMarkup()` – bereitet einen SVG-String für Inline-Rendering vor
 *   - `NAV_ICON_LIBRARY`     – Namen → SVG-Markup für Navigationseinträge
 *   - `resolveNavIcon()`     – löst den `icon`-Wert eines Nav-Eintrags auf
 *
 * why: Navigationseinträge (Core und Plugins) referenzieren ihr Icon nur über
 * einen Namen, z. B. `icon: "radio"` (Core) oder `icon: "media"` (MediaHub).
 * Wird ein solcher Name direkt als JSX-Kind ausgegeben, erscheint in der
 * Sidebar das nackte Wort statt eines Symbols; liefert ein Plugin stattdessen
 * SVG-Markup als String, wäre der Markup-Schnipsel als Text lesbar. Beide
 * Fälle werden hier zentral aufgelöst, damit Plugins weder Icon-Server,
 * Datei-Icons noch React-Komponenten mitbringen müssen.
 *
 * Das Modul ist bewusst frei von React und DOM-Zugriff, damit es in den Tests
 * (scripts/tests/icon-rendering.test.js) direkt geprüft werden kann.
 */

// Voran gestellte Deklarationen eines SVG-Dokuments. Sie gehören nicht in ein
// Inline-SVG und werden vor dem Einfügen in den DOM entfernt.
const XML_PROLOG = /<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/gi;

// Konstrukte, die auch in lokal definiertem Markup nichts in einem Icon
// verloren haben. Sie werden vor dem Einfügen in den DOM entfernt.
const UNSAFE_CONSTRUCTS = [
  { pattern: /<\s*(script|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, replacement: '' },
  { pattern: /<\s*(script|iframe|object|embed)\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, replacement: '' },
  { pattern: /\b(xlink:href|href)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, replacement: '' }
];

/**
 * Bereitet einen SVG-String für das Inline-Rendering vor.
 *
 * Die festen `width`/`height`-Attribute werden entfernt: die Größe kommt aus
 * CSS (`.inline-svg` in `renderer/styles/core.css`), damit dasselbe Icon in
 * Badge-, Options- und Sidebar-Kontexten skaliert. `fill`/`stroke` bleiben
 * unangetastet, weil die Quell-Icons `currentColor` verwenden und die Farbe
 * so die Schriftfarbe des Containers erbt.
 *
 * @param {unknown} markup SVG-String (z. B. `<svg viewBox="…">…</svg>`)
 * @returns {string|null} Aufbereitetes Markup oder `null`, wenn kein SVG
 */
export function normalizeSvgMarkup(markup) {
  if (typeof markup !== 'string') return null;

  let svg = markup.replace(XML_PROLOG, '').trim();
  if (!svg || !/<svg[\s>]/i.test(svg)) return null;

  UNSAFE_CONSTRUCTS.forEach(({ pattern, replacement }) => {
    svg = svg.replace(pattern, replacement);
  });

  // Größen- und class-Attribute des Wurzel-SVGs abtrennen, dann eigene Klasse.
  // Die Reihenfolge (Klasse zuerst) stellt sicher, dass zwischen `<svg` und den
  // übernommenen Attributen immer genau ein Leerzeichen steht.
  svg = svg.replace(/<svg([^>]*)>/i, (match, attrs) => {
    const cleaned = attrs
      .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\sclass\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .trim();
    return `<svg class="inline-svg__icon"${cleaned ? ` ${cleaned}` : ''}>`;
  });

  return svg;
}

/**
 * Prüft, ob ein Wert als Icon-Markup darstellbar ist.
 *
 * @param {unknown} markup
 * @returns {boolean}
 */
export function isSvgMarkup(markup) {
  return normalizeSvgMarkup(markup) !== null;
}

// Stroke-basierte Symbole im 24×24-Raster: gleiche Optik wie die übrigen
// Core-Icons und über `currentColor` an das Theme angepasst.
const stroke = (paths) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const BASE_ICONS = Object.freeze({
  radio: stroke(
    '<circle cx="12" cy="12" r="2"/>' +
    '<path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49"/>' +
    '<path d="M17.66 4.93a10 10 0 0 1 0 14.14M6.34 19.07a10 10 0 0 1 0-14.14"/>'
  ),
  home: stroke('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
  media: stroke('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
  music: stroke('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  video: stroke('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'),
  tv: stroke('<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>'),
  mic: stroke(
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>'
  ),
  list: stroke(
    '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>' +
    '<line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>' +
    '<line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
  ),
  star: stroke('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.81 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  search: stroke('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  tools: stroke(
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'
  ),
  history: stroke('<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>'),
  globe: stroke(
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>' +
    '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
  ),
  image: stroke('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  chat: stroke('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')
});

// Gängige Aliase, damit Plugins gebräuchliche Namen verwenden können.
const NAV_ICON_ALIASES = Object.freeze({
  youtube: 'video',
  play: 'media',
  player: 'media',
  playlist: 'list',
  favorites: 'star',
  favourite: 'star',
  news: 'globe',
  podcast: 'mic',
  theme: 'image',
  plugins: 'tools',
  settings: 'tools'
});

// Vollständige Icon-Tabelle: Basisnamen plus aufgelöste Aliase.
export const NAV_ICON_LIBRARY = Object.freeze({
  ...BASE_ICONS,
  ...Object.fromEntries(
    Object.entries(NAV_ICON_ALIASES).map(([alias, target]) => [alias, BASE_ICONS[target]])
  )
});

/**
 * Löst den `icon`-Wert eines Navigations­eintrags zu SVG-Markup auf.
 *
 * Akzeptiert einen Namen aus `NAV_ICON_LIBRARY` (case-insensitive) oder
 * direkt mitgeliefertes SVG-Markup. Unbekannte Namen (z. B. der Tippfehler
 * `"meda"`) liefern `null`, damit der Aufrufer einen Fallback zeigen kann,
 * statt den rohen Namen als Text in der Oberfläche zu hinterlassen.
 *
 * @param {unknown} icon Icon-Name oder SVG-Markup
 * @returns {string|null} SVG-Markup oder `null`
 */
export function resolveNavIcon(icon) {
  if (typeof icon !== 'string') return null;

  const value = icon.trim();
  if (!value) return null;

  if (/<svg[\s>]/i.test(value)) return value;

  return NAV_ICON_LIBRARY[value.toLowerCase()] || null;
}

