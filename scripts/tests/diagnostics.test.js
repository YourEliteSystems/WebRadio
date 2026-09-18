"use strict";

/**
 * Diagnostics & Profiler Tests für WebRadio
 *
 * Prüft:
 * 1. DiagnosticsStore (RAM-Speicherung, append, clear)
 * 2. MemoryProfiler (Start, Stop, Sampling, Ring-Buffer Obergrenze, Schwellenwerte)
 * 3. ProcessProfiler (Zero-Overhead im Ruhezustand, deaktiviert)
 * 4. CPUProfiler (Zero-Overhead im Ruhezustand, deaktiviert)
 * 5. DiagnosticsManager (Startet nur aktivierte Profiler, sauberer Stop)
 * 6. BootupDiagnostics (Meilensteine, Dauer-Berechnung, Fehlererfassung)
 * 7. CrashDumpWriter (Gültiges JSON, Bereinigung sensibler Daten wie Tokens/Secrets)
 * 8. CrashHandler (Fehlerbehandlung ohne Verschlucken, Dump-Generierung)
 */

const assert = require("assert");
const fs = require("fs");

const DiagnosticsStore = require("../../electron/core/diagnostics/DiagnosticsStore");
const MemoryProfiler = require("../../electron/core/diagnostics/MemoryProfiler");
const ProcessProfiler = require("../../electron/core/diagnostics/ProcessProfiler");
const CPUProfiler = require("../../electron/core/diagnostics/CPUProfiler");
const BootupDiagnostics = require("../../electron/core/diagnostics/BootupDiagnostics");
const CrashDumpWriter = require("../../electron/core/diagnostics/CrashDumpWriter");
const DiagnosticsManager = require("../../electron/core/diagnostics/DiagnosticsManager");
const CrashHandler = require("../../electron/core/diagnostics/CrashHandler");
const eventBus = require("../../electron/core/eventBus");

console.log("==========================================");
console.log("🧪 Starte Diagnostics & Bootup Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
    }
}

// ─────────────────────────────────────────────
// 1. DiagnosticsStore
// ─────────────────────────────────────────────
console.log("\n[1] DiagnosticsStore");

test("set, get und has funktionieren im RAM", () => {
    DiagnosticsStore.clear();
    DiagnosticsStore.set("testKey", { foo: "bar" });
    assert.strictEqual(DiagnosticsStore.has("testKey"), true);
    assert.deepStrictEqual(DiagnosticsStore.get("testKey"), { foo: "bar" });
    assert.strictEqual(DiagnosticsStore.get("nonExistent", "defaultVal"), "defaultVal");
});

test("append begrenzt Listengröße auf maxItems", () => {
    DiagnosticsStore.clear();
    for (let i = 1; i <= 10; i++) {
        DiagnosticsStore.append("items", i, 5);
    }
    const items = DiagnosticsStore.get("items");
    assert.strictEqual(items.length, 5);
    assert.deepStrictEqual(items, [6, 7, 8, 9, 10]);
});

test("getAll gibt flache Snapshot-Kopie zurück", () => {
    DiagnosticsStore.clear();
    DiagnosticsStore.set("a", 1);
    DiagnosticsStore.set("b", 2);
    const all = DiagnosticsStore.getAll();
    assert.deepStrictEqual(all, { a: 1, b: 2 });
});

// ─────────────────────────────────────────────
// 2. MemoryProfiler
// ─────────────────────────────────────────────
console.log("\n[2] MemoryProfiler");

test("MemoryProfiler startet, samplet und liefert Daten", () => {
    const profiler = new MemoryProfiler({ intervalMs: 1000, maxSamples: 5 });
    assert.strictEqual(profiler.isRunning(), false);

    profiler.start();
    assert.strictEqual(profiler.isRunning(), true);

    const current = profiler.getCurrent();
    assert.ok(current, "Aktuelles Sample muss existieren");
    assert.ok(typeof current.rss === "number", "rss muss eine Zahl sein");
    assert.ok(typeof current.heapUsed === "number", "heapUsed muss eine Zahl sein");
    assert.ok(typeof current.heapTotal === "number", "heapTotal muss eine Zahl sein");
    assert.ok(typeof current.uptime === "number", "uptime muss eine Zahl sein");

    profiler.stop();
    assert.strictEqual(profiler.isRunning(), false);
    assert.strictEqual(profiler._timer, null, "Timer muss nach stop() null sein");
});

test("MemoryProfiler Ring-Buffer verwirft älteste Werte bei Erreichen von maxSamples", () => {
    const maxSamples = 3;
    const profiler = new MemoryProfiler({ intervalMs: 1000, maxSamples });
    profiler.start();

    // 5 Samples manuell triggern
    for (let i = 0; i < 5; i++) {
        profiler.sample();
    }
    profiler.stop();

    const history = profiler.getHistory();
    assert.strictEqual(history.length, maxSamples, `History darf maximal ${maxSamples} Elemente halten`);
});

