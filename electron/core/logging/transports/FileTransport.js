"use strict";

const fs = require("fs");
const path = require("path");

class FileTransport {

    constructor(directory, formatter) {

        this.directory = directory;
        this.formatter = formatter;

        this.ensureDirectory();

    }

    ensureDirectory() {

        if (!fs.existsSync(this.directory)) {

            fs.mkdirSync(this.directory, {
                recursive: true
            });

        }

    }

    getLatestFile() {

        return path.join(
            this.directory,
            "latest.log"
        );

    }

    getDailyFile() {

        const date = new Date();

        const year = date.getFullYear();

        const month =
            String(date.getMonth() + 1)
                .padStart(2, "0");

        const day =
            String(date.getDate())
                .padStart(2, "0");

        return path.join(
            this.directory,
            `${year}-${month}-${day}.log`
        );

    }

    log(entry) {

        const line =
            this.formatter.format(entry) + "\n";

        try {

            fs.appendFileSync(
                this.getLatestFile(),
                line,
                "utf8"
            );

            fs.appendFileSync(
                this.getDailyFile(),
                line,
                "utf8"
            );

        } catch (err) {

            console.error(
                "FileTransport:",
                err
            );

        }

    }

}

module.exports = FileTransport;