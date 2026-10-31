"use strict";

/**
 * LinuxAppImageInstaller.js
 *
 * Sicherer, atomarer Installationsprozess für Linux AppImages.
 *
 * Verantwortlichkeiten:
 *  - Vorabprüfung der Schreib- und Ausführungsrechte (kein Update in geschützte Systemverzeichnisse)
 *  - Validierung des heruntergeladenen Artefakts (ELF-Header, Dateigröße)
 *  - Auflösung symbolischer Links (Erhalt der Symlink-Integrität)
 *  - Erhalt der ursprünglichen Unix-Dateiberechtigungen (chmod 755/stat.mode, niemals 777)
 *  - Atomarer Austausch über Staging-Datei im Zielverzeichnis
 *  - Automatisches Rollback bei Fehlern
 *  - Saubere Fehlerprotokollierung
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class LinuxAppImageInstaller {

    /**
     * Prüft, ob ein Artefakt eine valide Linux-Executable (ELF) ist.
     *
     * @param {string} filePath
     * @param {object} [fsObj=fs]
     * @returns {boolean}
     */
    static validateUpdateArtifact(filePath, fsObj = fs) {
        if (!filePath || !fsObj.existsSync(filePath)) {
            throw new Error(`Update-Datei nicht gefunden: ${filePath}`);
        }

        const stat = fsObj.statSync(filePath);
        if (stat.size < 1024) {
            throw new Error(`Update-Datei ist unvollständig oder leer (${stat.size} Bytes): ${filePath}`);
        }

        // ELF-Header prüfen (0x7F 'E' 'L' 'F')
        const fd = fsObj.openSync(filePath, "r");
        const buffer = Buffer.alloc(4);
        try {
            fsObj.readSync(fd, buffer, 0, 4, 0);
        } finally {
            fsObj.closeSync(fd);
        }

        const isElf = buffer[0] === 0x7f &&
                      buffer[1] === 0x45 && // 'E'
                      buffer[2] === 0x4c && // 'L'
                      buffer[3] === 0x46;   // 'F'

        if (!isElf) {
            throw new Error(`Update-Datei ist keine gültige Linux-Binärdatei (kein ELF-Header): ${filePath}`);
        }

        return true;
    }

    /**
     * Löst Pfade und symbolische Links auf.
     *
     * @param {string} appImagePath
     * @param {object} [fsObj=fs]
     * @returns {{ targetPath: string, symlinkPath: string|null }}
     */
    static resolveTargetPaths(appImagePath, fsObj = fs) {
        if (!appImagePath || typeof appImagePath !== "string") {
            throw new Error("Ungültiger AppImage-Pfad angegeben");
        }

        if (!fsObj.existsSync(appImagePath)) {
            throw new Error(`AppImage-Datei existiert nicht: ${appImagePath}`);
        }

        const lstat = fsObj.lstatSync(appImagePath);
        const isSymlink = lstat.isSymbolicLink();

        let realPath = appImagePath;
        if (isSymlink && typeof fsObj.realpathSync === "function") {
            realPath = fsObj.realpathSync(appImagePath);
        }

        return {
            targetPath: realPath,
            symlinkPath: isSymlink ? appImagePath : null
        };
    }

    /**
     * Prüft Schreib- und Zugriffsrechte im Zielverzeichnis und auf der Zieldatei.
     *
     * @param {string} targetPath
     * @param {object} [fsObj=fs]
     */
    static checkTargetPermissions(targetPath, fsObj = fs) {
        const targetDir = path.dirname(targetPath);

        if (!fsObj.existsSync(targetDir)) {
            throw new Error(`Installationsverzeichnis existiert nicht: ${targetDir}`);
        }

        // Prüfen, ob wir im Verzeichnis schreiben dürfen
        try {
            const wOk = (fsObj.constants && fsObj.constants.W_OK) !== undefined ? fsObj.constants.W_OK : 2;
            const xOk = (fsObj.constants && fsObj.constants.X_OK) !== undefined ? fsObj.constants.X_OK : 1;
            if (typeof fsObj.accessSync === "function") {
                fsObj.accessSync(targetDir, wOk | xOk);
            }
        } catch {
            throw new Error(
                `Keine ausreichenden Schreibrechte im Installationsverzeichnis: ${targetDir}. ` +
                "Updates in geschützte Systemverzeichnisse werden verhindert."
            );
        }

        // Falls die Zieldatei existiert, Prüfen auf Dateischreibrechte
        if (fsObj.existsSync(targetPath)) {
            try {
                const wOk = (fsObj.constants && fsObj.constants.W_OK) !== undefined ? fsObj.constants.W_OK : 2;
                if (typeof fsObj.accessSync === "function") {
                    fsObj.accessSync(targetPath, wOk);
                }
            } catch {
                throw new Error(
                    `Keine Schreibrechte auf der Zieldatei: ${targetPath}. ` +
                    "Updates in geschützte Systemverzeichnisse werden verhindert."
                );
            }
        }
    }

    /**
     * Ermittelt die zu erhaltenden Dateiberechtigungen.
     *
     * @param {string} targetPath
     * @param {object} [fsObj=fs]
     * @returns {number}
     */
    static getPreservedExecutableMode(targetPath, fsObj = fs) {
        if (!fsObj.existsSync(targetPath)) {
            return 0o755;
        }

        const stat = fsObj.statSync(targetPath);
        const originalMode = stat.mode & 0o777;

        // Sicherstellen, dass Ausführungsrechte erhalten bzw. gesetzt werden (Owner immer rwx)
        // Group und Other erhalten rx falls vorher lesbar/ausführbar.
        let mode = originalMode | 0o755;

        // Sicherheitsregel: Niemals World-Writable (0o002)
        mode = mode & ~0o002;

        return mode;
    }

    /**
     * Führt den sicheren atomaren Austausch des AppImages durch.
     *
     * @param {object} options
     * @param {string} options.currentAppPath
     * @param {string} options.downloadedUpdatePath
     * @param {object} [options.fsObj=fs]
     * @param {object} [options.appObj=null]
     * @returns {{ success: boolean, targetPath: string, symlinkPath: string|null, mode: number }}
     */
    static applyUpdate({ currentAppPath, downloadedUpdatePath, fsObj = fs, appObj = null }) {
        // 1. Validierung des Downloads
        this.validateUpdateArtifact(downloadedUpdatePath, fsObj);

        // 2. Zielpfad und Symlink ermitteln
        const { targetPath, symlinkPath } = this.resolveTargetPaths(currentAppPath, fsObj);

        // 3. Vorabprüfung der Schreibrechte
        this.checkTargetPermissions(targetPath, fsObj);

        // 4. Ziel-Permissions ermitteln
        const preservedMode = this.getPreservedExecutableMode(targetPath, fsObj);

        // 5. Staging im selben Verzeichnis wie targetPath (garantiert dasselbe Dateisystem für rename)
        const targetDir = path.dirname(targetPath);

        // Fragmente früherer abgebrochener Aktualisierungen aufräumen.
        // WICHTIG: Vor der Löschung von .bak-Dateien prüfen, ob das Ziel fehlt und
        // die Sicherung noch wiederhergestellt werden sollte (Recovery First).
        try {
            if (typeof fsObj.readdirSync === "function") {
                const entries = fsObj.readdirSync(targetDir);
                for (const entry of entries) {
                    if (typeof entry === "string" && entry.startsWith(".webradio-update-")) {
                        const entryPath = path.join(targetDir, entry);
                        if (entry.endsWith(".tmp")) {
                            // Unvollständige Staging-Dateien immer löschen – sie
                            // enthalten kein gültiges Backup der Anwendung.
                            try { fsObj.unlinkSync(entryPath); } catch { /* ignore */ }
                        } else if (entry.endsWith(".bak")) {
                            // .bak könnte der letzte Stand nach einem Absturz sein.
                            // Nur löschen wenn das Ziel bereits existiert (d. h.
                            // vorheriges Update hat funktioniert), NICHT wenn das Ziel fehlt.
                            const targetExists = fsObj.existsSync(targetPath);
                            if (targetExists) {
                                try { fsObj.unlinkSync(entryPath); } catch { /* ignore */ }
                            }
                            // Wenn Ziel fehlt: .bak-Datei als mögliche Wiederherstellungsquelle
                            // in Ruhe lassen; sie schadet nicht.
                        }
                    }
                }
            }
        } catch {
            /* ignore */
        }

        // Kryptografisch sichere, kollisionsfreie temporäre Dateinamen
        const randId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        const stagingPath = path.join(targetDir, `.webradio-update-${randId}.tmp`);
        const backupPath = path.join(targetDir, `.webradio-update-${randId}.bak`);

        try {
            // Download in Staging-Datei kopieren
            fsObj.copyFileSync(downloadedUpdatePath, stagingPath);

            // Ausführungsrechte explizit auf Staging-Datei setzen
            fsObj.chmodSync(stagingPath, preservedMode);

            // Überprüfung der Staging-Datei (auf POSIX-Systemen)
            if (process.platform !== "win32") {
                const stagedStat = fsObj.statSync(stagingPath);
                if ((stagedStat.mode & 0o111) === 0) {
                    throw new Error("Staging-Datei hat keine Ausführungsrechte erhalten");
                }
            }

            // Vorherige Version sichern (Rollback-Garantie)
            fsObj.renameSync(targetPath, backupPath);

            // Atomarer Austausch
            try {
                fsObj.renameSync(stagingPath, targetPath);

                // Verifikation des ausgetauschten Ziel-Executables (auf POSIX-Systemen)
                if (process.platform !== "win32") {
                    const finalStat = fsObj.statSync(targetPath);
                    if ((finalStat.mode & 0o111) === 0) {
                        throw new Error("Ziel-Datei hat nach Austausch keine Ausführungsrechte");
                    }
                }
            } catch (swapErr) {
                // Rollback: Vorherige Version aus Backup wiederherstellen.
                // Die .bak-Datei enthält die Originalbinary mit ihren ursprünglichen
                // Rechten – kein erneutes chmodSync nötig (und nicht sicher, da wir
                // nicht wissen ob chmodSync noch fehlschlägt).
                if (fsObj.existsSync(backupPath)) {
                    try {
                        if (fsObj.existsSync(targetPath)) {
                            fsObj.unlinkSync(targetPath);
                        }
                        fsObj.renameSync(backupPath, targetPath);
                    } catch {
                        /* Rollback schlug ebenfalls fehl – Backup-Pfad nicht löschen,
                         * Nutzer kann manuell wiederherstellen. */
                    }
                }
                throw new Error(`Atomarer Austausch fehlgeschlagen, Rollback durchgeführt: ${swapErr.message}`);
            }

            // Erfolg: Backup entfernen
            try {
                fsObj.unlinkSync(backupPath);
            } catch {
                /* ignore */
            }

            // Heruntergeladene temporäre Datei aufräumen
            try {
                fsObj.unlinkSync(downloadedUpdatePath);
            } catch {
                /* ignore */
            }

            // Ggf. Neustart über Electron auslösen
            if (appObj && typeof appObj.relaunch === "function" && typeof appObj.quit === "function") {
                appObj.relaunch({ execPath: targetPath });
                appObj.quit();
            }

            return {
                success: true,
                targetPath,
                symlinkPath,
                mode: preservedMode
            };
        } finally {
            // Aufräumen von Staging falls vorhanden
            if (fsObj.existsSync(stagingPath)) {
                try {
                    fsObj.unlinkSync(stagingPath);
                } catch {
                    /* ignore */
                }
            }
        }
    }
}

module.exports = LinuxAppImageInstaller;
