import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const bytes = await readFile(new URL('../public/wasm/noised_tuner.wasm', import.meta.url));

async function create(rate) {
  const { instance: { exports: e } } = await WebAssembly.instantiate(bytes, {});
  const ptr = e.tuner_create(rate);
  assert.ok(ptr, 'engine creation');
  const input = new Float32Array(e.memory.buffer, e.tuner_input(ptr), 128);
  const output = new Float32Array(e.memory.buffer, e.tuner_output(ptr), 6);
  let clock = 0;
  return {
    feed(seconds, signal) {
      const readings = [];
      for (let i = 0; i < Math.ceil(seconds * rate); i += 128) {
        for (let j = 0; j < 128; j++) input[j] = signal((clock + j) / rate);
        clock += 128;
        if (e.tuner_process(ptr, 128)) readings.push([...output]);
      }
      return readings;
    },
    reading: () => [...output],
    reset: () => { e.tuner_reset(ptr); clock = 0; },
    destroy: () => e.tuner_destroy(ptr),
  };
}
const harmonic = (hz, amplitude = .15) => t => {
  const p = 2 * Math.PI * hz * t;
  return amplitude * (Math.sin(p) + .35 * Math.sin(2*p) + .16 * Math.sin(3*p));
};

test('actual WASM preserves detuning through bass, all guitar strings, and treble at device rates', async () => {
  for (const rate of [44100, 48000, 96000]) {
    const engine = await create(rate);
    try {
      for (const nominal of [41.2034, 65.4064, 82.4069, 110, 146.8324, 196, 246.9417, 329.6276, 880, 1318.51]) {
        const hz = nominal * 2 ** (-17 / 1200);
        const observations = engine.feed(.4, harmonic(hz));
        const [measured, , confidence, , voiced] = observations.at(-1);
        assert.equal(voiced, 1, rate + ' ' + hz);
        assert.ok(confidence >= .85);
        assert.ok(Math.abs(1200 * Math.log2(measured / hz)) < 3, rate + ' ' + hz + ' -> ' + measured);
      }
    } finally { engine.destroy(); }
  }
});
test('quiet decaying sustain survives; silence and invalid samples clear stale notes; reset reacquires', async () => {
  const engine = await create(48000);
  try {
    const samples = engine.feed(1, t => harmonic(82.4069, .1 * Math.exp(-4*t))(t));
    assert.equal(samples.at(-1)[4], 1);
    engine.feed(.5, () => 0);
    assert.equal(engine.reading()[0], 0);
    engine.feed(.5, () => NaN);
    assert.equal(engine.reading()[0], 0);
    engine.reset();
    const results = engine.feed(.3, harmonic(329.6276));
    assert.ok(Math.abs(1200 * Math.log2(results.at(-1)[0] / 329.6276)) < 1);
  } finally { engine.destroy(); }
});
test('persistent octave changes are acquired without a long smoothing glide', async () => {
  const engine = await create(48000);
  try {
    engine.feed(.3, harmonic(110));
    const readings = engine.feed(.15, harmonic(220));
    assert.equal(readings.at(-1)[4], 1);
    assert.ok(Math.abs(1200 * Math.log2(readings.at(-1)[0] / 220)) < 2);
  } finally { engine.destroy(); }
});
test('uncorrelated noise does not produce a stable note', async () => {
  const engine = await create(48000);
  let seed = 42;
  try {
    const readings = engine.feed(.5, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return .1 * (seed / 2147483648 - 1); });
    assert.equal(readings.filter(r => r[4] === 1).length, 0);
  } finally { engine.destroy(); }
});
