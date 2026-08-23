"use strict";

const assert = require("assert");
const NavigationRegistry = require("../../electron/core/navigation/NavigationRegistry");
const NavigationValidator = require("../../electron/core/navigation/NavigationValidator");
const NavigationManager = require("../../electron/core/navigation/NavigationManager");
const PluginAPI = require("../../electron/core/plugins/PluginAPI");
const PluginPermissions = require("../../electron/core/plugins/PluginPermissions");

console.log("==========================================");
console.log("🧪 Starte Dynamische Navigation API Tests");
console.log("==========================================");

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     Error: ${err.message}`);
        testsFailed++;
    }
}

// ─────────────────────────────────────────────────────────────
// 1. Validator Tests
// ─────────────────────────────────────────────────────────────
console.log("\n[1] NavigationValidator Tests");

test("Validiert korrekte Section mit allen Optionen", () => {
    const res = NavigationValidator.validateSection({
        id: "my-tools",
        label: "Meine Tools",
        icon: "tools",
        collapsible: true,
        expanded: false,
        order: 20,
        visible: true
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
});

test("Erkennt ungültige Section ohne ID / Label", () => {
    const res = NavigationValidator.validateSection({});
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("id")));
    assert.ok(res.errors.some(e => e.includes("label")));
});

test("Validiert Top-Level Item (ohne parent)", () => {
    const res = NavigationValidator.validateItem({
        id: "quick-search",
        label: "Schnellsuche",
        order: 5
    });
    assert.strictEqual(res.valid, true);
});

test("Validiert Item mit parent", () => {
    const res = NavigationValidator.validateItem({
        id: "converter",
        parent: "my-tools",
        label: "Konverter"
    });
    assert.strictEqual(res.valid, true);
});

// ─────────────────────────────────────────────────────────────
// 2. Core Initialisierung (Ohne automatische Navigation)
// ─────────────────────────────────────────────────────────────
console.log("\n[2] Core Initialisierung");

test("Core startet ohne automatische Navigation-Einträge", () => {
    NavigationRegistry.clearAll();
    NavigationManager.initialized = false;
    NavigationManager.initialize();

    const tree = NavigationManager.getTree();
    assert.strictEqual(tree.sections.length, 0, "Core darf keine Sections per Default anlegen");
    assert.strictEqual(tree.topLevelItems.length, 0, "Core darf keine Top-Level Items per Default anlegen");
});

// ─────────────────────────────────────────────────────────────
// 3. Plugin Navigation Registrierung & Hierarchie
// ─────────────────────────────────────────────────────────────
console.log("\n[3] Plugin-gesteuerte Navigation");

test("Plugin registriert ein einzelnes Top-Level Item", () => {
    const item = NavigationRegistry.registerItem({
        id: "my-radio-tools",
        label: "Radio Tools",
        icon: "radio",
        route: "my-radio-tools",
        order: 20
    }, "plugin-tools");

    assert.strictEqual(item.id, "my-radio-tools");
    assert.strictEqual(item.parent, null);
    assert.strictEqual(item.ownerPluginId, "plugin-tools");
});

test("Plugin registriert eigene Section", () => {
    const sec = NavigationRegistry.registerSection({
        id: "custom-section-a",
        label: "Plugin A Bereich",
        collapsible: true,
        expanded: false,
        order: 30
    }, "plugin-a");

    assert.strictEqual(sec.id, "custom-section-a");
    assert.strictEqual(sec.ownerPluginId, "plugin-a");
    assert.strictEqual(sec.collapsible, true);
    assert.strictEqual(sec.expanded, false);
});

test("Plugin registriert Unterpunkte in eigener Section", () => {
    const it1 = NavigationRegistry.registerItem({
        id: "plugin-a-music",
        parent: "custom-section-a",
        label: "Meine Musik",
        order: 1
    }, "plugin-a");

    const it2 = NavigationRegistry.registerItem({
        id: "plugin-a-podcasts",
        parent: "custom-section-a",
        label: "Meine Podcasts",
        order: 2
    }, "plugin-a");

    assert.strictEqual(it1.parent, "custom-section-a");
    assert.strictEqual(it2.parent, "custom-section-a");
});

test("Fehler bei Item unter nicht-existierender Section", () => {
    assert.throws(() => {
        NavigationRegistry.registerItem({
            id: "orphan",
            parent: "non-existent",
            label: "Orphan Item"
        }, "plugin-a");
    }, /Parent-Section "non-existent" existiert nicht/);
});

test("Navigations-Baum Struktur & Sortierung", () => {
    const tree = NavigationRegistry.getTree();
    assert.strictEqual(tree.topLevelItems.length, 1);
    assert.strictEqual(tree.topLevelItems[0].id, "my-radio-tools");

    assert.strictEqual(tree.sections.length, 1);
    assert.strictEqual(tree.sections[0].id, "custom-section-a");
    assert.strictEqual(tree.sections[0].items.length, 2);
    assert.strictEqual(tree.sections[0].items[0].id, "plugin-a-music");
    assert.strictEqual(tree.sections[0].items[1].id, "plugin-a-podcasts");
});

// ─────────────────────────────────────────────────────────────
// 4. Isolation & Duplicate Protection
// ─────────────────────────────────────────────────────────────
console.log("\n[4] Isolation & Duplicate Protection");

test("Plugin B kann Section von Plugin A nicht überschreiben", () => {
    assert.throws(() => {
        NavigationRegistry.registerSection({
            id: "custom-section-a",
            label: "Fake Section"
        }, "plugin-b");
    }, /existiert bereits und gehört "plugin-a"/);
});

test("Plugin B kann Item von Plugin A nicht überschreiben", () => {
    assert.throws(() => {
        NavigationRegistry.registerItem({
            id: "plugin-a-music",
            parent: "custom-section-a",
            label: "Fake Music"
        }, "plugin-b");
    }, /existiert bereits und gehört "plugin-a"/);
});

test("Plugin B kann Item von Plugin A nicht via updateItem modifizieren", () => {
    assert.throws(() => {
        NavigationRegistry.updateItem("plugin-a-music", {
            label: "Gehackt"
        }, "plugin-b");
    }, /Keine Berechtigung/);
});

// ─────────────────────────────────────────────────────────────
// 5. Plugin Lifecycle Cleanup
// ─────────────────────────────────────────────────────────────
console.log("\n[5] Plugin Lifecycle Cleanup");

test("Stoppen von Plugin A entfernt nur dessen Einträge; Plugin B bleibt intakt", () => {
    // Plugin B registriert Section + Item
    NavigationRegistry.registerSection({
        id: "plugin-b-sec",
        label: "Section B",
        order: 50
    }, "plugin-b");

    NavigationRegistry.registerItem({
        id: "plugin-b-item",
        parent: "plugin-b-sec",
        label: "Item B"
    }, "plugin-b");

    // Plugin-A stoppen
    NavigationRegistry.clearPlugin("plugin-a");

    // Plugin-A Einträge müssen weg sein
    assert.strictEqual(NavigationRegistry.getSection("custom-section-a"), null);
    assert.strictEqual(NavigationRegistry.getItem("plugin-a-music"), null);
    assert.strictEqual(NavigationRegistry.getItem("plugin-a-podcasts"), null);

    // Plugin-Tools und Plugin-B Einträge müssen erhalten bleiben!
    assert.strictEqual(NavigationRegistry.getItem("my-radio-tools") !== null, true);
    assert.strictEqual(NavigationRegistry.getSection("plugin-b-sec") !== null, true);
    assert.strictEqual(NavigationRegistry.getItem("plugin-b-item") !== null, true);
});

// ─────────────────────────────────────────────────────────────
// 6. Permissions & PluginAPI
// ─────────────────────────────────────────────────────────────
console.log("\n[6] Permissions & PluginAPI");

test("Plugin mit 'navigation' Berechtigung kann Sections & Items anlegen", () => {
    const api = PluginAPI.create({
        id: "authorized-plugin",
        name: "Authorized Plugin",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    const sec = api.navigation.registerSection({
        id: "auth-section",
        label: "Auth Section"
    });
    assert.strictEqual(sec.id, "auth-section");
    assert.strictEqual(sec.ownerPluginId, "authorized-plugin");

    const it = api.navigation.registerItem({
        id: "auth-item",
        label: "Auth Top-Level Item"
    });
    assert.strictEqual(it.id, "auth-item");
});

test("Plugin ohne 'navigation' Berechtigung wird blockiert", () => {
    const api = PluginAPI.create({
        id: "unauthorized-plugin",
        name: "Unauthorized Plugin",
        version: "1.0.0",
        permissions: ["events", "storage"]
    });

    assert.throws(() => {
        api.navigation.registerItem({
            id: "unauth-item",
            label: "Unauth Item"
        });
    }, /benötigt die Berechtigung "navigation"/);
});

// ─────────────────────────────────────────────────────────────
// 7. removeSection
// ─────────────────────────────────────────────────────────────
console.log("\n[7] removeSection");

test("Plugin kann eigene Section per removeSection entfernen", () => {
    const api = PluginAPI.create({
        id: "section-remover",
        name: "Section Remover",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    api.navigation.registerSection({ id: "temp-sec", label: "Temp" });
    api.navigation.registerItem({ id: "temp-item", parent: "temp-sec", label: "Temp Item" });

    const result = api.navigation.removeSection("temp-sec");
    assert.strictEqual(result, true);

    const tree = NavigationManager.getTree();
    assert.strictEqual(tree.sections.find(s => s.id === "temp-sec"), undefined);
    assert.strictEqual(NavigationManager.getItems("temp-sec").length, 0);
});

test("removeSection auf nicht-existenter Section gibt false zurück", () => {
    const api = PluginAPI.create({
        id: "section-remover-2",
        name: "Section Remover 2",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    const result = api.navigation.removeSection("non-existent");
    assert.strictEqual(result, false);
});

test("Plugin kann Section eines anderen Plugins nicht entfernen", () => {
    const apiA = PluginAPI.create({
        id: "protect-a",
        name: "Protect A",
        version: "1.0.0",
        permissions: ["navigation"]
    });
    const apiB = PluginAPI.create({
        id: "protect-b",
        name: "Protect B",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    apiA.navigation.registerSection({ id: "protected-sec", label: "Protected" });
    assert.throws(() => {
        apiB.navigation.removeSection("protected-sec");
    }, /Keine Berechtigung/);
});

// ─────────────────────────────────────────────────────────────
// 8. Visibility & Disabled
// ─────────────────────────────────────────────────────────────
console.log("\n[8] Visibility & Disabled");

test("visible: false Items werden aus Tree ausgeschlossen", () => {
    const api = PluginAPI.create({
        id: "vis-test",
        name: "Vis Test",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    api.navigation.registerItem({ id: "vis-top", label: "Visible Top", visible: true });
    api.navigation.registerItem({ id: "hidden-top", label: "Hidden Top", visible: false });

    const tree = NavigationManager.getTree();
    assert.ok(tree.topLevelItems.some(i => i.id === "vis-top"));
    assert.ok(!tree.topLevelItems.some(i => i.id === "hidden-top"));

    NavigationManager.removeItem("vis-top", "vis-test");
    NavigationManager.removeItem("hidden-top", "vis-test");
});

test("disabled: true Items sind im Tree als disabled markiert", () => {
    const api = PluginAPI.create({
        id: "disabled-test",
        name: "Disabled Test",
        version: "1.0.0",
        permissions: ["navigation"]
    });

    api.navigation.registerItem({ id: "disabled-item", label: "Disabled", disabled: true });
    const tree = NavigationManager.getTree();
    const item = tree.topLevelItems.find(i => i.id === "disabled-item");
    assert.strictEqual(item.disabled, true);

    NavigationManager.removeItem("disabled-item", "disabled-test");
});

test("visible: false Sections werden aus Tree ausgeschlossen", () => {
    NavigationRegistry.registerSection({
        id: "hidden-sec",
        label: "Hidden Section",
        visible: false
    }, "core-test");

    const tree = NavigationManager.getTree();
    assert.ok(!tree.sections.some(s => s.id === "hidden-sec"));

    NavigationRegistry.removeSection("hidden-sec", "core-test");
});

// ─────────────────────────────────────────────────────────────
// 9. Collapsible & Expanded
// ─────────────────────────────────────────────────────────────
console.log("\n[9] Collapsible & Expanded");

test("Section mit collapsible: false", () => {
    NavigationRegistry.registerSection({
        id: "no-collapse",
        label: "No Collapse",
        collapsible: false,
        expanded: true
    }, "core-test");

    const sec = NavigationRegistry.getSection("no-collapse");
    assert.strictEqual(sec.collapsible, false);

    NavigationRegistry.removeSection("no-collapse", "core-test");
});

test("Section mit expanded: false startet eingeklappt", () => {
    NavigationRegistry.registerSection({
        id: "start-collapsed",
        label: "Start Collapsed",
        expanded: false
    }, "core-test");

    const sec = NavigationRegistry.getSection("start-collapsed");
    assert.strictEqual(sec.expanded, false);

    NavigationRegistry.removeSection("start-collapsed", "core-test");
});

// ─────────────────────────────────────────────────────────────
// 10. Order-Sortierung
// ─────────────────────────────────────────────────────────────
console.log("\n[10] Order-Sortierung");

test("Items werden nach order sortiert", () => {
    NavigationRegistry.registerSection({ id: "order-sec", label: "Order Test" }, "core-test");
    NavigationRegistry.registerItem({ id: "order-c", parent: "order-sec", label: "C", order: 30 }, "core-test");
    NavigationRegistry.registerItem({ id: "order-a", parent: "order-sec", label: "A", order: 10 }, "core-test");
    NavigationRegistry.registerItem({ id: "order-b", parent: "order-sec", label: "B", order: 20 }, "core-test");

    const tree = NavigationManager.getTree();
    const sec = tree.sections.find(s => s.id === "order-sec");
    assert.strictEqual(sec.items[0].id, "order-a");
    assert.strictEqual(sec.items[1].id, "order-b");
    assert.strictEqual(sec.items[2].id, "order-c");

    NavigationRegistry.removeSection("order-sec", "core-test");
});

test("Top-Level Items werden nach order sortiert", () => {
    NavigationRegistry.registerItem({ id: "tl-c", label: "TL C", order: 30 }, "core-test");
    NavigationRegistry.registerItem({ id: "tl-a", label: "TL A", order: 10 }, "core-test");
    NavigationRegistry.registerItem({ id: "tl-b", label: "TL B", order: 20 }, "core-test");

    const tree = NavigationManager.getTree();
    const tlIds = tree.topLevelItems.map(i => i.id);
    const idxA = tlIds.indexOf("tl-a");
    const idxB = tlIds.indexOf("tl-b");
    const idxC = tlIds.indexOf("tl-c");
    assert.ok(idxA < idxB, "tl-a (order 10) muss vor tl-b (order 20) kommen");
    assert.ok(idxB < idxC, "tl-b (order 20) muss vor tl-c (order 30) kommen");

    NavigationRegistry.removeItem("tl-c", "core-test");
    NavigationRegistry.removeItem("tl-a", "core-test");
    NavigationRegistry.removeItem("tl-b", "core-test");
});

// ─────────────────────────────────────────────────────────────
// Zusammenfassung
// ─────────────────────────────────────────────────────────────
console.log("\n==========================================");
console.log(`Ergebnis: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen.`);
console.log("==========================================");

if (testsFailed > 0) {
    process.exit(1);
}
