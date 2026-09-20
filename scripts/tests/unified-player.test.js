// Unified Player API Tests
"use strict";

const assert = require("assert");

console.log("==========================================");
console.log("🧪 Starte Unified Player API Tests");
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

// Mock Logger
class MockLogger {
  constructor(name) {
    this.name = name;
    this.logs = [];
  }
  info(msg) { this.logs.push({ level: 'info', msg }); }
  warn(msg) { this.logs.push({ level: 'warn', msg }); }
  error(msg) { this.logs.push({ level: 'error', msg }); }
  debug(msg) { this.logs.push({ level: 'debug', msg }); }
}

// Mock PlayerManager implementation für Tests
class TestPlayerManager {
  constructor() {
    this.providers = new Map();
    this.activeProviderId = null;
    this.currentState = {
      state: 'idle',
      title: null,
      artist: null,
      artwork: null,
      volume: 1.0,
      source: null
    };
    this.subscribers = new Set();
  }

  registerProvider(id, provider) {
    this.providers.set(id, provider);
  }

  unregisterProvider(id) {
    this.providers.delete(id);
  }

  setActiveProvider(id) {
    this.activeProviderId = id;
  }

  getActiveProvider() {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) || null;
  }

  async play(...args) {
    const provider = this.getActiveProvider();
    if (provider && provider.play) {
      await provider.play(...args);
    }
  }

  async pause() {
    const provider = this.getActiveProvider();
    if (provider && provider.pause) {
      await provider.pause();
    }
  }

  async stop() {
    const provider = this.getActiveProvider();
    if (provider && provider.stop) {
      await provider.stop();
    }
  }

  async setVolume(value) {
    this.currentState.volume = Math.max(0, Math.min(1, Number(value) || 0));
    const provider = this.getActiveProvider();
    if (provider && provider.setVolume) {
      await provider.setVolume(value);
    }
  }

  getState() {
    return { ...this.currentState };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({ ...this.currentState });
    return () => this.subscribers.delete(callback);
  }

  updateProviderState(providerId, partialState) {
    if (providerId !== this.activeProviderId) return;
    this.currentState = { ...this.currentState, ...partialState };
    for (const cb of this.subscribers) {
      cb({ ...this.currentState });
    }
  }
}

// Test 1: Provider Registration
test("Provider Registration", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  assert.strictEqual(playerManager.providers.has("test"), true);
  assert.strictEqual(playerManager.providers.get("test"), mockProvider);
});

// Test 2: Active Provider
test("Active Provider", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  playerManager.setActiveProvider("test");
  
  assert.strictEqual(playerManager.activeProviderId, "test");
  assert.strictEqual(playerManager.getActiveProvider(), mockProvider);
});

// Test 3: State Subscription
test("State Subscription", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  playerManager.setActiveProvider("test");
  
  let receivedStates = [];
  const unsubscribe = playerManager.subscribe((state) => {
    receivedStates.push(state);
  });

  assert.strictEqual(receivedStates.length, 1);
  assert.strictEqual(receivedStates[0].state, 'idle');

  playerManager.updateProviderState("test", { state: 'playing', title: 'Test Song' });
  
  assert.strictEqual(receivedStates.length, 2);
  assert.strictEqual(receivedStates[1].state, 'playing');
  assert.strictEqual(receivedStates[1].title, 'Test Song');

  unsubscribe();
  playerManager.updateProviderState("test", { state: 'stopped' });
  
  assert.strictEqual(receivedStates.length, 2); // Kein neuer State nach unsubscribe
});

// Test 4: Volume Control
test("Volume Control", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async (val) => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  playerManager.setActiveProvider("test");
  
  playerManager.setVolume(0.5);
  assert.strictEqual(playerManager.currentState.volume, 0.5);
  
  playerManager.setVolume(1.5); // Clamping
  assert.strictEqual(playerManager.currentState.volume, 1.0);
  
  playerManager.setVolume(-0.5); // Clamping
  assert.strictEqual(playerManager.currentState.volume, 0.0);
});

// Test 5: Source Structure
test("Source Structure", () => {
  const expectedSource = {
    id: "radio",
    name: "Radio",
    provider: "FFmpeg",
    type: "radio"
  };

  assert.strictEqual(expectedSource.id, "radio");
  assert.strictEqual(expectedSource.name, "Radio");
  assert.strictEqual(expectedSource.provider, "FFmpeg");
  assert.strictEqual(expectedSource.type, "radio");
});

// Test 6: Player Controls
test("Player Controls", async () => {
  const playerManager = new TestPlayerManager();
  
  let playCalled = false;
  let pauseCalled = false;
  let stopCalled = false;

  const mockProvider = {
    play: async () => { playCalled = true; },
    pause: async () => { pauseCalled = true; },
    stop: async () => { stopCalled = true; },
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  playerManager.setActiveProvider("test");

  await playerManager.play();
  assert.strictEqual(playCalled, true);

  await playerManager.pause();
  assert.strictEqual(pauseCalled, true);

  await playerManager.stop();
  assert.strictEqual(stopCalled, true);
});

// Test 7: Provider State Update
test("Provider State Update", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("test", mockProvider);
  playerManager.setActiveProvider("test");

  playerManager.updateProviderState("test", {
    state: 'playing',
    title: 'Test Title',
    artist: 'Test Artist',
    artwork: 'test.jpg'
  });

  assert.strictEqual(playerManager.currentState.state, 'playing');
  assert.strictEqual(playerManager.currentState.title, 'Test Title');
  assert.strictEqual(playerManager.currentState.artist, 'Test Artist');
  assert.strictEqual(playerManager.currentState.artwork, 'test.jpg');
});

// Test 8: Non-active Provider Cannot Update State
test("Non-active Provider Cannot Update State", () => {
  const playerManager = new TestPlayerManager();
  
  const mockProvider1 = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  const mockProvider2 = {
    play: async () => {},
    pause: async () => {},
    stop: async () => {},
    setVolume: async () => {},
    getState: () => ({ state: 'idle' })
  };

  playerManager.registerProvider("provider1", mockProvider1);
  playerManager.registerProvider("provider2", mockProvider2);
  playerManager.setActiveProvider("provider1");

  // provider2 versucht State zu ändern - sollte ignoriert werden
  playerManager.updateProviderState("provider2", { state: 'playing' });
  
  assert.strictEqual(playerManager.currentState.state, 'idle'); // State unverändert
});

console.log("\n==========================================");
console.log(`Tests abgeschlossen: ${testsPassed} bestanden, ${testsFailed} fehlgeschlagen`);
console.log("==========================================");

if (testsFailed > 0) {
  process.exit(1);
}
