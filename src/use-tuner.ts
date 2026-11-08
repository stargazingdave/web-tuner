import { useEffect, useRef, useState } from 'react';
import { AudioSession, emptyReading, describeAudioError, type CaptureInfo, type InputMode, type Reading } from './audio-session';

export function useTuner() {
  const [reading, setReading] = useState<Reading>(emptyReading);
  const [state, setState] = useState<'idle' | 'starting' | 'running'>('idle');
  const [mode, setMode] = useState<InputMode>('microphone');
  const [error, setError] = useState('');
  const [capture, setCapture] = useState<CaptureInfo | null>(null);
  const session = useRef<AudioSession | null>(null);
  const sequence = useRef(0);
  const stop = () => {
    sequence.current++;
    session.current?.stop();
    session.current = null;
    setState('idle'); setReading(emptyReading); setCapture(null);
  };
  useEffect(() => () => { sequence.current++; session.current?.stop(); }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    const unload = () => { session.current?.stop(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', unload);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', unload); };
  }, []);
  async function start(inputMode: InputMode, demoHz: number) {
    stop();
    const request = sequence.current;
    setMode(inputMode); setError(''); setState('starting');
    const audio = new AudioSession(setReading, message => {
      if (request !== sequence.current) return;
      stop(); setError(message);
    });
    session.current = audio;
    try {
      const info = await audio.start(inputMode, demoHz);
      if (request !== sequence.current || !info) return;
      setCapture(info); setState('running');
    } catch (cause) {
      if (request !== sequence.current) return;
      stop(); setError(describeAudioError(cause));
    }
  }
  return { reading, state, mode, error, capture, start, stop,
    setDemoFrequency: (hz: number) => session.current?.setDemoFrequency(hz) };
}
