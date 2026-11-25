const V = 'ons-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin) return
  if (u.pathname.startsWith('/api/')) {
    // Quran/adhkar content is static: cache it for offline reading. User data is never cached.
    if (!/^\/api\/(surahs(\/\d+)?|tafsir\/[^/]+|adhkar(\/[^/]+)?|duas)$/.test(u.pathname)) return
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); if (res.ok) caches.open(V).then((c) => c.put(r, cp)); return res }).catch(() => caches.match(r)))
    return
  }
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { const cp = res.clone(); if (res.ok) caches.open(V).then((c) => c.put(r, cp)); return res })))
})
