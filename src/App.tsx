import { useState } from 'react';
import { AudioIcon, BrandLink, Button, LevelMeter, NoteSelector, SegmentedControl, SelectField, StatusIndicator, TunerDisplay } from 'noised-ui';
import { midiToHz, noteName, targetFor, tunings, type TuningId } from './music';
import { useTuner } from './use-tuner';
import { useAppUpdates } from './use-install';

const modes = [{ value: 'strings', label: 'Strings' }, { value: 'chromatic', label: 'Chromatic' }] as const;
const appBase = new URL(import.meta.env.BASE_URL, document.baseURI);
function storedSettings(): { tuning: TuningId; reference: number } {
  try {
    const saved = JSON.parse(localStorage.getItem('noised-tuner-settings-v1') || '{}');
    return { tuning: tunings.some(t => t.id === saved.tuning) ? saved.tuning : 'standard',
      reference: Number.isFinite(saved.reference) && saved.reference >= 430 && saved.reference <= 450 ? saved.reference : 440 };
  } catch { return { tuning: 'standard', reference: 440 }; }
}

export function App() {
  const [settings, setSettings] = useState(storedSettings);
  const [mode, setMode] = useState<'strings' | 'chromatic'>('strings');
  const [selected, setSelected] = useState<number | null>(null);
  const tuner = useTuner();
  useAppUpdates(tuner.state === 'idle');
  const tuning = tunings.find(t => t.id === settings.tuning)!;
  const target = targetFor(tuner.reading.hz, tuning, mode, selected, settings.reference);
  const running = tuner.state === 'running';
  const starting = tuner.state === 'starting';
  const hasReading = running && target !== null;
  const live = hasReading && tuner.reading.voiced;
  const demoMidi = selected ?? tuning.midi[0];
  const demoHz = midiToHz(demoMidi, settings.reference) * 2 ** (-7 / 1200);
  const inputLevel = running ? Math.max(0, (20 * Math.log10(Math.max(tuner.reading.rms, 1e-8)) + 70) / 60) : 0;

  function changeSettings(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch };
    setSettings(next); setSelected(null);
    try { localStorage.setItem('noised-tuner-settings-v1', JSON.stringify(next)); } catch { /* Optional storage. */ }
    if (running && tuner.mode === 'demo') {
      const nextTuning = tunings.find(t => t.id === next.tuning)!;
      tuner.setDemoFrequency(midiToHz(nextTuning.midi[0], next.reference) * 2 ** (-7 / 1200));
    }
  }
  function selectNote(id: string | null) {
    const midi = id === null ? null : Number(id);
    setSelected(midi);
    if (running && tuner.mode === 'demo') tuner.setDemoFrequency(midiToHz(midi ?? tuning.midi[0], settings.reference) * 2 ** (-7 / 1200));
  }
  const notes = tuning.midi.map((midi, i) => ({ id: String(midi), ...noteName(midi), detail: String(tuning.midi.length - i).padStart(2, '0') }));
  const status = starting ? 'Starting' : running ? tuner.mode === 'demo' ? 'Reference signal' : 'Listening' : 'Microphone off';

  return <main className="tuner-console" aria-label="Instrument tuner">
    <header className="console-header">
      <h1>Tuner</h1>
      <SegmentedControl label="Tuner mode" value={mode} options={modes} onChange={value => { setMode(value); setSelected(null); }} />
      <StatusIndicator className="session-status" tone={running ? 'active' : 'neutral'}>{status}</StatusIndicator>
    </header>

    <section className="tuning-screen" aria-label="Pitch display">
      <TunerDisplay note={hasReading ? target : null} frequency={hasReading ? tuner.reading.hz : null}
        cents={hasReading ? target.cents : null} active={!!live} listening={running} />
      {tuner.error ? <div className="error-message" role="alert">{tuner.error}</div> : null}
    </section>

    <section className="tuning-controls" aria-label="Tuning controls">
      <div className="target-controls">
        <div className="control-heading"><h2>{tuning.instrument} strings</h2>
          <Button variant="ghost" className="auto-button" aria-pressed={selected === null} onClick={() => selectNote(null)}>Auto</Button>
        </div>
        <NoteSelector notes={notes} value={selected === null ? null : String(selected)}
          detected={hasReading && mode === 'strings' ? String(target.midi) : null} onChange={selectNote} />
      </div>
      <div className="tuning-settings">
        <SelectField label="Tuning" value={settings.tuning} onChange={event => changeSettings({ tuning: event.target.value as TuningId })}>
          {tunings.map(t => <option key={t.id} value={t.id}>{t.label.split(' · ')[0]}</option>)}
        </SelectField>
        <SelectField label="Reference pitch (A4)" value={settings.reference} onChange={event => changeSettings({ reference: Number(event.target.value) })}>
          {Array.from({ length: 21 }, (_, i) => <option key={430 + i} value={430 + i}>{430 + i} Hz</option>)}
        </SelectField>
      </div>
    </section>

    <div className="console-transport">
      <div className="input-meter"><span>Input</span><LevelMeter level={inputLevel} /></div>
      <div className="transport-actions">
        <Button className="start-button" onClick={() => starting || running ? tuner.stop() : void tuner.start('microphone', demoHz)}>
          <AudioIcon name={starting || running ? 'stop' : 'microphone'} size={20} />
          {starting ? 'Cancel' : running ? 'Stop tuner' : 'Start tuner'}
        </Button>
        <Button variant="ghost" className="reference-button" disabled={starting}
          aria-pressed={running && tuner.mode === 'demo'}
          onClick={() => running && tuner.mode === 'demo' ? tuner.stop() : void tuner.start('demo', demoHz)}>
          <AudioIcon name="play" size={14} />{running && tuner.mode === 'demo' ? 'End reference' : 'Reference signal'}
        </Button>
      </div>
      <BrandLink className="creator-link" href="https://davidportal.dev" label="davidportal.dev"
        logoSrc={new URL('david-portal-logo.svg', appBase).href} />
    </div>
  </main>;
}
