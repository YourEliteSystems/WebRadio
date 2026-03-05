class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);

    this.port.onmessage = e => {
      const incoming = new Float32Array(e.data);
      const tmp = new Float32Array(this.buffer.length + incoming.length);
      tmp.set(this.buffer, 0);
      tmp.set(incoming, this.buffer.length);
      this.buffer = tmp;
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const left = output[0];
    const right = output[1];

    if (this.buffer.length < 256) return true; // 128 Frames * 2 Kanäle

    for (let i = 0; i < 128; i++) {
      left[i]  = this.buffer[i * 2];
      right[i] = this.buffer[i * 2 + 1];
    }

    this.buffer = this.buffer.subarray(256);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);