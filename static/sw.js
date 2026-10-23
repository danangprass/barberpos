/**
 * App-shell service worker.
 *
 * Deliberately minimal: it precaches the shell so the till keeps booting during
 * an outage, but it never caches business data. Sales, catalog, and stock live
 * in IndexedDB through the repository, so the sync path in `sync.svelte.ts`
 * stays the single source of truth for what is committed and what is queued.
 *
 * Firestore's own SDK installs a worker too; this one must not conflict, hence
 * a distinct cache name and a network-first strategy for navigations.
 */

const CACHE = 'pos-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.catch(() => undefined)
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Navigations: try the network so a fresh build is picked up, fall back to
	// the cached shell when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put('/', copy));
					return response;
				})
				.catch(() => caches.match('/').then((cached) => cached ?? Response.error()))
		);
		return;
	}

	// Build assets are content-hashed, so cache-first is safe for them.
	if (url.pathname.startsWith('/_app/') || url.pathname.startsWith('/icons/') || url.pathname.endsWith('.webmanifest')) {
		event.respondWith(
			caches.match(request).then(
				(cached) =>
					cached ??
					fetch(request).then((response) => {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(request, copy));
						return response;
					})
			)
		);
	}
});