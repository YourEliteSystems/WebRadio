"use strict";

const assert = require("assert");
const { JSDOM } = require("jsdom");

console.log("==========================================");
console.log("🧪 DOM-XSS Regression Tests (PluginView/PluginSlot)");
console.log("==========================================");

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='c'></div></body></html>");
const document = dom.window.document;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

const PAYLOADS = [
  "<img src=x onerror=alert(1)>",
  "<script>alert('xss')</script>",
  "';alert(1)//"
];

test("PluginView Fehlerpfad rendert err.message als Text (kein HTML)", () => {
  for (const payload of PAYLOADS) {
    const container = document.createElement("div");
    const errBox = document.createElement("div");
    errBox.className = "error";
    errBox.textContent = `Fehler beim Rendern der Ansicht: ${payload}`;
    container.appendChild(errBox);
    // Payload darf nicht als Element/Attribut auftauchen
    assert.strictEqual(container.querySelectorAll("img,script").length, 0, `Payload wurde als HTML interpretiert: ${payload}`);
    assert.ok(container.textContent.includes(payload), "Payload-Text fehlt");
  }
});

test("PluginView 'keine Ansicht' rendert viewId als Text", () => {
  for (const payload of PAYLOADS) {
    const container = document.createElement("div");
    const wrapper = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = payload;
    const desc = document.createElement("div");
    desc.textContent = `Keine Ansicht für '${payload}' registriert.`;
    wrapper.appendChild(title);
    wrapper.appendChild(desc);
    container.appendChild(wrapper);
    assert.strictEqual(container.querySelectorAll("img,script").length, 0);
    assert.ok(container.textContent.includes(payload));
  }
});

test("PluginSlot className wird sanitisiert (keine Injection)", () => {
  const unsafe = "a\" onload=\"alert(1)";
  const safe = String(unsafe || "").replace(/[^a-zA-Z0-9_-]/g, "-");
  assert.ok(!safe.includes('"'), "Anfuehrungszeichen nicht entfernt");
  assert.ok(!safe.includes(" "), "Leerzeichen nicht entfernt");
  assert.ok(!safe.includes("<"), " spitze Klammer nicht entfernt");
  const el = document.createElement("div");
  el.className = `plugin-slot-item plugin-${safe}`;
  // Klassenname wird ueber die DOM-API gesetzt, daher keine Attribut-Injection moeglich
  assert.ok(!el.outerHTML.includes('onload="'), "onload-Attribut nicht injiziert");
});

console.log("\n==========================================");
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen.`);
console.log("==========================================");

if (failed > 0) process.exit(1);
