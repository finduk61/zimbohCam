// zimbohCam service worker
// 1) Uygulamayı çevrimdışı çalıştırır  2) ProRAW motoru (çok iş parçacıklı WebAssembly) için
//    gereken cross-origin isolation başlıklarını ekler (GitHub Pages bu başlıkları veremiyor).
const VERSION = 'zimbohcam-1.2.0';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/engine.js', 'js/presets.js', 'js/camera.js', 'js/raw.js', 'js/store.js', 'js/jpeg-worker.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
const LIBS = ['lib/libraw/index.js', 'lib/libraw/worker.js', 'lib/libraw/libraw.wasm'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    try { await c.addAll(LIBS); } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

async function networkFirst(req, cacheKey) {
  const c = await caches.open(VERSION);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(req.mode === 'navigate' ? req.url : req, { signal: ctrl.signal, cache: 'no-cache' });
    clearTimeout(t);
    if (res.ok) c.put(cacheKey || req, res.clone());
    return res;
  } catch {
    const hit = await c.match(cacheKey || req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.headers.has('range')) return;
  const isLib = url.pathname.includes('/lib/');
  const isNav = req.mode === 'navigate';
  e.respondWith((async () => {
    try {
      const res = isLib ? await cacheFirst(req) : await networkFirst(req, isNav ? new URL('index.html', self.registration.scope).href : undefined);
      return isolate(res);
    } catch {
      return new Response('Çevrimdışı', { status: 503 });
    }
  })());
});
