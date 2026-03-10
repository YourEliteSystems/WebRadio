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

  // PCM-Daten aus dem Main-Prozess
  window.radioAPI.onPCM(chunk => {
    if(!(chunk instanceof Float32Array)) {
      // chunk MUSS Float32Array sein, da der PCM-Processor dies erwartet
      workletNode.port.postMessage(chunk);
      return;
    }

    if (!primed && ctx.state !== "running") {
      ctx.resume();
      primed = true;
    }
  });

  started = true;
}

export async function switchStream(url) {
  if(!url) return;
  if(url === currentStation){ console.warn("Already playing this station"); return; }
  if(switching){ console.warn("Already switching streams"); return; }
  
  switching = true;

  try {
    if(ctx.state !== "running") await ctx.resume();

    // Crossfade über 3 Sekunden
    const now = ctx.currentTime;
    const fadeTime = 0.3;

    const nextGainNode = activeGainNode === gainA ? gainB : gainA;
    activeGainNode.gain.cancelScheduledValues(now);
    nextGainNode.gain.cancelScheduledValues(now);

    activeGainNode.gain.setValueAtTime(1.0, now);
    activeGainNode.gain.linearRampToValueAtTime(0, now + fadeTime);

    nextGainNode.gain.setValueAtTime(0, now);
    nextGainNode.gain.linearRampToValueAtTime(1.0, now + fadeTime);

    window.radioAPI.startStream(url);

    activeGainNode = nextGainNode;
  } catch (err) {
    console.error("Error switching stream:", err);
  }

  setTimeout(() => {
    switching = false;
  },800); // Sicherstellen, dass der Wechsel
}

export async function playStream(url) {
  if (!started) throw new Error("Player not initialized");
  if (ctx.state !== "running") {
    await ctx.resume();
  }
  gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
  window.radioAPI.startStream(url);
}

export function stopStream() {
  if (!started) return;

  window.radioAPI.stopStream?.();
}

export function setVolume(value) {
  if (!ctx || ctx.state !== "running" || !gainNode) return;
  const vol = Math.max(0, Math.min(1, value));
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.01);
}

export function getAnalyser() {
  return analyser;
}
