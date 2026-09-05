/* service-worker.js — so it works in the car, on the train, at school.

   Two caching rules, because the files fall into two honestly different kinds:

   - **Word lists are immutable per revision.** They are fetched as
     `latin-chapter-01.txt?v=3`, so a given URL can never change meaning and is
     served from the cache forever. Editing a chapter means bumping `rev` in
     index.json, which produces a different URL and a fresh fetch.
   - **Everything else is served network-first.** The app has no build step, so
     there is no content hash in a filename and nothing to tell the browser
     that app.js has changed. Cache-first would mean shipping a fix and finding
     it does not arrive, which is a far worse failure than a slightly slower
     launch. The cache is the offline fallback, not the primary source.

   index.json is network-first for the same reason and one more: it *carries*
   the revisions, so a stale copy would pin every chapter to an old version. */

const CACHE = 'llrnr-v1';

/* Everything needed to open the app with no network at all. */
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/answer.js',
  'js/cram.js',
  'js/gamify.js',
  'js/lesson.js',
  'js/lists.js',
  'js/parse.js',
  'js/schedule.js',
  'js/sound.js',
  'js/store.js',
  'js/ui.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);

    /* Precache the chapters too, at the revisions the catalogue names — the
       whole point is that the first offline lesson works, not just the shell. */
    try {
      const res = await fetch('data/index.json', { cache: 'no-cache' });
      /* Clone before reading: json() consumes the body, and putting a consumed
         response into the cache throws — which would silently skip every
         chapter and leave the app shell-only offline. */
      await cache.put('data/index.json', res.clone());

      const index = await res.json();
      await Promise.all((index.lists ?? []).map(list =>
        cache.add(`data/${list.file}?v=${list.rev}`).catch(() => {})));
    } catch {
      /* Installed offline, or the catalogue is missing: the shell still works
         and the lists arrive on the first successful load. */
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

/** Cache-first: for URLs whose contents cannot change. */
async function fromCache(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

/** Network-first: fresh when there is a network, cached when there is not. */
async function fromNetwork(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request)
      /* A navigation with no cached entry still has to land somewhere. */
      ?? (request.mode === 'navigate' ? await caches.match('index.html') : null);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const path = url.pathname;
  const immutable = path.includes('/data/') && url.searchParams.has('v');
  const asset = path.includes('/icons/') || path.endsWith('.webmanifest');

  event.respondWith(immutable || asset ? fromCache(request) : fromNetwork(request));
});
