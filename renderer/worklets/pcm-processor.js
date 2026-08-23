class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.port.onmessage = e => {
      const incoming = new Float32Array(e.data);

      // Neuen Buffer zusammensetzen
      const combined = new Float32Array(this.buffer.length + incoming.length);
      combined.set(this.buffer, 0);
      combined.set(incoming, this.buffer.length);

      // Buffer-Limit: ~2 Sekunden bei 48kHz Stereo (192.000 Samples)
      // Verhindert unbegrenztes Wachstum bei gestopptem/pausierten AudioContext
      // oder bei einem Stream-Wechsel ohne vorherigen Flush.
      const MAX_BUFFER_SAMPLES = 192000;
      if (combined.length > MAX_BUFFER_SAMPLES) {
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
    if (this.buffer.length < 256) return true;

    for (let i = 0; i < 128; i++) {
      left[i]  = this.buffer[i * 2];
      right[i] = this.buffer[i * 2 + 1];
    }

    this.buffer = this.buffer.subarray(256);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);