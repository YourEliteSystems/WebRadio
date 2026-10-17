const fs = require("fs");
const path = require("path");

const StorageManager = require("../../storage/StorageManager");

class CrashReportReader {

    constructor() {

        this.crashDirectory = StorageManager.getCrashPath();

    }

    getReports() {

        if (!fs.existsSync(this.crashDirectory)) {
            return [];
        }

        return fs.readdirSync(this.crashDirectory)

            .filter(file => file.endsWith(".json"))

            .map(file => {

                const filePath = path.join(
                    this.crashDirectory,
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

        const reports = this.getReports();

        return reports.length > 0
            ? reports[0]
            : null;

    }

    _resolveSafePath(fileName) {
        if (typeof fileName !== "string" || !fileName.trim()) {
            return null;
        }

        const trimmed = fileName.trim();
        const baseName = path.basename(trimmed);

        if (baseName !== trimmed || !trimmed.endsWith(".json") || trimmed.startsWith(".")) {
            return null;
        }

        const resolvedDir = path.resolve(this.crashDirectory);
        const resolvedPath = path.resolve(this.crashDirectory, baseName);

        if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
            return null;
        }

        return resolvedPath;
    }

    read(fileName) {

        const filePath = this._resolveSafePath(fileName);

        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }

        try {
            return JSON.parse(
                fs.readFileSync(filePath, "utf8")
            );
        } catch {
            return null;
        }

    }

    delete(fileName) {

        const filePath = this._resolveSafePath(fileName);

        if (!filePath || !fs.existsSync(filePath)) {
            return false;
        }

        fs.unlinkSync(filePath);

        return true;

    }

    clear() {

        const reports = this.getReports();

        reports.forEach(report => {

            fs.unlinkSync(report.path);

        });

    }

}

module.exports = new CrashReportReader();