import { useState } from 'react';
import { AudioIcon, Button, LevelMeter, NoteSelector, PitchMeter, SegmentedControl, SelectField, StatusIndicator } from 'noised-ui';
import { midiToHz, noteName, targetFor, tunings, type TuningId } from './music';
import { useTuner } from './use-tuner';
import { useInstall } from './use-install';

const modes = [{ value: 'strings', label: 'Strings' }, { value: 'chromatic', label: 'Chromatic' }] as const;
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
  const [showInstall, setShowInstall] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const tuner = useTuner();
  const pwa = useInstall();
  const tuning = tunings.find(t => t.id === settings.tuning)!;
  const target = targetFor(tuner.reading.hz, tuning, mode, selected, settings.reference);
  const running = tuner.state === 'running';
  const hasReading = running && target !== null;
  const live = hasReading && tuner.reading.voiced;
  const inTune = live && Math.abs(target.cents) <= 3;
  const demoMidi = selected ?? tuning.midi[0];
  const demoHz = midiToHz(demoMidi, settings.reference) * 2 ** (-7 / 1200);
  function changeSettings(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch };
    setSettings(next); setSelected(null);
    try { localStorage.setItem('noised-tuner-settings-v1', JSON.stringify(next)); } catch { /* Storage is optional. */ }
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
  const status = tuner.state === 'starting' ? 'Starting audio' : running ? tuner.mode === 'demo' ? 'Reference signal' : 'Microphone on' : 'Microphone off';
  const instruction = !running ? 'A little quieter. A little more in tune.' : !hasReading ? 'Pluck one string and let it ring.' :
    !live ? 'Listening for a clear note…' : inTune ? 'Right where it belongs.' : target.cents < 0 ? 'A little higher.' : 'A little lower.';

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="./" aria-label="NoiseD Tuner home"><img src={new URL('icon.svg', new URL(import.meta.env.BASE_URL, document.baseURI)).href} alt="" width="32" height="32" /><span>NoiseD<span className="brand-divider">/</span><span className="brand-product">tuner</span></span></a>
      <Button variant="ghost" className="install-trigger" onClick={() => setShowInstall(!showInstall)}>Install app <AudioIcon name="arrow" size={15} /></Button>
    </header>

    <main>
      <div className="intro-row"><p className="eyebrow">FIND YOUR FREQUENCY</p><span className="edition">01 / INSTRUMENTS</span></div>
      <section className="tuner-card" aria-label="Instrument tuner">
        <div className="card-toolbar"><StatusIndicator tone={running ? 'active' : 'neutral'}>{status}</StatusIndicator>
          <SegmentedControl label="Tuner mode" value={mode} options={modes} onChange={value => { setMode(value); setSelected(null); }} />
        </div>
        <div className="meter-wrap"><PitchMeter cents={hasReading ? target.cents : null} active={!!live} />
          <div className="note-readout" data-in-tune={inTune || undefined} data-held={hasReading && !live || undefined}>
            <div className="note-name" aria-label={hasReading ? `Detected note ${target.name}${target.octave}` : 'No note detected'}>
              {hasReading ? <>{target.name}<sub>{target.octave}</sub></> : <span className="empty-note">—</span>}
            </div>
            <div className="frequency" data-testid="frequency">{hasReading ? tuner.reading.hz.toFixed(2) : '—'} <span>Hz</span></div>
          </div>
        </div>
        <div className="tuning-feedback">
          <span className="cents-reading" data-in-tune={inTune || undefined}>{hasReading ? <>{inTune ? <AudioIcon name="check" size={16} /> : null}{target.cents > 0 ? '+' : ''}{target.cents.toFixed(1)} <span>cents</span></> : <span>Ready when you are</span>}</span>
          <h1 aria-live="polite" aria-atomic="true">{instruction}</h1>
        </div>
        <div className="input-section"><LevelMeter level={running ? Math.max(0, (20 * Math.log10(Math.max(tuner.reading.rms, 1e-8)) + 70) / 60) : 0} /><span>INPUT</span></div>
        <div className="transport">
          <Button className="start-button" disabled={tuner.state === 'starting'} onClick={() => running ? tuner.stop() : void tuner.start('microphone', demoHz)}>
            <AudioIcon name={running ? 'stop' : 'microphone'} />{tuner.state === 'starting' ? 'Starting…' : running ? 'Stop listening' : 'Start microphone'}
          </Button>
          {tuner.state === 'starting' ? <Button variant="ghost" onClick={tuner.stop}>Cancel</Button> :
            <Button variant="ghost" className="demo-button" onClick={() => running && tuner.mode === 'demo' ? tuner.stop() : void tuner.start('demo', demoHz)}>
              {running && tuner.mode === 'demo' ? 'End reference signal' : 'Try a reference signal'}<AudioIcon name="arrow" size={14} />
            </Button>}
        </div>
        {tuner.error ? <div className="error-message" role="alert">{tuner.error}</div> : null}
        {running && tuner.mode === 'demo' ? <p className="demo-notice">Silent test · a synthetic plucked note, 7 cents flat · no microphone used</p> : null}
        <div className="string-section">
          <div className="section-label"><span>{tuning.instrument.toUpperCase()} STRINGS</span><span>{selected === null ? 'Auto-detect' : 'Fixed target · tap again for auto'}</span></div>
          <NoteSelector notes={notes} value={selected === null ? null : String(selected)} detected={hasReading && mode === 'strings' ? String(target.midi) : null} onChange={selectNote} />
          <p className="string-hint">Let one string ring. Mute the others. Tap a string to focus.</p>
        </div>
      </section>

      <section className="setup-card" aria-label="Tuner settings">
        <div className="setup-title"><AudioIcon name="settings" size={18} /><h2>Make it yours</h2></div>
        <div className="setup-fields">
          <SelectField label="Tuning" value={settings.tuning} onChange={event => changeSettings({ tuning: event.target.value as TuningId })}>
            {tunings.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </SelectField>
          <SelectField label="Reference pitch" value={settings.reference} onChange={event => changeSettings({ reference: Number(event.target.value) })}>
            {Array.from({ length: 21 }, (_, i) => <option key={430 + i} value={430 + i}>A4 = {430 + i} Hz{430 + i === 440 ? ' · standard' : ''}</option>)}
          </SelectField>
        </div>
      </section>

      {showInstall ? <aside className="info-panel" aria-label="Install instructions"><div><h2>Your tuner. One tap away.</h2><Button variant="ghost" onClick={() => setShowInstall(false)}>Close</Button></div>
        <p>On iPhone, open this page in Safari, tap Share, then Add to Home Screen. Enable Open as Web App if offered. On Android or desktop, use your browser’s Install app option.</p>
        {pwa.canInstall ? <Button variant="primary" onClick={() => void pwa.install()}>Install on this device</Button> : null}
        <p>{pwa.ready ? 'The app files are cached for offline use on this browser.' : 'Open the app online once to prepare offline use.'} Microphone permission is still required.</p></aside> : null}

      {pwa.update ? <aside className="update-panel"><p>A new version is ready.</p><Button variant="secondary" onClick={() => { tuner.stop(); pwa.applyUpdate(); }}>Update app</Button></aside> : null}

      <footer className="site-footer"><div><span className="privacy-mark" aria-hidden="true">◈</span>Just sound. No uploads. No account.</div><span>{pwa.offline ? 'Offline' : pwa.ready ? 'Offline ready' : 'ON YOUR DEVICE'}</span></footer>
      <div className="details"><Button variant="ghost" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}>Under the hood <span aria-hidden="true">{showDetails ? '−' : '+'}</span></Button>
        {showDetails ? <div className="details-content"><p>NoiseD Rust YIN detector · WebAssembly · AudioWorklet. Detection runs locally. Frequency is measured, never snapped to the target note. Green means within ±3 cents.</p>
          <p>Audio pauses when you leave the app. Tap Start microphone when you return. For best results, keep the phone near the instrument and avoid Bluetooth microphones.</p>
          {tuner.capture ? <dl><dt>Audio sample rate</dt><dd>{tuner.capture.sampleRate.toLocaleString()} Hz</dd><dt>Analysis centre age</dt><dd>{tuner.reading.analysisAgeMs.toFixed(1)} ms (not total latency)</dd><dt>Periodicity</dt><dd>{(tuner.reading.confidence * 100).toFixed(0)}%</dd><dt>Echo cancellation</dt><dd>{String(tuner.capture.settings?.echoCancellation ?? 'not reported')}</dd><dt>Noise suppression</dt><dd>{String(tuner.capture.settings?.noiseSuppression ?? 'not reported')}</dd><dt>Automatic gain</dt><dd>{String(tuner.capture.settings?.autoGainControl ?? 'not reported')}</dd></dl> : null}
        </div> : null}
      </div>
    </main>
  </div>;
}
