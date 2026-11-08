import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

let Processor;
globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class {
  constructor() { this.port = { messages: [], postMessage(message) { this.messages.push(message); } }; }
};
globalThis.registerProcessor = (name, implementation) => { assert.equal(name, 'noised-tuner'); Processor = implementation; };
const source = await readFile(new URL('../public/audio/tuner.worklet.js', import.meta.url), 'utf8');
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const bytes = await readFile(new URL('../public/wasm/noised_tuner.wasm', import.meta.url));
test('worklet runs the real WASM detector, reports the reference signal, and produces silent output', async () => {
  const processor = new Processor();
  const hz = 82.4069 * 2 ** (-7/1200);
  await processor.initialize({ bytes, mode: 'demo', demoHz: hz });
  assert.equal(processor.port.messages[0].type, 'ready');
  const output = new Float32Array(128);
  for (let i=0; i<400; i++) {
    output.fill(1);
    assert.equal(processor.process([], [[output]]), true);
    assert.ok(output.every(x => x === 0), 'no speaker monitoring');
  }
  const reading = processor.port.messages.filter(m => m.type === 'reading').at(-1);
  assert.equal(reading.voiced, true);
  assert.ok(Math.abs(1200*Math.log2(reading.hz/hz)) < 1);
  processor.port.onmessage({ data: { type: 'dispose' } });
  assert.equal(processor.process([], [[output]]), false);
});
test('microphone transport handles a nonstandard render quantum without dropping samples', async () => {
  const processor = new Processor();
  await processor.initialize({ bytes, mode: 'microphone' });
  const input = new Float32Array(256), output = new Float32Array(256);
  for (let i=0; i<200; i++) {
    for (let j=0; j<256; j++) input[j] = .15*Math.sin(2*Math.PI*220*(i*256+j)/48000);
    processor.process([[input]], [[output]]);
  }
  const reading = processor.port.messages.filter(m => m.type === 'reading').at(-1);
  assert.ok(Math.abs(1200*Math.log2(reading.hz/220)) < 1);
  assert.ok(output.every(x => x === 0));
  processor.port.onmessage({ data: { type: 'dispose' } });
});
