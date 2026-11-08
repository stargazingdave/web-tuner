import { defineConfig } from 'vite';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { assetsInlineLimit: 0 },
  plugins: [{
    name: 'offline-app',
    async closeBundle() {
      async function list(dir: string): Promise<string[]> {
        const entries = await readdir(dir, { withFileTypes: true });
        return (await Promise.all(entries.map(e => e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
      }
      const files = (await list('dist')).filter(f => !f.endsWith('sw.js')).sort();
      const hash = createHash('sha256').update('offline-cache-v3');
      for (const file of files) hash.update(await readFile(file));
      const version = hash.digest('hex').slice(0, 16);
      const urls = files.map(f => './' + path.relative('dist', f).split(path.sep).join('/'));
      const worker = `const VERSION = '${version}';
const PREFIX = 'noised-tuner-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + VERSION;
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('message', event => { if (event.data === 'activate') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      // Keep the active HTML, JS, worklet and WASM on the same cached version.
      // A waiting worker provides the next version only after explicit activation.
      return await cache.match(new URL('./index.html', self.registration.scope), { ignoreVary: true }) || fetch(event.request);
    }
    return await cache.match(event.request, { ignoreVary: true }) || fetch(event.request);
  })());
});
`;
      await writeFile('dist/sw.js', worker);
    },
  }],
});
