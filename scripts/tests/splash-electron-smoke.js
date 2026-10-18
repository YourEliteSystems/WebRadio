"use strict";

/**
 * Splash-Rauchtest in echtem Electron (nicht Teil von `npm test`)
 *
 * Prüft genau die Dinge, die sich mit gestubbtem `electron` nicht belegen
 * lassen:
 *   1. renderer/splash.html lädt im Entwicklungsbetrieb,
 *   2. electron/preload-splash.js wird geladen und stellt `splashApi` bereit,
 *   3. die Splash-IPC (`splash:get-version`, `splash:bootup-state`) funktioniert,
 *   4. der Splash schließt nach dem Lade-Signal,
 *   5. ein Schließen während des Ladens wird nicht als `ERR_FAILED` gemeldet.
 *
 * Start: `npm run test:splash:electron`
 * Benötigt eine Grafiksitzung (Linux/CI: xvfb-run -a npm run test:splash:electron).
 * Das Splash-Fenster ist dabei kurz sichtbar.
 */

const { app } = require("electron");
const path = require("path");

const appRoot = path.resolve(__dirname, "../..");
const SplashWindow = require(path.join(appRoot, "electron/core/app/SplashWindow.js"));

const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, ok, detail) {
    results.push({ name, ok });
    console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? `  [${detail}]` : ""}`);
}

console.log("==========================================");
console.log("🧪 Starte Splash-Rauchtest (echtes Electron)");
console.log("==========================================");

// Der Splash ist im Test das einzige Fenster: Electron darf beim Schließen
// nicht automatisch beenden, sonst endet der Test vorzeitig.
// WICHTIG: Das Event muss nach app.whenReady() registriert werden, da app im
// Electron-Boot-Prozess erst dann verfügbar ist.


app.whenReady().then(async () => {
    // Event nach app.whenReady() registrieren
    app.on("window-all-closed", () => {});

    // ── Normaler Ablauf ───────────────────────────────────────────────
    const splash = new SplashWindow();
    const win = splash.open();

    check("splash.html lädt im Entwicklungsbetrieb", (await splash.whenLoaded(3000)) === true);

    const loadedUrl = win.webContents.getURL();
    check(
        "geladene URL zeigt auf renderer/splash.html",
        loadedUrl.startsWith("file:///") && loadedUrl.endsWith("/renderer/splash.html"),
        loadedUrl
    );

    const api = await win.webContents.executeJavaScript(
        "typeof window.splashApi + ':' + Object.keys(window.splashApi).join(',')"
    );
    check(
        "Preload stellt splashApi bereit",
        api.startsWith("object:") && api.includes("getVersion") && api.includes("getDiagnostics"),
        api
    );

    const version = await win.webContents.executeJavaScript("window.splashApi.getVersion()");
    check("Splash-IPC getVersion funktioniert", version === app.getVersion(), version);

    splash.sendBootupState({
        steps: [
            { name: "storage-init", status: "completed" },
            { name: "diagnostics-init", status: "completed" }
        ],
        current: "diagnostics-init",
        ready: false
    });

    await wait(250);

    const dom = await win.webContents.executeJavaScript(
        "document.getElementById('status-text').textContent + '|' + " +
        "document.getElementById('progress-fill').style.width"
    );
    const [statusText, progressWidth] = dom.split("|");
    check(
        "Bootup-Zustand erreicht den Renderer",
        statusText.length > 0 && parseFloat(progressWidth) > 0,
        dom
    );

    splash.close(0);
    await wait(300);

    check("Splash schließt nach Bereitschaft", splash.isOpen() === false);
    check("kein Ladefehler im Normalfall", splash._loadFailed === false);

    // ── Schließen mitten im Laden (früherer ERR_FAILED-Pfad) ──────────
    const early = new SplashWindow();
    early.open();
    early.close(0);

    await wait(2000);

    check(
        "Schließen während des Ladens gilt nicht als Ladefehler",
        early._loadFailed === false
    );
    check("Fenster ist danach geschlossen", early.isOpen() === false);

    const failed = results.filter((result) => !result.ok).length;

    console.log("\n==========================================");
    console.log(`Ergebnis: ${results.length - failed} bestanden, ${failed} fehlgeschlagen.`);
    console.log("==========================================");

    app.exit(failed > 0 ? 1 : 0);
});
