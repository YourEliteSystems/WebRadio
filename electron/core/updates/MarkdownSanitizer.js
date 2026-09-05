"use strict";

/**
 * MarkdownSanitizer.js
 *
 * Sehr leichte, absichtlich minimale Markdown-Sanitization.
 *
 * Ziel: Schutz vor XSS, javascript:-URLs, data:-URLs und rohem HTML
 * in GitHub-Release-Notes. Wir rendern den Markdown NICHT in HTML
 * (kein dangerouslySetInnerHTML im Renderer). Stattdessen liefern
 * wir einen bereinigten Markdown-String an den Renderer, der
 * diesen dann in einer sicheren Markdown-Komponente darstellt.
 *
 * Was wir tun:
 *   - Entfernen / neutralisieren gefährlicher HTML-Konstrukte
 *   - Entfernen javascript:, data:, vbscript: in URLs
 *   - Entfernen <script>, <iframe>, <object>, <embed>, on*-Handler
 *
 * Was wir NICHT tun (bewusst):
 *   - KEIN vollständiger HTML-Sanitizer (zu groß, weitere Abhängigkeit)
 *   - KEIN Rendering in HTML
 *
 * Falls der Renderer später eine echte Markdown-Engine einsetzt
 * (z.B. react-markdown), ist dieser Sanitizer weiterhin als erste
 * Verteidigungslinie sinnvoll.
 */

const DANGEROUS_URL_SCHEMES = /(?:\b|\b[(["'])(\s*)(javascript|data|vbscript|file):/gi;
const HTML_SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const HTML_IFRAME_BLOCK = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi;
const HTML_OBJECT_BLOCK = /<object\b[^>]*>[\s\S]*?<\/object>/gi;
// embed ist in HTML5 ein Void-Element ohne Close-Tag – daher
// wird der gesamte Tag ersetzt.
const HTML_EMBED_BLOCK = /<embed\b[^>]*\/?>/gi;
const HTML_STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const ON_EVENT_HANDLER = /\son\w+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi;

/**
 * Liefert true, wenn der Eingabewert "leer" ist
 * (null, undefined, leerer String, nur Whitespace).
 */
function isEmpty(input) {
    if (input === null || input === undefined) return true;
    if (typeof input !== "string") return true;
    return input.trim().length === 0;
}

/**
 * Bereinigt einen Markdown-String. Gibt immer einen String zurück
 * (nie null/undefined).
 */
function sanitize(markdown) {
    if (isEmpty(markdown)) {
        return "";
    }

    let out = String(markdown);

    // 1. Skripte / iframes / objects komplett entfernen.
    out = out.replace(HTML_SCRIPT_BLOCK, "");
    out = out.replace(HTML_IFRAME_BLOCK, "");
    out = out.replace(HTML_OBJECT_BLOCK, "");
    out = out.replace(HTML_EMBED_BLOCK, "");
    out = out.replace(HTML_STYLE_BLOCK, "");

    // 2. Inline-Event-Handler (onclick, onerror, onload, ...) entfernen.
    out = out.replace(ON_EVENT_HANDLER, "");

    // 3. Gefährliche URL-Schemes neutralisieren.
    out = out.replace(DANGEROUS_URL_SCHEMES, (_match, _ws, scheme) => {
        return ` ${scheme}-blocked:`;
    });

    // 4. <meta http-equiv> / <link> entfernen.
    out = out.replace(/<meta\b[^>]*>/gi, "");
    out = out.replace(/<link\b[^>]*>/gi, "");

    return out;
}

/**
 * Liefert einen kurzen "Plain Text"-Auszug, der im UI als Fallback
 * verwendet werden kann (z.B. bei komplett kaputten Notes).
 */
function extractPlainText(markdown, maxLength = 280) {
    const safe = sanitize(markdown);
    const text = safe
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")        // ![alt](url) -> ""
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")    // [text](url) -> "text"
        .replace(/[`*_>#~-]/g, "")                  // simple md markers
        .replace(/\s+/g, " ")
        .trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}

module.exports = {
    sanitize,
    extractPlainText
};
