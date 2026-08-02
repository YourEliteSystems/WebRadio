const { app } = require("electron");
const Application = require("./core/Application");
const LogManager = require("./core/diagnostics/logging/LogManager");

const logger = LogManager.getLogger("Main");

process.on("uncaughtException", (error) => {
    logger.fatal("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});


app.whenReady().then(async () => {
    await Application.start();
});

app.on("before-quit", async () => {
    await Application.shutdown();
});
