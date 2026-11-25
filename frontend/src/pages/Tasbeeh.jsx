import { useEffect, useRef, useState } from 'react'
import { get, post } from '../api'
import { useApp, guest } from '../store'
import { PageHeader, Ring } from '../components/ui'
import Icon from '../components/Icon'
import { toAr, readJSON, writeJSON, todayISO } from '../lib'

const PHRASES = ['سبحان الله', 'الحمد لله', 'الله أكبر', 'لا إله إلا الله', 'أستغفر الله', 'اللهم صل وسلم على نبينا محمد']
export default function Tasbeeh() {
  const { user, notify } = useApp()
  const [phrase, setPhrase] = useState(PHRASES[0]); const [count, setCount] = useState(0); const [goal, setGoal] = useState(33)
  const [stats, setStats] = useState(null); const pending = useRef(0); const timer = useRef()
  const load = () => user && get('/tasbeeh').then(setStats).catch(() => {})
  useEffect(() => { load() }, [user]) // eslint-disable-line
  const flush = async () => {
    const n = pending.current; if (!n) return; pending.current = 0
    if (user) { try { await post('/tasbeeh', { phrase, count: n }); load() } catch (e) { pending.current += n; notify(e.message, 'err') } }
    else { const g = readJSON('ons_g_tasbeeh', { total: 0, today: 0, day: '' }); if (g.day !== todayISO()) { g.today = 0; g.day = todayISO() } g.total += n; g.today += n; writeJSON('ons_g_tasbeeh', g) }
  }
  useEffect(() => () => { flush() }, []) // eslint-disable-line
  const tap = () => {
    const c = count + 1; setCount(c); pending.current += 1
    if (navigator.vibrate) navigator.vibrate(c % goal === 0 ? [30, 40, 30] : 6)
    clearTimeout(timer.current); timer.current = setTimeout(flush, 1200)
    if (c % goal === 0) notify(`أتممت ${toAr(goal)}`)
  }
  const reset = async () => { await flush(); setCount(0) }
  const g = guest.tasbeeh()
  const today = user ? stats?.today ?? 0 : g.day === todayISO() ? g.today : 0
  return (
    <div className="space-y-4"><PageHeader title="المسبحة الإلكترونية" back={false} />
      <div className="flex flex-wrap gap-2">{PHRASES.map((p) => <button key={p} className={`chip ${phrase === p ? 'chip-on' : ''}`} onClick={async () => { await flush(); setPhrase(p); setCount(0) }}>{p}</button>)}</div>
      <div className="card flex flex-col items-center gap-4 py-8">
        <div className="text-xl font-bold text-center">{phrase}</div>
        <button onClick={tap} aria-label={`تسبيح، العدد ${count}`} className="rounded-full active:scale-95 transition select-none"><Ring percent={((count % goal) / goal) * 100} size={220} stroke={14} label={toAr(count)} sub={`الهدف ${toAr(goal)}`} /></button>
        <div className="flex gap-2 flex-wrap justify-center">{[33, 99, 100].map((x) => <button key={x} className={`chip ${goal === x ? 'chip-on' : ''}`} onClick={() => setGoal(x)}>{toAr(x)}</button>)}</div>
        <button className="btn-ghost" onClick={reset}><Icon name="refresh" />إعادة ضبط العدّاد</button></div>
      <div className="grid grid-cols-2 gap-3 text-center"><div className="card"><div className="muted">اليوم</div><div className="font-extrabold text-2xl">{toAr(today + 0)}</div></div>
        <div className="card"><div className="muted">الإجمالي</div><div className="font-extrabold text-2xl">{toAr(user ? stats?.total ?? 0 : g.total)}</div></div></div>
      {!user && <p className="muted text-center">بدون حساب يُحفظ مجموعك على هذا الجهاز فقط.</p>}
    </div>
  )
}
