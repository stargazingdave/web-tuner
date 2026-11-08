import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../src/music.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
const { midiToHz, targetFor, tunings } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
test('selected string preserves octave errors and detuning rather than folding or snapping measured pitch', () => {
  const hz = midiToHz(40) * 2 ** (-17 / 1200);
  const target = targetFor(hz, tunings[0], 'strings', null, 440);
  assert.equal(target.midi, 40);
  assert.ok(Math.abs(target.cents + 17) < .00001);
  assert.ok(Math.abs(targetFor(hz * 2, tunings[0], 'strings', 40, 440).cents - 1183) < .00001);
});
test('chromatic mode uses the calibrated reference and invalid input has no target', () => {
  assert.equal(targetFor(0, tunings[0], 'chromatic', null, 440), null);
  const target = targetFor(442, tunings[0], 'chromatic', null, 442);
  assert.equal(target.name, 'A'); assert.equal(target.octave, 4); assert.equal(target.cents, 0);
});
