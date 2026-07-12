const { app } = require("electron");
const Application = require("./core/Application");

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});


app.whenReady().then(async () => {
    await Application.start();
});

app.on("before-quit", async () => {
    await Application.shutdown();
});
