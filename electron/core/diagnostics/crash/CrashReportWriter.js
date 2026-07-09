const fs = require("fs");
const path = require("path");

const StorageManager = require("../../storage/StorageManager");

class CrashReportWriter {

    constructor() {

        this.crashDirectory = StorageManager.getCrashPath();

    }

    write(report) {

        if (!report) {
            throw new Error("CrashReportWriter: Report is undefined.");
        }

        const timestamp = this.createTimestamp();

        const fileName = `crash-${timestamp}.json`;

        const filePath = path.join(
            this.crashDirectory,
            fileName
        );

        fs.writeFileSync(
            filePath,
            JSON.stringify(report, null, 4),
            "utf8"
        );

        return filePath;

    }

    createTimestamp() {

        const now = new Date();

        const year = now.getFullYear();

        const month = String(now.getMonth() + 1).padStart(2, "0");

        const day = String(now.getDate()).padStart(2, "0");

        const hour = String(now.getHours()).padStart(2, "0");

        const minute = String(now.getMinutes()).padStart(2, "0");

        const second = String(now.getSeconds()).padStart(2, "0");

        return `${year}-${month}-${day}_${hour}-${minute}-${second}`;

    }

}

module.exports = new CrashReportWriter();