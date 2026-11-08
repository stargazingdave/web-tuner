export type TuningId = 'standard' | 'drop-d' | 'dadgad' | 'bass' | 'ukulele';
export interface Tuning { id: TuningId; label: string; instrument: string; midi: readonly number[]; }
export const tunings: readonly Tuning[] = [
  { id: 'standard', label: 'Standard · E A D G B E', instrument: 'Guitar', midi: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', label: 'Drop D · D A D G B E', instrument: 'Guitar', midi: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', label: 'DADGAD · D A D G A D', instrument: 'Guitar', midi: [38, 45, 50, 55, 57, 62] },
  { id: 'bass', label: 'Bass · E A D G', instrument: 'Bass', midi: [28, 33, 38, 43] },
  { id: 'ukulele', label: 'Ukulele · G C E A', instrument: 'Ukulele', midi: [67, 60, 64, 69] },
];
export function midiToHz(midi: number, reference = 440) { return reference * 2 ** ((midi - 69) / 12); }
export function hzToMidi(hz: number, reference = 440) { return 69 + 12 * Math.log2(hz / reference); }
export function noteName(midi: number) {
  return { name: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][(Math.round(midi) % 12 + 12) % 12],
    octave: Math.floor(Math.round(midi) / 12) - 1 };
}
export function targetFor(hz: number, tuning: Tuning, mode: 'strings' | 'chromatic', selected: number | null, reference: number) {
  if (!(hz > 0)) return null;
  const midi = hzToMidi(hz, reference);
  const target = selected !== null ? selected : mode === 'chromatic' ? Math.round(midi) :
    tuning.midi.reduce((a, b) => Math.abs(midi - a) <= Math.abs(midi - b) ? a : b);
  return { midi: target, cents: 100 * (midi - target), ...noteName(target) };
}
