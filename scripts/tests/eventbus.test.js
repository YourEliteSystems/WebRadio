"use strict";

/**
 * EventBus Regression Tests
 * 
 * Tests für BUG-005: EventBus.off() Wrapper-Zuordnung
 */

const EventBus = require("../../electron/core/eventBus");

console.log("==========================================");
console.log("🧪 EventBus Regression Tests");
console.log("==========================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ==========================================
// Test 1 – Normaler Listener
// ==========================================
console.log("\n[1] Normaler Listener Test");

let executionCount = 0;
const callback1 = () => { executionCount++; };

EventBus.on("test-event", callback1);
EventBus.emit("test-event");

test("Normaler Listener wird ausgeführt", () => {
  assertEquals(executionCount, 1, "Callback sollte einmal ausgeführt worden sein");
});

EventBus.off("test-event", callback1);
executionCount = 0;
EventBus.emit("test-event");

test("Normaler Listener wurde entfernt", () => {
  assertEquals(executionCount, 0, "Callback sollte nicht mehr ausgeführt werden");
});

// ==========================================
// Test 2 – Wrapped Listener (once())
// ==========================================
console.log("\n[2] Wrapped Listener (once) Test");

let executionCount2 = 0;
const callback2 = () => { executionCount2++; };

EventBus.once("test-event-once", callback2);
EventBus.emit("test-event-once");

test("once() Listener wird einmal ausgeführt", () => {
  assertEquals(executionCount2, 1, "Callback sollte einmal ausgeführt worden sein");
});

EventBus.emit("test-event-once");

test("once() Listener wird nicht erneut ausgeführt", () => {
  assertEquals(executionCount2, 1, "Callback sollte nicht erneut ausgeführt werden");
});

// ==========================================
// Test 3 – Wrapped Listener entfernen mit off()
// ==========================================
console.log("\n[3] Wrapped Listener mit off() Test");

let executionCount3 = 0;
const callback3 = () => { executionCount3++; };

EventBus.once("test-event-once-off", callback3);
EventBus.off("test-event-once-off", callback3);
EventBus.emit("test-event-once-off");

test("once() Listener kann mit off() entfernt werden", () => {
  assertEquals(executionCount3, 0, "Callback sollte nicht ausgeführt werden");
});

// ==========================================
// Test 4 – Mehrere Listener
// ==========================================
console.log("\n[4] Mehrere Listener Test");

let executionCount4a = 0;
let executionCount4b = 0;
let executionCount4c = 0;

const callback4a = () => { executionCount4a++; };
const callback4b = () => { executionCount4b++; };
const callback4c = () => { executionCount4c++; };

EventBus.on("test-multi", callback4a);
EventBus.on("test-multi", callback4b);
EventBus.on("test-multi", callback4c);

EventBus.emit("test-multi");

test("Alle drei Listener werden ausgeführt", () => {
  assertEquals(executionCount4a, 1, "Callback A sollte ausgeführt werden");
  assertEquals(executionCount4b, 1, "Callback B sollte ausgeführt werden");
  assertEquals(executionCount4c, 1, "Callback C sollte ausgeführt werden");
});

EventBus.off("test-multi", callback4b);
executionCount4a = 0;
executionCount4b = 0;
executionCount4c = 0;

EventBus.emit("test-multi");

test("Nur Callback B wurde entfernt", () => {
  assertEquals(executionCount4a, 1, "Callback A sollte noch ausgeführt werden");
  assertEquals(executionCount4b, 0, "Callback B sollte nicht ausgeführt werden");
  assertEquals(executionCount4c, 1, "Callback C sollte noch ausgeführt werden");
});

EventBus.off("test-multi", callback4a);
EventBus.off("test-multi", callback4c);

// ==========================================
// Test 5 – Gleicher Callback bei mehreren Registrierungen
// ==========================================
console.log("\n[5] Gleicher Callback mehrfach Test");

let executionCount5 = 0;
const callback5 = () => { executionCount5++; };

EventBus.on("test-dup", callback5);
EventBus.on("test-dup", callback5);

EventBus.emit("test-dup");

test("Doppelt registrierter Callback wird zweimal ausgeführt", () => {
  assertEquals(executionCount5, 2, "Callback sollte zweimal ausgeführt werden");
});

EventBus.off("test-dup", callback5);
executionCount5 = 0;

EventBus.emit("test-dup");

test("off() entfernt alle Instanzen desselben Callbacks", () => {
  assertEquals(executionCount5, 0, "Callback sollte nicht mehr ausgeführt werden");
});

// ==========================================
// Test 6 – Mehrere Events
// ==========================================
console.log("\n[6] Mehrere Events Test");

let executionCount6a = 0;
let executionCount6b = 0;
const callback6a = () => { executionCount6a++; };
const callback6b = () => { executionCount6b++; };

EventBus.on("event-a", callback6a);
EventBus.on("event-b", callback6b);

EventBus.off("event-a", callback6a);
executionCount6a = 0;
executionCount6b = 0;

EventBus.emit("event-a");
EventBus.emit("event-b");

test("off() entfernt nur für das spezifizierte Event", () => {
  assertEquals(executionCount6a, 0, "Event A sollte nicht ausgeführt werden");
  assertEquals(executionCount6b, 1, "Event B sollte noch ausgeführt werden");
});

EventBus.off("event-b", callback6b);

// ==========================================
// Test 7 – removeAllListeners
// ==========================================
console.log("\n[7] removeAllListeners Test");

let executionCount7a = 0;
let executionCount7b = 0;
const callback7a = () => { executionCount7a++; };
const callback7b = () => { executionCount7b++; };

EventBus.on("test-clear", callback7a);
EventBus.on("test-clear", callback7b);

EventBus.removeAllListeners("test-clear");
executionCount7a = 0;
executionCount7b = 0;

EventBus.emit("test-clear");

test("removeAllListeners entfernt alle Listener für ein Event", () => {
  assertEquals(executionCount7a, 0, "Callback A sollte nicht ausgeführt werden");
  assertEquals(executionCount7b, 0, "Callback B sollte nicht ausgeführt werden");
});

// ==========================================
// Test 8 – listenerCount
// ==========================================
console.log("\n[8] listenerCount Test");

const callback8a = () => {};
const callback8b = () => {};
const callback8c = () => {};

EventBus.on("test-count", callback8a);
EventBus.on("test-count", callback8b);
EventBus.on("test-count", callback8c);

test("listenerCount gibt korrekte Anzahl zurück", () => {
  assertEquals(EventBus.listenerCount("test-count"), 3, "Sollte 3 Listener haben");
});

EventBus.off("test-count", callback8b);

test("listenerCount nach Entfernung aktualisiert", () => {
  assertEquals(EventBus.listenerCount("test-count"), 2, "Sollte 2 Listener haben");
});

EventBus.removeAllListeners("test-count");

// ==========================================
// Test 9 – eventNames
// ==========================================
console.log("\n[9] eventNames Test");

EventBus.on("test-names-1", () => {});
EventBus.on("test-names-2", () => {});

test("eventNames gibt alle registrierten Events zurück", () => {
  const names = EventBus.eventNames();
  assert(names.includes("test-names-1"), "Event 1 sollte in der Liste sein");
  assert(names.includes("test-names-2"), "Event 2 sollte in der Liste sein");
});

EventBus.removeAllListeners("test-names-1");
EventBus.removeAllListeners("test-names-2");

// ==========================================
// Ergebnis
// ==========================================
console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
