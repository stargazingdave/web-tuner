import { useEffect, useState } from 'react';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }>; }
export function useInstall() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('online', online); window.addEventListener('offline', online);
    let disposed = false;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(new URL('sw.js', new URL(import.meta.env.BASE_URL, document.baseURI))).then(registration => {
        if (disposed) return;
        if (registration.waiting && navigator.serviceWorker.controller) setUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (disposed || worker.state !== 'installed') return;
            if (navigator.serviceWorker.controller) setUpdate(worker);
          });
        });
        void navigator.serviceWorker.ready.then(() => { if (!disposed) setReady(true); });
      }).catch(() => { /* Tuning remains available if offline caching is unavailable. */ });
    }
    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('online', online); window.removeEventListener('offline', online);
    };
  }, []);
  async function install() { await prompt?.prompt(); await prompt?.userChoice; setPrompt(null); }
  function applyUpdate() {
    if (!update) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    update.postMessage('activate');
  }
  return { canInstall: !!prompt, install, offline, ready, update, applyUpdate };
}
