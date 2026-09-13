"use strict";

const fs = require("fs");
const path = require("path");

class FileTransport {

    constructor(directory, formatter) {

        this.directory = directory;
        this.formatter = formatter;
        this.directoryEnsured = false;

    }

    ensureDirectory() {

        if (this.directoryEnsured) {
            return;
        }

        if (!fs.existsSync(this.directory)) {

            fs.mkdirSync(this.directory, {
                recursive: true
            });

        }

        this.directoryEnsured = true;

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

        this.ensureDirectory();

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

            // Das Verzeichnis kann zwischenzeitlich entfernt worden sein
            // (z. B. Test-Temp-Verzeichnisse). Einmal zurücksetzen und neu
            // versuchen, bevor aufgegeben wird – verhindert Log-Ausfälle.
            if (err && (err.code === "ENOENT" || err.kind === "ENOENT")) {
                this.directoryEnsured = false;
                try {
                    this.ensureDirectory();
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
                    return;
                } catch (retryErr) {
                    console.error(
                        "FileTransport:",
                        retryErr
                    );
                    return;
                }
            }

            console.error(
                "FileTransport:",
                err
            );

        }

    }

}

module.exports = FileTransport;