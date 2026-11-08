// Audio transport only. The detector and continuity filtering run in shared Rust.
class TunerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = 0;
    this.exports = null;
    this.input = null;
    this.output = null;
    this.mode = 'microphone';
    this.demoHz = 110;
    this.phase = 0;
    this.clock = 0;
    this.reportClock = 0;
    this.alive = true;
    this.port.onmessage = ({ data }) => {
      if (data.type === 'init') this.initialize(data);
      if (data.type === 'demo-frequency') {
        this.demoHz = data.hz;
        if (this.engine) this.exports.tuner_reset(this.engine);
      }
      if (data.type === 'dispose') {
        if (this.engine) this.exports.tuner_destroy(this.engine);
        this.engine = 0;
        this.alive = false;
      }
    };
  }
  async initialize({ bytes, mode, demoHz }) {
    try {
      const { instance } = await WebAssembly.instantiate(bytes, {});
      if (!this.alive) return;
      this.exports = instance.exports;
      this.engine = this.exports.tuner_create(sampleRate);
      if (!this.engine) throw new Error('Unsupported device sample rate.');
      this.input = new Float32Array(this.exports.memory.buffer, this.exports.tuner_input(this.engine), 128);
      this.output = new Float32Array(this.exports.memory.buffer, this.exports.tuner_output(this.engine), 6);
      this.mode = mode;
      this.demoHz = demoHz || 110;
      this.port.postMessage({ type: 'ready', sampleRate });
    } catch (error) { this.port.postMessage({ type: 'error', message: String(error.message || error) }); }
  }
  process(inputs, outputs) {
    // The tuner never monitors microphone audio through the speakers.
    for (const output of outputs) for (const channel of output) channel.fill(0);
    if (!this.alive) return false;
    if (!this.engine) return true;
    const source = inputs[0]?.[0];
    const count = outputs[0]?.[0]?.length || source?.length || 128;
    let sum = 0;
    try {
      for (let offset = 0; offset < count; offset += 128) {
        const n = Math.min(128, count - offset);
        for (let i = 0; i < n; i++) {
          let x = source ? source[offset + i] : 0;
          if (this.mode === 'demo') {
            const t = this.clock++ / sampleRate;
            const envelope = 0.15 * Math.exp(-1.0 * (t % 1.5));
            this.phase = (this.phase + 2 * Math.PI * this.demoHz / sampleRate) % (2 * Math.PI);
            x = envelope * (Math.sin(this.phase) + 0.35 * Math.sin(2 * this.phase) + 0.16 * Math.sin(3 * this.phase));
          }
          this.input[i] = x;
          sum += x * x;
        }
        this.exports.tuner_process(this.engine, n);
      }
      this.reportClock += count;
      if (this.reportClock >= sampleRate / 30) {
        this.reportClock %= sampleRate / 30;
        const r = this.output;
        this.port.postMessage({ type: 'reading', hz: r[0], rawHz: r[1], confidence: r[2],
          rms: Math.sqrt(sum / count), voiced: r[4] > 0, analysisAgeMs: r[5] });
      }
    } catch (error) {
      this.port.postMessage({ type: 'error', message: String(error.message || error) });
      this.alive = false;
    }
    return this.alive;
  }
}
registerProcessor('noised-tuner', TunerProcessor);
