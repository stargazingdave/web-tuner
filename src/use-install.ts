import { useEffect, useState } from 'react';

/** Cache the app and activate updates only while audio is stopped. No install UI. */
export function useAppUpdates(canActivate: boolean) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let installing: ServiceWorker | null = null;
    const installed = () => {
      if (!disposed && installing?.state === 'installed' && navigator.serviceWorker.controller) {
        setWaiting(installing);
      }
    };
    const found = () => {
      installing?.removeEventListener('statechange', installed);
      installing = registration?.installing || null;
      installing?.addEventListener('statechange', installed);
    };
    void navigator.serviceWorker.register(new URL('sw.js', new URL(import.meta.env.BASE_URL, document.baseURI)))
      .then(result => {
        if (disposed) return;
        registration = result;
        if (result.waiting && navigator.serviceWorker.controller) setWaiting(result.waiting);
        registration.addEventListener('updatefound', found);
        if (registration.installing) found();
      }).catch(() => { /* Tuning still works if cache installation is unavailable. */ });
    return () => {
      disposed = true;
      registration?.removeEventListener('updatefound', found);
      installing?.removeEventListener('statechange', installed);
    };
  }, []);
  useEffect(() => {
    if (!canActivate || !waiting) return;
    const refresh = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', refresh, { once: true });
    waiting.postMessage('activate');
    return () => navigator.serviceWorker.removeEventListener('controllerchange', refresh);
  }, [canActivate, waiting]);
}
