class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.state = "refill"; // "refill" = Stille bis Vorpuffer gefüllt, "playing" = PCM ausgeben

    // Diagnose-Zähler – Abruf nur bei Bedarf über die "stats"-Nachricht (kein Polling)
    this.underrunCount = 0;
    this.overrunCount = 0;
    this.totalChunks = 0;
    this.totalSamples = 0;
    this.processCount = 0;
    this.flushCount = 0;

    // Vorpuffer gegen IPC-/Renderer-Jitter: 200 ms bei 48 kHz Stereo.
    // 48000 Frames/s * 2 Kanäle * 0,2 s = 19.200 Samples.
    // Auf diese Weise überlebt der Audiopfad kurzzeitige Renderer-Last
    // bzw. GC-Pausen, ohne dass Blöcke wiederholt oder übersprungen werden.
    this.preBufferSamples = 19200;

    this.port.onmessage = e => {
      const data = e.data;

      // Kontrollnachrichten vom Renderer (Flush/Stats) – rein bedarfsgetrieben.
      if (data && typeof data === "object" && data.type) {
        if (data.type === "flush") {
          // Stream-Wechsel/Stop: alten Stream-Puffer verwerfen.
          this.buffer = new Float32Array(0);
          this.state = "refill";
          this.flushCount++;
        } else if (data.type === "stats") {
          this.port.postMessage({
            type: "stats",
            requestId: data.requestId,
            bufferSamples: this.buffer.length,
            state: this.state,
            underruns: this.underrunCount,
            overruns: this.overrunCount,
            totalChunks: this.totalChunks,
            totalSamples: this.totalSamples,
            processCount: this.processCount,
            flushCount: this.flushCount
          });
        }
        return;
      }

      const incoming = new Float32Array(data);
      this.totalChunks++;
      this.totalSamples += incoming.length;

      // Neuen Buffer zusammensetzen (bestehender Puffer; kein Abbau der Architektur)
      const combined = new Float32Array(this.buffer.length + incoming.length);
      combined.set(this.buffer, 0);
      combined.set(incoming, this.buffer.length);

      // Buffer-Limit: ~2 Sekunden bei 48 kHz Stereo (192.000 Samples)
      // Verhindert unbegrenztes Wachstum bei gestopptem/pausiertem AudioContext.
      const MAX_BUFFER_SAMPLES = 192000;
      if (combined.length > MAX_BUFFER_SAMPLES) {
        this.overrunCount++;
        // Älteste Daten verwerfen – nur die neuesten Samples behalten
        this.buffer = combined.subarray(combined.length - MAX_BUFFER_SAMPLES);
      } else {
        this.buffer = combined;
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const left  = output[0];
    const right = output[1];

    // 128 Frames × 2 Kanäle = 256 Samples pro Durchlauf
    const CHUNK_SAMPLES = 256;
    this.processCount++;

    // Unterlauf: STILLE ausgeben statt alter/ungeschriebener Samples.
    // (Chromium ließe sonst den letzten Block stehen → wiederholte Blöcke = Ruckeln.)
    if (this.buffer.length < CHUNK_SAMPLES) {
      this.underrunCount++;
      this.state = "refill";
      this.writeSilence(left, right);
      return true;
    }

    // Vorpuffer: erst ausgeben, wenn genug Daten vorhanden sind,
    // sonst beginnt/fortsetzt die Wiedergabe mit kleinen, jitter-anfälligen
    // Puffern und unterläuft ständig.
    if (this.state === "refill") {
      if (this.buffer.length < this.preBufferSamples) {
        this.writeSilence(left, right);
        return true;
      }
      this.state = "playing";
    }

    for (let i = 0; i < 128; i++) {
      left[i]  = this.buffer[i * 2];
      right[i] = this.buffer[i * 2 + 1];
    }

    this.buffer = this.buffer.subarray(CHUNK_SAMPLES);
    return true;
  }

  writeSilence(left, right) {
    for (let i = 0; i < 128; i++) {
      left[i] = 0;
      right[i] = 0;
    }
  }
}

registerProcessor("pcm-processor", PCMProcessor);