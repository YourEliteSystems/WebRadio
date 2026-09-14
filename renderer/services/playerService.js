let ctx;
let workletNode;
let gainNode;
let gainA,gainB;
let activeGainNode;
let analyser;
let started = false;
let primed = false; // Flag, um zu verhindern, dass ctx.resume() mehrfach aufgerufen wird
let initialized = false;
let currentStation = null;
let switching = false;

let limiter;

// Zuletzt vom AudioWorklet gemeldete Diagnose-Werte (Bedarfsabfrage)
let lastWorkletStats = null;
let statsRequestId = 0;


export async function initPlayer() {
  if (initialized) return;

  initialized = true;

  ctx = new AudioContext({ sampleRate: 48000 });

  await ctx.audioWorklet.addModule("worklets/pcm-processor.js");

  workletNode = new AudioWorkletNode(ctx, "pcm-processor", {
    numberOfOutputs: 1,
    outputChannelCount: [2] // Stereo
  });


  //Gain Nodes (for crossfading)
  gainA = ctx.createGain();
  gainB = ctx.createGain();
  gainA.gain.value = 1.0;
  gainB.gain.value = 0.0;
  activeGainNode = gainA;


  gainNode = ctx.createGain();
  gainNode.gain.value = 1.0;

  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-6, ctx.currentTime); // Sehr niedrig, damit er fast immer greift
  limiter.knee.setValueAtTime(0, ctx.currentTime); // Harte Kompression
  limiter.ratio.setValueAtTime(20, ctx.currentTime);
  limiter.attack.setValueAtTime(0.001, ctx.currentTime); // Sehr schnelle Attack-Zeit
  limiter.release.setValueAtTime(0.1, ctx.currentTime); // Relativ schnelle Release-Zeit

  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  workletNode
    .connect(gainNode)
    .connect(limiter)
    .connect(analyser)
    .connect(ctx.destination);

  // Diagnose-Antworten des AudioWorklets entgegennehmen (nur bei Bedarf angefordert)
  workletNode.port.onmessage = e => {
    const reply = e.data;
    if (reply && typeof reply === "object" && reply.type === "stats") {
      lastWorkletStats = reply;
    }
  };

  // PCM-Daten (ArrayBuffer) immer an den AudioWorklet durchreichen.
  // Der Worklet verarbeitet sowohl PCM-Binärdaten als auch Kontrollnachrichten
  // (flush/stats). Kein stilles Verwerfen bei unerwarteten Typen.
  window.radioAPI.onPCM(chunk => {
    workletNode.port.postMessage(chunk);

    if (!primed && ctx.state !== "running") {
      ctx.resume();
      primed = true;
    }
  });

  started = true;
}

export async function switchStream(url, station = null) {
  if(!url) return;
  if(url === currentStation){ window.api?.log("warn", "PlayerService", "Already playing this station"); return; }
  if(switching){ window.api?.log("warn", "PlayerService", "Already switching streams"); return; }

  switching = true;

  try {
    if(ctx.state !== "running") await ctx.resume();

    // Crossfade über 0.3 Sekunden
    const now = ctx.currentTime;
    const fadeTime = 0.3;

    const nextGainNode = activeGainNode === gainA ? gainB : gainA;
    activeGainNode.gain.cancelScheduledValues(now);
    nextGainNode.gain.cancelScheduledValues(now);

    activeGainNode.gain.setValueAtTime(1.0, now);
    activeGainNode.gain.linearRampToValueAtTime(0, now + fadeTime);

    nextGainNode.gain.setValueAtTime(0, now);
    nextGainNode.gain.linearRampToValueAtTime(1.0, now + fadeTime);

    // Ensure main volume gainNode maintains current volume during switch
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(currentVolume, now);
    }

    await window.radioAPI.startStream(url, station);
    // Alten Stream-Puffer im Worklet verwerfen, damit keine Samples der
    // vorherigen Station mit der neuen vermischt werden.
    flushAudioBuffer();

    activeGainNode = nextGainNode;
  } catch (err) {
    window.api?.log("error", "PlayerService", `Error switching stream: ${err.message}`);
  }

  setTimeout(() => {
    switching = false;
  },800); // Sicherstellen, dass der Wechsel
}

let currentVolume = 1.0;

export async function playStream(url, station = null) {
  if (!started) throw new Error("Player not initialized");
  if (ctx.state !== "running") {
    await ctx.resume();
  }
  gainNode.gain.setValueAtTime(currentVolume, ctx.currentTime);
  await window.radioAPI.startStream(url, station);
  flushAudioBuffer();
}

export async function stopPlayer() {
  if (window.radioAPI && window.radioAPI.stopStream) {
    await window.radioAPI.stopStream();
  }
  // Buffer im Worklet leeren, damit nach erneutem Play kein Rest alt läuft.
  flushAudioBuffer();
  if (ctx && ctx.state === "running") {
    await ctx.suspend();
  }
}

export function flushAudioBuffer() {
  if (workletNode && workletNode.port) {
    workletNode.port.postMessage({ type: "flush" });
  }
}

// Bedarfsgetriebene Diagnose: fragt den Worklet einmalig nach seinen
// Zählern (underruns, overruns, Pufferfüllstand, ...). Kein Polling-Loop.
export async function getAudioDiagnostics() {
  if (!workletNode || !workletNode.port) return null;

  const requestId = ++statsRequestId;
  workletNode.port.postMessage({ type: "stats", requestId });

  const deadline = Date.now() + 75;
  while (Date.now() < deadline) {
    if (lastWorkletStats && lastWorkletStats.requestId === requestId) {
      return lastWorkletStats;
    }
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  return lastWorkletStats;
}

// Für preload/radioAPI.getAudioDiagnostics(): der Renderer liefert die
// Worklet-Werte beim Aufruf einmalig mit an den Main-Prozess.
window.__webradioAudioDiagnostics = getAudioDiagnostics;

export function setVolume(value) {
  if (!ctx || ctx.state !== "running" || !gainNode) return;
  const vol = Math.max(0, Math.min(1, value));
  currentVolume = vol;
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.01);
}

export function getAnalyser() {
  return analyser;
}