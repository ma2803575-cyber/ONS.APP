import { useEffect, useState } from 'react'
import Icon from './Icon'
import { toAr } from '../lib'

const SLOTS = [
  { id: 'morning', h: 6, m: 0, title: 'أذكار الصباح', body: 'ابدأ يومك بذكر الله', to: '/adhkar/1' },
  { id: 'evening', h: 17, m: 30, title: 'أذكار المساء', body: 'حان وقت أذكار المساء', to: '/adhkar/1' },
  { id: 'sleep', h: 22, m: 30, title: 'أذكار النوم', body: 'اختم يومك بأذكار النوم', to: '/adhkar/2' },
  { id: 'wird', h: 20, m: 0, title: 'وردك اليومي', body: 'اقرأ صفحاتك قبل أن ينتهي اليوم', to: '/wird' },
]
const KEY = 'ons_rem'
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { on: false, slots: {} } } catch { return { on: false, slots: {} } } }

async function notify(s) {
  const opts = { body: s.body, icon: '/icon-192.png', tag: 'ons-' + s.id, data: { url: s.to }, lang: 'ar', dir: 'rtl' }
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification(s.title, opts) } catch { /* fall back */ }
  try { new Notification(s.title, opts) } catch { /* ignore */ }
}

export function useReminderTicker() {
  useEffect(() => {
    const tick = () => {
      const st = load(); if (!st.on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = new Date(); const day = now.toISOString().slice(0, 10); const sent = JSON.parse(localStorage.getItem(KEY + '_sent') || '{}')
      SLOTS.forEach((s) => {
        if (st.slots[s.id] === false) return
        const due = now.getHours() > s.h || (now.getHours() === s.h && now.getMinutes() >= s.m)
        if (due && now.getHours() * 60 + now.getMinutes() < s.h * 60 + s.m + 90 && sent[s.id] !== day) { sent[s.id] = day; localStorage.setItem(KEY + '_sent', JSON.stringify(sent)); notify(s) }
      })
    }
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t)
  }, [])
}

export default function Reminders() {
  const [st, setSt] = useState(load); const [msg, setMsg] = useState('')
  const save = (n) => { setSt(n); localStorage.setItem(KEY, JSON.stringify(n)) }
  const toggle = async () => {
    if (st.on) return save({ ...st, on: false })
    if (typeof Notification === 'undefined') return setMsg('المتصفح لا يدعم التنبيهات. ثبّت التطبيق على الشاشة الرئيسية.')
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (p === 'granted') { save({ ...st, on: true }); setMsg(''); notify({ id: 'test', title: 'تم تفعيل التذكيرات', body: 'سنذكّرك بالأذكار والورد في أوقاتها', to: '/' }) } else setMsg('لم يتم السماح بالتنبيهات من إعدادات المتصفح.')
  }
  return (
    <div className="card">
      <div className="flex items-center justify-between"><div className="font-bold flex items-center gap-2"><Icon name="bell" className="w-5 h-5 text-gold-600" />تذكيرات الأذكار والورد</div>
        <button onClick={toggle} role="switch" aria-checked={st.on} aria-label="تفعيل التذكيرات" className={`w-12 h-7 rounded-full p-1 transition ${st.on ? 'bg-gold-500' : 'bg-gray-300'}`}><span className={`block w-5 h-5 rounded-full bg-white transition ${st.on ? '-translate-x-5' : ''}`} /></button></div>
      {st.on && <div className="flex flex-wrap gap-2 mt-3">{SLOTS.map((s) => { const on = st.slots[s.id] !== false; return <button key={s.id} className={`chip ${on ? 'chip-on' : ''}`} onClick={() => save({ ...st, slots: { ...st.slots, [s.id]: !on } })}>{s.title} · {toAr(String(s.h).padStart(2, '0'))}:{toAr(String(s.m).padStart(2, '0'))}</button> })}</div>}
      {msg && <p className="muted mt-2">{msg}</p>}
      <p className="muted mt-2 text-xs">تعمل التنبيهات أثناء فتح التطبيق أو تثبيته على الشاشة الرئيسية.</p>
    </div>)
}
