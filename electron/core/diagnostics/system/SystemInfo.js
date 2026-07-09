const os = require("os");
const process = require("process");
const { app } = require("electron");

class SystemInfo {

    get() {

        return {

            application: {
                name: app.getName(),
                version: app.getVersion(),
                userData: app.getPath("userData")
            },

            system: {
                platform: process.platform,
                architecture: process.arch,
                hostname: os.hostname(),
                uptime: os.uptime()
            },

            cpu: {
                model: os.cpus()[0]?.model || "Unknown",
                cores: os.cpus().length
            },

            memory: {
                total: os.totalmem(),
                free: os.freemem()
            },

            runtime: {
                node: process.versions.node,
                electron: process.versions.electron,
                chromium: process.versions.chrome,
                v8: process.versions.v8
            }

        };

    }
    getPretty() {
        const info = this.get();
        return {
            ...info,
            memory: {
                total: `${(info.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`,
                free: `${(info.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB`
            }
        };
    }

}

module.exports = new SystemInfo();