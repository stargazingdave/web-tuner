import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
test('offline app shell, JS modules, worklet, and WASM load with Origin header variation under a project prefix', async () => {
  const scope = 'https://example.test/web-tuner/';
  const listeners = {}, stores = new Map();
  let networkCalls = 0;
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(files) {
          for (const relative of files) {
            const url = new URL(relative, scope);
            const bytes = await readFile(new URL('../dist/' + relative.replace(/^\.\//, ''), import.meta.url));
            store.set(url.href, new Response(bytes, { headers: { Vary: 'Origin' } }));
          }
        },
        async match(request, options) {
          const key = request instanceof Request ? request.url : String(request);
          if (!options?.ignoreVary && request instanceof Request && request.headers.get('Origin')) return undefined;
          return store.get(key)?.clone();
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  };
  stores.set('another-app-cache', new Map());
  vm.runInNewContext(source, {
    self: { registration: { scope }, location: { origin: 'https://example.test' },
      addEventListener: (name, fn) => listeners[name] = fn,
      clients: { claim: async () => {} }, skipWaiting() {} },
    caches: cacheApi, URL, Response,
    fetch: async () => { networkCalls++; throw new Error('Offline'); },
  });
  let installing;
  listeners.install({ waitUntil: task => installing = task });
  await installing;
  let activating;
  listeners.activate({ waitUntil: task => activating = task });
  await activating;
  assert.ok(stores.has('another-app-cache'), 'other app cache is preserved');
  const distIndex = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const scriptPath = distIndex.match(/src="([^"]+\.js)"/)[1];
  async function request(path, navigation = false) {
    const req = new Request(new URL(path, scope), { headers: { Origin: 'https://example.test' } });
    // Node Request cannot construct navigate mode, so expose the browser request shape.
    const browserRequest = navigation ? { url: req.url, method: 'GET', mode: 'navigate' } : req;
    let response;
    listeners.fetch({ request: browserRequest, respondWith: result => response = result });
    return await response;
  }
  assert.equal(await (await request('./', true)).text(), distIndex);
  for (const asset of [scriptPath, './audio/tuner.worklet.js', './wasm/noised_tuner.wasm']) {
    const response = await request(asset);
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 100);
  }
  assert.equal(networkCalls, 0, 'cached startup never waits for the network');
});
