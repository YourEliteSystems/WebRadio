const fs = require("fs");
const path = require("path");

const StorageManager = require("../../storage/StorageManager");

class LogReader {

    constructor() {

        this.logDirectory = StorageManager.getLogsPath();

    }

    getLogs() {

        if (!fs.existsSync(this.logDirectory)) {
            return [];
        }

        return fs.readdirSync(this.logDirectory)

            .filter(file => file.endsWith(".log"))

            .map(file => {

                const filePath = path.join(
                    this.logDirectory,
                    file
                );

                const stat = fs.statSync(filePath);

                return {
                    id: file,
                    file,
                    path: filePath,
                    created: stat.birthtime,
                    modified: stat.mtime
                };

            })

            .sort((a, b) => b.created - a.created);

    }

    getLatest() {

        const logs = this.getLogs();

        return logs.length > 0
            ? logs[0]
            : null;

    }

    _resolveSafePath(fileName) {
        if (typeof fileName !== "string" || !fileName.trim()) {
            return null;
        }

        const trimmed = fileName.trim();
        const baseName = path.basename(trimmed);

        if (
            baseName !== trimmed ||
            !trimmed.endsWith(".log") ||
            trimmed.startsWith(".") ||
            /[\\/]/.test(trimmed) ||
            trimmed.includes(":") ||
            trimmed.includes("\0")
        ) {
            return null;
        }

        const resolvedDir = path.resolve(this.logDirectory);
        const resolvedPath = path.resolve(this.logDirectory, baseName);

        if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
            return null;
        }

        return resolvedPath;
    }

    _isRealPathInside(filePath) {
        try {
            const realDirectory = fs.realpathSync(this.logDirectory);
            const realFile = fs.realpathSync(filePath);
            return realFile.startsWith(realDirectory + path.sep);
        } catch {
            return false;
        }
    }

    read(fileName) {

        const filePath = this._resolveSafePath(fileName);

        if (!filePath || !fs.existsSync(filePath) || !this._isRealPathInside(filePath)) {
            return null;
        }

        return fs.readFileSync(filePath, "utf8");

    }

    delete(fileName) {

        const filePath = this._resolveSafePath(fileName);

        if (!filePath || !fs.existsSync(filePath) || !this._isRealPathInside(filePath)) {
            return false;
        }

        fs.unlinkSync(filePath);

        return true;

    }

    clear() {

        const logs = this.getLogs();

        logs.forEach(log => {
            fs.unlinkSync(log.path);
        });

    }

}

module.exports = new LogReader();
