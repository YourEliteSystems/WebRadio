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

    read(fileName) {

        const filePath = path.join(
            this.crashDirectory,
            fileName
        );

        if (!fs.existsSync(filePath)) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

    }

    delete(fileName) {

        const filePath = path.join(
            this.crashDirectory,
            fileName
        );

        if (!fs.existsSync(filePath)) {
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