test("MemoryProfiler Schwellenwert-Events werden bei Warnzustand ausgelöst", () => {
    const profiler = new MemoryProfiler({
        intervalMs: 10000,
        maxSamples: 5,
        warningMB: 1, // Niedriger Schwellenwert für Test (1MB)
        criticalMB: 10000
    });

    let warningFired = false;
    const onWarning = (payload) => {
        warningFired = true;
        assert.strictEqual(payload.level, "warning");
    };

    eventBus.on("diagnostics:memory-warning", onWarning);
    profiler.sample();
    eventBus.off("diagnostics:memory-warning", onWarning);

    assert.ok(warningFired, "diagnostics:memory-warning Event muss ausgelöst worden sein");
});

// ─────────────────────────────────────────────
// 3. ProcessProfiler (Vorbereitet, aber deaktiviert)
// ─────────────────────────────────────────────
console.log("\n[3] ProcessProfiler (Deaktiviert / Zero Overhead)");

test("ProcessProfiler bleibt im Normalbetrieb gestoppt (kein Timer, kein Overhead)", () => {
    const profiler = new ProcessProfiler();
    assert.strictEqual(profiler.isRunning(), false);
    assert.strictEqual(profiler._timer, null);
    assert.strictEqual(profiler.getHistory().length, 0);

    const status = profiler.getStatus();
    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.running, false);
});

test("ProcessProfiler kann bei Bedarf gestartet und gestoppt werden", () => {
    const profiler = new ProcessProfiler();
    profiler.start();
    assert.strictEqual(profiler.isRunning(), true);
    assert.ok(profiler.getCurrent().pid > 0);
    profiler.stop();
    assert.strictEqual(profiler.isRunning(), false);
    assert.strictEqual(profiler._timer, null);
});

// ─────────────────────────────────────────────
// 4. CPUProfiler (Vorbereitet, aber deaktiviert)
// ─────────────────────────────────────────────
console.log("\n[4] CPUProfiler (Deaktiviert / Zero Overhead)");

test("CPUProfiler bleibt im Normalbetrieb gestoppt (kein Timer, kein Overhead)", () => {
    const profiler = new CPUProfiler();
    assert.strictEqual(profiler.isRunning(), false);
    assert.strictEqual(profiler._timer, null);
    assert.strictEqual(profiler.getHistory().length, 0);

    const status = profiler.getStatus();
    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.running, false);
});

test("CPUProfiler kann bei Bedarf gestartet und gestoppt werden", () => {
    const profiler = new CPUProfiler();
    profiler.start();
    assert.strictEqual(profiler.isRunning(), true);
    assert.ok(profiler.getCurrent());
    profiler.stop();
    assert.strictEqual(profiler.isRunning(), false);
    assert.strictEqual(profiler._timer, null);
});

// ─────────────────────────────────────────────
// 5. DiagnosticsManager
// ─────────────────────────────────────────────
console.log("\n[5] DiagnosticsManager");

test("DiagnosticsManager startet nur aktivierte Profiler (Memory=true, Process=false, CPU=false)", () => {
    DiagnosticsManager.initialize();
    DiagnosticsManager.start();

    const status = DiagnosticsManager.getStatus();
    assert.strictEqual(status.config.profilers.memory, true, "MemoryProfiler muss aktiviert sein");
    assert.strictEqual(status.config.profilers.process, false, "ProcessProfiler muss deaktiviert sein");
    assert.strictEqual(status.config.profilers.cpu, false, "CPUProfiler muss deaktiviert sein");

    assert.strictEqual(status.memory.running, true, "MemoryProfiler muss laufen");
    assert.strictEqual(status.process.running, false, "ProcessProfiler darf NICHT laufen");
    assert.strictEqual(status.cpu.running, false, "CPUProfiler darf NICHT laufen");

    DiagnosticsManager.stop();
    const stoppedStatus = DiagnosticsManager.getStatus();
    assert.strictEqual(stoppedStatus.memory.running, false, "MemoryProfiler muss nach stop() beendet sein");
});

// ─────────────────────────────────────────────
// 6. BootupDiagnostics
// ─────────────────────────────────────────────
console.log("\n[6] BootupDiagnostics");

