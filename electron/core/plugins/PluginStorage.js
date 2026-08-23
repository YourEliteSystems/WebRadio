const fs = require("fs");
const path = require("path");
const { app } = require("electron");

function getPluginFile(pluginId) {
    const userData = (app && typeof app.getPath === "function")
        ? app.getPath("userData")
        : path.join(process.cwd(), "data");

    return path.join(
        userData,
        "plugins",
        `${pluginId}.json`
    );

}

function read(pluginId) {

    const file = getPluginFile(pluginId);

    if (!fs.existsSync(file)) {
        return {};
    }

    try {

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );

    } catch {

        return {};
    }

}

function write(pluginId, data) {

    const file = getPluginFile(pluginId);

    fs.mkdirSync(
        path.dirname(file),
        { recursive: true }
    );

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );

}

module.exports = {
    read,
    write,
    getPluginFile
};