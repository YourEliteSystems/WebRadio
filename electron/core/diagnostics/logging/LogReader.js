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

    read(fileName) {

        const filePath = path.join(
            this.logDirectory,
            fileName
        );

        if (!fs.existsSync(filePath)) {
            return null;
        }

        return fs.readFileSync(filePath, "utf8");

    }

    delete(fileName) {

        const filePath = path.join(
            this.logDirectory,
            fileName
        );

        if (!fs.existsSync(filePath)) {
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