test("BootupDiagnostics zeichnet Start, Abschluss und Dauer von Schritten auf", () => {
    BootupDiagnostics.clear();

    BootupDiagnostics.markStart("test-step-1");
    BootupDiagnostics.markComplete("test-step-1", { info: "ok" });

    BootupDiagnostics.markStart("test-step-2");
    BootupDiagnostics.markFailed("test-step-2", new Error("Simulierter Fehler"));

    const summary = BootupDiagnostics.getSummary();
    assert.strictEqual(summary.stepCount, 2);
    assert.strictEqual(summary.completedCount, 1);
    assert.strictEqual(summary.failedCount, 1);

    const step1 = summary.steps.find(s => s.name === "test-step-1");
    assert.strictEqual(step1.status, "completed");
    assert.ok(typeof step1.durationMs === "number");

    const step2 = summary.steps.find(s => s.name === "test-step-2");
    assert.strictEqual(step2.status, "failed");
    assert.strictEqual(step2.error.name, "Error");
    assert.strictEqual(step2.error.message, "Simulierter Fehler");
});

test("BootupDiagnostics filtert sensible Informationen aus Step-Details", () => {
    BootupDiagnostics.clear();
    BootupDiagnostics.markStart("auth-step", {
        client_secret: "superSecretKey123",
        token: "ghp_1234567890abcdef",
        safeParam: "allowedValue"
    });

    const step = BootupDiagnostics.getSteps().find(s => s.name === "auth-step");
    assert.strictEqual(step.details.client_secret, "[REDACTED]");
    assert.strictEqual(step.details.token, "[REDACTED]");
    assert.strictEqual(step.details.safeParam, "allowedValue");
});

// ─────────────────────────────────────────────
// 7. CrashDumpWriter
// ─────────────────────────────────────────────
console.log("\n[7] CrashDumpWriter");

test("CrashDumpWriter erzeugt valides JSON und entfernt sensible Felder", () => {
    const testDump = {
        appVersion: "1.0.6-test",
        uptime: 42,
        reason: "uncaughtException",
        error: {
            message: "Failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and secret=topsecret",
            stack: "Error: at line 1"
        },
        config: {
            password: "plainPassword123",
            apiKey: "AIzaSyD-abc",
            normalSetting: "darkTheme"
        },
        credentials: "my-secret-vault",
        memory: {
            current: { rss: 123456 },
            history: [{ rss: 100000 }, { rss: 123456 }]
        }
    };

    const filePath = CrashDumpWriter.write(testDump);
    assert.ok(fs.existsSync(filePath), "Crash-Dump-Datei muss existieren");

    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.strictEqual(content.appVersion, "1.0.6-test");
    assert.strictEqual(content.config.password, "[REDACTED]");
    assert.strictEqual(content.config.apiKey, "[REDACTED]");
    assert.strictEqual(content.config.normalSetting, "darkTheme");
    assert.strictEqual(content.credentials, "[REDACTED]");
    assert.ok(content.error.message.includes("[REDACTED]"), "Bearer/Secret muss in String maskiert sein");
    assert.ok(!content.error.message.includes("topsecret"), "Klartext-Secret darf nicht vorhanden sein");
    assert.strictEqual(content.memory.history.length, 2, "Memory-Historie muss im Dump enthalten sein");

    // Aufräumen der Testdatei
    fs.unlinkSync(filePath);
});

// ─────────────────────────────────────────────
// 8. CrashHandler
// ─────────────────────────────────────────────
console.log("\n[8] CrashHandler");

test("CrashHandler generiert Crash-Dump bei handleCrash", () => {
    CrashHandler.initialize();

    const dumpPath = CrashHandler.handleCrash("uncaughtException", new Error("CrashHandler Testfehler"));
    assert.ok(dumpPath, "Crash-Dump-Pfad muss zurückgegeben werden");
    assert.ok(fs.existsSync(dumpPath), "Erzeugte Dump-Datei muss existieren");

    const content = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
    assert.strictEqual(content.reason, "uncaughtException");
    assert.strictEqual(content.error.message, "CrashHandler Testfehler");
    assert.ok(content.memory, "Dump muss Memory-Objekt enthalten");
    assert.ok(Array.isArray(content.bootup), "Dump muss Bootup-Schritte enthalten");

    // Aufräumen
    fs.unlinkSync(dumpPath);
    CrashHandler.shutdown();
});

// ─────────────────────────────────────────────
// 9. BootupDiagnostics UI-Hooks & Subscriptions
// ─────────────────────────────────────────────
console.log("\n[9] BootupDiagnostics UI-Hooks & Subscriptions");

test("onChange() erhält Bootup-Änderungen und liefert vollständigen State", () => {
    BootupDiagnostics.clear();

    const receivedStates = [];
    const unsubscribe = BootupDiagnostics.onChange((state) => {
        receivedStates.push(state);
    });

    BootupDiagnostics.start("audio-init");
    BootupDiagnostics.complete("audio-init", { volume: 80 });

    assert.ok(receivedStates.length >= 2, "onChange muss mindestens 2 Aktualisierungen erhalten haben");

    const latest = receivedStates[receivedStates.length - 1];
    assert.strictEqual(latest.started, true);
    assert.strictEqual(latest.completed, false);
    assert.strictEqual(latest.ready, false);
    assert.strictEqual(latest.current, "audio-init");
    assert.ok(Array.isArray(latest.steps));
    assert.strictEqual(latest.steps.length, 1);
    assert.strictEqual(latest.steps[0].status, "completed");

    unsubscribe();
});

