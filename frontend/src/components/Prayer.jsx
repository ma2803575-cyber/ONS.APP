import { useEffect, useState } from 'react'
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan'
import { readJSON, writeJSON, toAr } from '../lib'

const NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' }
const CAIRO = { lat: 30.0444, lon: 31.2357, city: 'القاهرة' }
const hm = (d) => new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d)

function compute(loc, date) {
  const p = new PrayerTimes(new Coordinates(loc.lat, loc.lon), date, CalculationMethod.Egyptian())
  return ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => ({ k, t: p[k] }))
}
export function nextPrayer(loc, now = new Date()) {
  const today = compute(loc, now).filter((x) => x.k !== 'sunrise')
  const n = today.find((x) => x.t > now)
  if (n) return { ...n, all: compute(loc, now) }
  const tmr = new Date(now.getTime() + 864e5)
  return { ...compute(loc, tmr)[0], all: compute(loc, now) }
}
export default function Prayer() {
  const [loc, setLoc] = useState(readJSON('ons_loc', CAIRO)); const [now, setNow] = useState(new Date()); const [open, setOpen] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t) }, [])
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { const l = { lat: p.coords.latitude, lon: p.coords.longitude, city: 'موقعك' }; writeJSON('ons_loc', l); setLoc(l) }, () => {}, { timeout: 8000 })
  const n = nextPrayer(loc, now)
  const diff = Math.max(0, Math.round((n.t - now) / 60000)), h = Math.floor(diff / 60), m = diff % 60
  return (
    <div className="card">
      <button className="w-full flex items-center justify-between text-right" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div><div className="muted">الصلاة القادمة · {loc.city}</div><div className="font-extrabold text-xl">{NAMES[n.k]} <span className="text-base font-semibold">{hm(n.t)}</span></div></div>
        <div className="text-center rounded-xl bg-gold-100 dark:bg-gold-500/20 px-3 py-1"><div className="font-extrabold text-lg">{h > 0 ? `${toAr(h)}س ${toAr(m)}د` : `${toAr(m)} دقيقة`}</div><div className="text-[11px] muted">متبقي</div></div>
      </button>
      {open && (<div className="mt-3 pt-3 border-t border-emerald-900/10 dark:border-emerald-100/10">
        <div className="grid grid-cols-3 gap-2 text-center">{n.all.map((x) => <div key={x.k} className={`rounded-xl py-2 ${x.k === n.k ? 'bg-emerald-700 text-white dark:bg-gold-500 dark:text-emerald-950' : 'bg-emerald-900/5 dark:bg-emerald-100/10'}`}><div className="text-xs">{NAMES[x.k]}</div><div className="font-bold">{hm(x.t)}</div></div>)}</div>
        <button className="btn-ghost w-full mt-3" onClick={locate}>تحديد موقعي لمواقيت أدق</button>
        <p className="muted mt-2 text-center">الحساب على جهازك بطريقة الهيئة المصرية العامة للمساحة، وبدون إنترنت.</p>
      </div>)}
    </div>
  )
}
