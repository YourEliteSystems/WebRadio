// Die Übersetzungskataloge werden NICHT mehr zur Build-Zeit eingebunden.
// Einzige Laufzeitquelle ist `userData/localization/`; der Main-Prozess
// liefert sie einmalig über den Preload-Bootstrap. Damit gibt es keinen
// zweiten Ladepfad und keine stillschweigend veralteten Texte im Renderer.

export const FALLBACK_LOCALE = 'en-US';
