// Keeps the game fresh, and lets it open when there is no signal.
//
// Every file is asked for from the network first and re-checked with the server
// each time, so a new version shows up on the next load. The last good copy is
// used only when the network cannot be reached.

const CACHE = 'split-clues-files-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // the database is not our business
  event.respondWith(networkFirst(request, url));
});

async function networkFirst(request, url) {
  // The page is the same whatever room is in the address, so keep one copy of it.
  const key = request.mode === 'navigate' ? url.origin + url.pathname : request.url;
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request.url, { cache: 'no-cache' });
    if (fresh.ok) cache.put(key, fresh.clone()).catch(() => {});
    return fresh;
  } catch (error) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw error;
  }
}
