// Offline cache for the trainer (WQ-043, D-121, D-128). Caches only this site's own files; it makes no request to any
// other origin and sends nothing anywhere. The page registers it as `sw.js?v=<TDT.VERSION>` after Start, so an engine
// version bump installs a new worker with a new cache, and the old cache is deleted when the new worker activates.
'use strict';
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const PREFIX = 'tdt-';
const CACHE = PREFIX + VERSION;
const PAGES = ['./', 'index.html', 'engine.js', 'manifest.webmanifest'];        // network first, cache fallback
const ICONS = ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];  // cache first

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE)
    .then(c => c.addAll([...PAGES, ...ICONS].map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const pathOf = f => new URL(f, self.registration.scope).pathname;
const pagePaths = new Set(PAGES.map(pathOf)), iconPaths = new Set(ICONS.map(pathOf));

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('index.html')) : undefined);
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                             // never handle another origin
  if (iconPaths.has(url.pathname)) ev.respondWith(cacheFirst(req));
  else if (pagePaths.has(url.pathname)) ev.respondWith(networkFirst(req));                // only the listed files
});
