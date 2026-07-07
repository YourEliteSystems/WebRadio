"use strict";

/**
 * @file LogLevel.js
 * @description
 * Definiert sämtliche verfügbaren Log-Level des WebRadio-Logging-Systems.
 *
 * Die numerischen Werte dienen gleichzeitig als Priorität und ermöglichen
 * später das Filtern von Log-Ausgaben.
 *
 * Beispiel:
 *
 * TRACE (0)
 * DEBUG (1)
 * INFO  (2)
 * WARN  (3)
 * ERROR (4)
 * FATAL (5)
 *
 * Wird der Logger z.B. auf INFO gesetzt,
 * werden TRACE und DEBUG automatisch unterdrückt.
 *
 * @author WebRadio Project
 * @license MIT
 */

class LogLevel {

    /**
     * Sehr detaillierte interne Ablaufverfolgung.
     * Sollte ausschließlich während der Entwicklung genutzt werden.
     *
     * @type {number}
     */
    static TRACE = 0;

    /**
     * Debug-Ausgaben.
     *
     * Für Entwickler gedacht.
     *
     * @type {number}
     */
    static DEBUG = 1;

    /**
     * Allgemeine Informationen.
     *
     * @type {number}
     */
    static INFO = 2;

    /**
     * Warnungen.
     *
     * Das Programm kann normal weiterlaufen.
     *
     * @type {number}
     */
    static WARN = 3;

    /**
     * Fehler.
     *
     * Eine Funktion konnte nicht korrekt ausgeführt werden.
     *
     * @type {number}
     */
    static ERROR = 4;

    /**
     * Kritischer Fehler.
     *
     * Das Programm kann möglicherweise nicht mehr korrekt arbeiten.
     *
     * @type {number}
     */
    static FATAL = 5;

    /**
     * Gibt den Namen eines Log-Levels zurück.
     *
     * @param {number} level
     * @returns {string}
     */
    static getName(level) {

        switch (level) {

            case LogLevel.TRACE:
                return "TRACE";

            case LogLevel.DEBUG:
                return "DEBUG";

            case LogLevel.INFO:
                return "INFO";

            case LogLevel.WARN:
                return "WARN";

            case LogLevel.ERROR:
                return "ERROR";

            case LogLevel.FATAL:
                return "FATAL";

            default:
                return "UNKNOWN";
        }

    }

    /**
     * Prüft, ob ein Log-Level gültig ist.
     *
     * @param {number} level
     * @returns {boolean}
     */
    static isValid(level) {

        return Number.isInteger(level)
            && level >= LogLevel.TRACE
            && level <= LogLevel.FATAL;

    }

}

module.exports = LogLevel;