// ONS service worker: offline app shell + offline Quran/adhkar/duas content.
// __BUILD__ and the asset list are stamped at build time (see vite.config.js), so every deploy
// ships a different sw.js and existing installs update on their own.
const BUILD = /*__BUILD__*/'dev'
const ASSETS = /*__ASSETS__*/[]
const SHELL_CACHE = 'ons-shell-' + BUILD
const CONTENT = 'ons-content'
const USER = 'ons-user'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', ...ASSETS]

// Static texts that never depend on the user: cached for offline reading.
const STATIC_API = /^\/api\/(surahs(\/\d+)?|juz\/\d+|page\/\d+|ayah\/\d+|tafsir\/\d+|adhkar|duas|sadaqah|deceased-duas|meta|reciters)$/
const ADHKAR_ITEM = /^\/api\/adhkar\/\d+$/ // carries per-user favorite flags: network first

async function precacheContent() {
  const c = await caches.open(CONTENT)
  const put = async (url) => { try { const r = await fetch(url); if (r.ok) await c.put(url, r) } catch { /* offline or transient: retry on next update */ } }
  const urls = ['/api/surahs', '/api/meta', '/api/adhkar', '/api/duas', '/api/sadaqah', '/api/deceased-duas']
  for (let n = 1; n <= 114; n++) urls.push('/api/surahs/' + n)
  for (let j = 1; j <= 30; j++) urls.push('/api/juz/' + j)
  for (let p = 1; p <= 604; p++) urls.push('/api/page/' + p)
  try { const r = await fetch('/api/adhkar'); if (r.ok) (await r.json()).categories.forEach((x) => urls.push('/api/adhkar/' + x.id)) } catch { /* ignore */ }
  for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(put))
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL_CACHE)
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== CONTENT && k !== USER).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
  // content download continues after activation so a slow connection never blocks the update
  e.waitUntil(precacheContent())
})

self.addEventListener('message', (e) => {
  if (e.data === 'refresh-content') e.waitUntil(precacheContent())
})

const networkFirst = async (req, cacheName) => {
  try {
    const res = await fetch(req)
    if (res.ok) { const cp = res.clone(); caches.open(cacheName).then((c) => c.put(req.url, cp)) }
    return res
  } catch (err) {
    const hit = await caches.match(req.url, { cacheName })
    if (hit) return hit
    throw err
  }
}

self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin) return

  if (u.pathname.startsWith('/api/')) {
    if (ADHKAR_ITEM.test(u.pathname)) { e.respondWith(networkFirst(r, CONTENT)); return }
    if (STATIC_API.test(u.pathname)) {
      e.respondWith(caches.match(r.url, { cacheName: CONTENT }).then((hit) => hit || fetch(r).then((res) => {
        if (res.ok) { const cp = res.clone(); caches.open(CONTENT).then((c) => c.put(r.url, cp)) }
        return res
      })))
      return
    }
    // The signed-in user's own data: show last known copy when offline (cleared on sign-out).
    if (r.headers.has('Authorization')) e.respondWith(networkFirst(r, USER))
    return
  }

  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(async () => (await caches.match('/', { cacheName: SHELL_CACHE })) || Response.error()))
    return
  }

  e.respondWith(caches.match(r, { cacheName: SHELL_CACHE }).then((hit) => hit || fetch(r).then((res) => {
    if (res.ok && (u.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|woff2?|ico)$/.test(u.pathname))) { const cp = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(r, cp)) }
    return res
  })))
})
