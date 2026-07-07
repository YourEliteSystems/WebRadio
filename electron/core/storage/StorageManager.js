const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class StorageManager {

    constructor() {

        this.userData = app.getPath("userData");

    }

    ensureDirectory(dir) {

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

    }

    initialize() {

        this.ensureDirectory(
            path.join(this.userData, "plugins")
        );

        this.ensureDirectory(
            path.join(this.userData, "themes")
        );

        this.ensureDirectory(
            path.join(this.userData, "plugin-data")
        );

    }

}

module.exports = new StorageManager();