import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { get, post, patch, put, del, setToken, getToken } from './api'
import { readJSON, writeJSON } from './lib'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const DEFAULTS = { dark: false, fontSize: 28, reciter: 'ar.alafasy', tafsir: 'muyassar', reminderOn: false, reminderTime: '21:00' }

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [settings, setSettingsState] = useState({ ...DEFAULTS, ...readJSON('ons_settings', {}) })
  const [toast, setToast] = useState(null)
  const [unread, setUnread] = useState(0)
  const tRef = useRef()

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind }); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!settings.dark)
    document.documentElement.style.setProperty('--qsize', settings.fontSize + 'px')
    writeJSON('ons_settings', settings)
  }, [settings])

  const setSettings = useCallback((patchObj) => {
    setSettingsState((s) => ({ ...s, ...patchObj }))
    if (getToken()) patch('/me', { settings: patchObj }).catch(() => {})
  }, [])

  const loadUser = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return }
    try {
      const u = await get('/me'); setUser(u); writeJSON('ons_user', u)
      if (u.settings && Object.keys(u.settings).length) setSettingsState((s) => ({ ...s, ...u.settings }))
    } catch (e) {
      // Offline: stay signed in with the last known profile instead of looking logged out.
      if (e?.status === 0) setUser(readJSON('ons_user', null)); else setUser(null)
    }
    setReady(true)
  }, [])

  useEffect(() => { loadUser(); flushPendingLast(); window.addEventListener('online', flushPendingLast); const f = () => { setUser(null); resetOfflineUserData(true) }; window.addEventListener('ons-logout', f); return () => { window.removeEventListener('ons-logout', f); window.removeEventListener('online', flushPendingLast) } }, [loadUser])

  // A signed-in view without a stored token can only get 401s: fall back to the signed-out state.
  useEffect(() => { if (user && !getToken()) setUser(null) }, [user])

  const refreshUnread = useCallback(async () => {
    if (!getToken()) return setUnread(0)
    try { setUnread((await get('/notifications')).unread) } catch { /* empty */ }
  }, [])
  useEffect(() => { refreshUnread() }, [user, refreshUnread])

  // Local reminder: works only while the app is open in the browser and permission was granted.
  useEffect(() => {
    if (!settings.reminderOn || typeof Notification === 'undefined') return
    const id = setInterval(() => {
      const d = new Date(); const hm = d.toTimeString().slice(0, 5); const key = 'ons_reminded_' + d.toDateString()
      if (hm === settings.reminderTime && Notification.permission === 'granted' && !localStorage.getItem(key)) {
        localStorage.setItem(key, '1')
        new Notification('أُنس | ONS', { body: 'حان وقت وردك اليومي. بالقرب من القرآن تحيا القلوب.' })
      }
    }, 20000)
    return () => clearInterval(id)
  }, [settings.reminderOn, settings.reminderTime])

  const auth = async (path, body) => {
    const r = await post(path, body); setToken(r.token); setUser(r.user)
    if (r.user.settings && Object.keys(r.user.settings).length) setSettingsState((s) => ({ ...s, ...r.user.settings }))
    else patch('/me', { settings }).catch(() => {})
    resetOfflineUserData(); writeJSON('ons_user', r.user)
    await importGuestData(); refreshUnread(); return r.user
  }
  const login = (email, password) => auth('/auth/login', { email, password })
  const register = (name, email, password) => auth('/auth/register', { name, email, password })
  const logout = () => { setToken(null); setUser(null); setUnread(0); resetOfflineUserData(true) }

  return (
    <Ctx.Provider value={{ user, ready, settings, setSettings, login, register, logout, notify, toast, unread, refreshUnread, setUser }}>
      {children}
    </Ctx.Provider>
  )
}

// Drop the previous user's offline copies and refresh shared content (favorite flags are per user).
export function resetOfflineUserData(signOut = false) {
  try { localStorage.removeItem('ons_user'); if (signOut) { localStorage.removeItem('ons_g_last'); localStorage.removeItem('ons_last_pending') } if (window.caches) caches.delete('ons-user'); navigator.serviceWorker?.controller?.postMessage('refresh-content') } catch { /* empty */ }
}

// ---- guest data (bookmarks / last position) lives in localStorage and is imported on first login ----
export const guest = {
  bookmarks: () => readJSON('ons_g_bookmarks', []),
  setBookmarks: (b) => writeJSON('ons_g_bookmarks', b),
  last: () => readJSON('ons_g_last', null),
  setLast: (g) => writeJSON('ons_g_last', g),
  tasbeeh: () => readJSON('ons_g_tasbeeh', { total: 0, today: 0, day: '' }),
}
async function importGuestData() {
  const bms = guest.bookmarks()
  for (const g of bms) { try { await post('/bookmarks', { ayah: g, note: '' }) } catch { /* empty */ } }
  const last = guest.last()
  if (last) { try { await put('/reading/last', { ayah: last }) } catch { /* empty */ } }
  localStorage.removeItem('ons_g_bookmarks')
}
export { del }

export function useBookmarks() {
  const { user, notify } = useApp()
  const [ids, setIds] = useState(new Set())
  useEffect(() => {
    if (user) get('/bookmarks').then((r) => setIds(new Set(r.map((b) => b.g)))).catch(() => {})
    else setIds(new Set(guest.bookmarks()))
  }, [user])
  const toggle = async (g) => {
    const on = ids.has(g)
    const next = new Set(ids); on ? next.delete(g) : next.add(g)
    setIds(next)
    try {
      if (user) on ? await del('/bookmarks/' + g) : await post('/bookmarks', { ayah: g, note: '' })
      else guest.setBookmarks([...next])
      notify(on ? 'أُزيلت العلامة' : 'أُضيفت علامة مرجعية')
    } catch (e) { setIds(ids); notify(e.message, 'err') }
  }
  return { ids, toggle }
}
// Last-read position: always kept on the device (works offline); signed-in users also sync it to the server,
// and a save that fails offline is retried when the connection returns.
export async function saveLast(user, g) {
  guest.setLast(g)
  if (!user) return
  try { await put('/reading/last', { ayah: g }); localStorage.removeItem('ons_last_pending') }
  catch (e) { if (e?.status === 0) localStorage.setItem('ons_last_pending', String(g)) }
}
export async function flushPendingLast() {
  const g = Number(localStorage.getItem('ons_last_pending')); if (!g || !getToken()) return
  try { await put('/reading/last', { ayah: g }); localStorage.removeItem('ons_last_pending') } catch { /* retry later */ }
}
// One ayah, even offline: falls back to the surah text that the service worker saved for offline reading.
export async function ayahAnywhere(g) {
  try { return await get('/ayah/' + g + '?tafsir=none') } catch (e) {
    if (e?.status !== 0) throw e
    const list = await get('/surahs'); const s = [...list].reverse().find((x) => x.first_g <= g)
    const d = s && await get('/surahs/' + s.n); const a = d?.ayahs.find((x) => x.g === g)
    if (!a) throw e
    return a
  }
}
// Last-read ayah to show: server copy when reachable, otherwise the copy on this device.
export async function lastReadAyah(user) {
  const local = guest.last()
  if (user) { try { const r = await get('/reading/last'); if (r) return r } catch (e) { if (e?.status !== 0) throw e } }
  return local ? ayahAnywhere(local) : null
}
