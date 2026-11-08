export interface Reading {
  hz: number; rawHz: number; confidence: number; rms: number; voiced: boolean; analysisAgeMs: number;
}
export interface CaptureInfo { sampleRate: number; settings: MediaTrackSettings | null; }
export type InputMode = 'microphone' | 'demo';
export const emptyReading: Reading = { hz: 0, rawHz: 0, confidence: 0, rms: 0, voiced: false, analysisAgeMs: 0 };
const appBase = new URL(import.meta.env.BASE_URL, document.baseURI);

/** Owns one capture stream and audio graph; stop invalidates pending startup work. */
export class AudioSession {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private generation = 0;
  private running = false;
  constructor(private onReading: (reading: Reading) => void, private onError: (message: string) => void) {}

  async start(mode: InputMode, demoHz: number): Promise<CaptureInfo | null> {
    this.stop();
    const generation = this.generation;
    if (!window.isSecureContext) throw new Error('Microphone access needs HTTPS. Open the published HTTPS address.');
    if (!window.AudioContext || !window.AudioWorkletNode) throw new Error('This browser does not support AudioWorklet. Try a current Safari or Chrome.');
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    // Resume from the original button gesture, before permission/network awaits.
    const resumed = context.resume();
    let stream: MediaStream | null = null;
    try {
      if (mode === 'microphone') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable in this browser.');
        stream = await navigator.mediaDevices.getUserMedia({ audio: {
          channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        } });
        if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return null; }
        this.stream = stream;
      }
      const [response] = await Promise.all([
        fetch(new URL('wasm/noised_tuner.wasm', appBase)),
        context.audioWorklet.addModule(new URL('audio/tuner.worklet.js', appBase).href),
        resumed,
      ]);
      if (!response.ok) throw new Error('The audio engine could not be downloaded. Reconnect and reload the app.');
      const bytes = await response.arrayBuffer();
      if (generation !== this.generation) return null;
      const node = new AudioWorkletNode(context, 'noised-tuner', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        channelCount: 1, channelCountMode: 'explicit',
      });
      this.node = node;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('The audio engine took too long to start.')), 15000);
        node.onprocessorerror = () => {
          clearTimeout(timeout);
          const message = 'Audio processing was interrupted. Tap Start microphone to try again.';
          if (this.running) { this.stop(); this.onError(message); }
          else reject(new Error(message));
        };
        node.port.onmessage = ({ data }) => {
          if (generation !== this.generation) return;
          if (data.type === 'ready') { clearTimeout(timeout); resolve(); }
          if (data.type === 'reading') this.onReading(data);
          if (data.type === 'error') {
            clearTimeout(timeout);
            if (this.running) { this.stop(); this.onError(data.message); }
            else reject(new Error(data.message));
          }
        };
        node.port.postMessage({ type: 'init', bytes, mode, demoHz }, [bytes]);
        node.connect(context.destination);
      });
      if (generation !== this.generation) return null;
      if (stream) {
        this.source = context.createMediaStreamSource(stream);
        this.source.connect(node);
        for (const track of stream.getAudioTracks()) track.onended = () => {
          if (this.running) { this.stop(); this.onError('The microphone disconnected. Tap Start microphone to reconnect.'); }
        };
      }
      this.running = true;
      context.onstatechange = () => {
        if (this.running && context.state !== 'running') {
          this.stop();
          this.onError('Audio paused by your device. Tap Start microphone to resume.');
        }
      };
      return { sampleRate: context.sampleRate, settings: stream?.getAudioTracks()[0]?.getSettings() || null };
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== this.generation) return null;
      this.stop();
      throw error;
    }
  }
  setDemoFrequency(hz: number) { this.node?.port.postMessage({ type: 'demo-frequency', hz }); }
  stop() {
    this.generation++;
    this.running = false;
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.stream = null;
    this.source?.disconnect();
    this.source = null;
    if (this.node) { this.node.port.postMessage({ type: 'dispose' }); this.node.disconnect(); }
    this.node = null;
    if (this.context) {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
      this.context = null;
    }
  }
}

export function describeAudioError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Microphone access was declined. Allow microphone access in this site’s browser settings, then try again.';
    if (error.name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.';
    if (error.name === 'NotReadableError') return 'The microphone is busy or unavailable. Close other recording apps and try again.';
  }
  return error instanceof Error ? error.message : 'The tuner could not start. Please try again.';
}