test("Mehrere Subscriber funktionieren parallel", () => {
    BootupDiagnostics.clear();

    let countA = 0;
    let countB = 0;

    const unsubA = BootupDiagnostics.onChange(() => { countA++; });
    const unsubB = BootupDiagnostics.onChange(() => { countB++; });

    BootupDiagnostics.start("plugins-init");

    assert.strictEqual(countA, 1);
    assert.strictEqual(countB, 1);

    unsubA();
    unsubB();
});

test("Unsubscribe stoppt weitere Benachrichtigungen", () => {
    BootupDiagnostics.clear();

    let updates = 0;
    const unsubscribe = BootupDiagnostics.onChange(() => { updates++; });

    BootupDiagnostics.start("step-1");
    assert.strictEqual(updates, 1);

    unsubscribe();

    BootupDiagnostics.complete("step-1");
    assert.strictEqual(updates, 1, "Nach Unsubscribe dürfen keine weiteren Benachrichtigungen erfolgen");
});

test("offChange() entfernt Listener zuverlässig", () => {
    BootupDiagnostics.clear();

    let updates = 0;
    const listener = () => { updates++; };

    BootupDiagnostics.onChange(listener);
    BootupDiagnostics.start("step-2");
    assert.strictEqual(updates, 1);

    BootupDiagnostics.offChange(listener);
    BootupDiagnostics.complete("step-2");
    assert.strictEqual(updates, 1);
});

test("getCurrent(), getHistory() und isComplete() liefern korrekte Werte", () => {
    BootupDiagnostics.clear();
    assert.strictEqual(BootupDiagnostics.getCurrent(), null);
    assert.strictEqual(BootupDiagnostics.isComplete(), false);

    BootupDiagnostics.start("window-init");
    const current = BootupDiagnostics.getCurrent();
    assert.ok(current);
    assert.strictEqual(current.name, "window-init");
    assert.strictEqual(current.status, "started");

    const history = BootupDiagnostics.getHistory();
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].name, "window-init");
});

test("bootup:ready EventBus-Ereignis wird bei app-ready ausgelöst und isComplete wird true", () => {
    BootupDiagnostics.clear();

    let readyFired = false;
    let readyPayload = null;

    const onReady = (data) => {
        readyFired = true;
        readyPayload = data;
    };

    eventBus.on("bootup:ready", onReady);

    BootupDiagnostics.start("app-ready");
    assert.strictEqual(BootupDiagnostics.isComplete(), false);

    BootupDiagnostics.complete("app-ready");
    assert.strictEqual(BootupDiagnostics.isComplete(), true);
    assert.strictEqual(readyFired, true, "bootup:ready Event muss ausgelöst worden sein");
    assert.ok(readyPayload.summary);
    assert.strictEqual(readyPayload.state.ready, true);
    assert.strictEqual(readyPayload.state.completed, true);

    eventBus.off("bootup:ready", onReady);
});

test("Fehlerzustand bleibt im State und Events sanitisiert", () => {
    BootupDiagnostics.clear();

    let latestState = null;
    const unsub = BootupDiagnostics.onChange((state) => {
        latestState = state;
    });

    BootupDiagnostics.start("auth-step");
    BootupDiagnostics.fail("auth-step", new Error("Invalid token=secretToken123 with bearer eyJhbGci..."));

    assert.ok(latestState);
    const failedStep = latestState.steps.find(s => s.name === "auth-step");
    assert.strictEqual(failedStep.status, "failed");
    assert.ok(!failedStep.error.message.includes("secretToken123"), "Token darf nicht in Klartext enthalten sein");
    assert.ok(failedStep.error.message.includes("[REDACTED]"), "Token muss redacted sein");

    unsub();
});

test("step() generische Methode delegiert korrekt", () => {
    BootupDiagnostics.clear();

    BootupDiagnostics.step("init-step", "started");
    assert.strictEqual(BootupDiagnostics.getCurrent().status, "started");

    BootupDiagnostics.step("init-step", "completed", { status: "ok" });
    assert.strictEqual(BootupDiagnostics.getCurrent().status, "completed");

    BootupDiagnostics.step("fail-step", "failed", new Error("Generic fail"));
    const steps = BootupDiagnostics.getSteps();
    const failStep = steps.find(s => s.name === "fail-step");
    assert.strictEqual(failStep.status, "failed");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) {
    process.exit(1);
}
