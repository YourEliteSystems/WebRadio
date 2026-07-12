const SystemInfo = require("../system/SystemInfo");
const HealthCheck = require("../health/HealthCheck");

const CrashReportWriter = require("./CrashReportWriter");

class CrashReportManager {

    constructor() {
        this.initialized = false;
        this.sections = [];
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
    }

    shutdown() {
        if (!this.initialized) {
            return;
        }

        this.sections = [];
        this.initialized = false;
    }

    registerSection(name, callback) {
        this.sections.push({
            name,
            callback
        });
    }

    create({ type, error }) {
        if (!this.initialized) {
            this.initialize();
        }

        const report = {
            timestamp: new Date().toISOString(),
            application: SystemInfo.get().application,
            runtime: SystemInfo.get().runtime,
            system: SystemInfo.get().system,
            cpu: SystemInfo.get().cpu,
            memory: SystemInfo.get().memory,
            health: HealthCheck.run(),
            error: {
                type,
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            sections: {}
        };

        for (const section of this.sections) {
            try {
                report.sections[section.name] = section.callback();
            } catch (err) {
                report.sections[section.name] = {
                    error: err.message
                };
            }
        }

        return CrashReportWriter.write(report);
    }

}

module.exports = new CrashReportManager();