import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { get, post, del } from '../api'
import { useApp } from '../store'
import { PageHeader, useLoad, Spinner, ErrorBox, Ring, Bar, LoginGate, Empty } from '../components/ui'
import Icon from '../components/Icon'
import { toAr } from '../lib'

function PlanForm({ onDone, initial }) {
  const { notify } = useApp()
  const [days, setDays] = useState(initial || 30); const [custom, setCustom] = useState(''); const [rem, setRem] = useState(''); const [busy, setBusy] = useState(false)
  const d = custom ? Number(custom) : days
  const ok = Number.isInteger(d) && d >= 1 && d <= 1000
  const submit = async () => {
    if (!ok) return notify('اكتب عدد أيام بين 1 و1000', 'err')
    setBusy(true)
    try { await post('/khatma/plan', { days: d, reminder_time: rem }); notify('بدأت الختمة'); onDone() } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div className="card space-y-4"><div className="font-bold">اختر مدة الختمة</div>
      <div className="flex flex-wrap gap-2">{[30, 60, 90].map((x) => <button key={x} className={`chip ${!custom && days === x ? 'chip-on' : ''}`} onClick={() => { setDays(x); setCustom('') }}>{toAr(x)} يوماً</button>)}</div>
      <label className="block"><span className="text-sm font-semibold">أو مدة تحددها (بالأيام)</span><input className="input mt-1" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="مثال: 45" /></label>
      <label className="block"><span className="text-sm font-semibold">وقت التذكير (اختياري)</span><input type="time" className="input mt-1" value={rem} onChange={(e) => setRem(e.target.value)} /></label>
      <div className="rounded-xl bg-gold-100 dark:bg-gold-500/20 p-3 text-sm">{ok ? <>وردك: <b>{toAr(Math.ceil(604 / d))}</b> صفحة يومياً (≈ {toAr(Math.round((604 / d / 20) * 10) / 10)} جزء)</> : 'أدخل مدة صحيحة'}</div>
      <button className="btn-primary w-full" disabled={busy || !ok} onClick={submit}>ابدأ الختمة</button></div>
  )
}

function useKhatma() { const { user } = useApp(); return useLoad(() => (user ? get('/khatma') : Promise.resolve(null)), [user]) }

export function Khatma() {
  const { user, notify } = useApp(); const k = useKhatma(); const [newPlan, setNewPlan] = useState(false)
  const h = useLoad(() => (user ? get('/khatma/history?days=14') : Promise.resolve(null)), [user, k.data?.pages_done])
  if (!user) return <div><PageHeader title="متابع الختمة" back={false} /><LoginGate /></div>
  const s = k.data
  return (
    <div className="space-y-4"><PageHeader title="متابع الختمة" back={false} />
      {k.loading && <Spinner />}{k.error && <ErrorBox error={k.error} retry={k.reload} />}
      {s && (!s.plan || newPlan) && <PlanForm onDone={() => { setNewPlan(false); k.reload() }} />}
      {s?.plan && !newPlan && (<>
        <div className="card flex items-center gap-5"><Ring percent={s.percent} size={130} stroke={12} sub={s.completed ? 'ختمة مباركة' : 'من الختمة'} />
          <div className="flex-1 space-y-1"><div className="font-bold">{toAr(s.pages_done)} / ٦٠٤ صفحة</div><div className="muted">الجزء {toAr(s.juz_done)} من ٣٠ · وردك {toAr(s.plan.pages_per_day)} صفحة يومياً</div>
            <div className="muted">بدأت {s.plan.start_date} · تنتهي {s.plan.end_date}</div>
            <div className={`text-sm font-bold ${s.behind_by > s.plan.pages_per_day ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-300'}`}>{s.completed ? 'أتممت الختمة 🎉' : s.ahead_by > 0 ? `متقدم بـ ${toAr(s.ahead_by)} صفحة` : s.behind_by > 0 ? `متأخر ${toAr(s.behind_by)} صفحة عن الجدول` : 'على الجدول تماماً'}</div></div></div>
        <div className="card"><div className="flex justify-between mb-2"><b>اليوم</b><span>{toAr(s.today_pages)} / {toAr(s.today_target)}</span></div><Bar value={s.today_pages} max={s.today_target} />
          <div className="flex flex-wrap gap-2 mt-3">{[1, 5, 10].map((n) => <button key={n} className="btn-ghost" onClick={async () => { try { await post('/khatma/log', { pages: n }); k.reload() } catch (e) { notify(e.message, 'err') } }}>+{toAr(n)} صفحة</button>)}
            <Link className="btn-gold" to={`/surah/${s.next_ayah.surah}?g=${s.next_ayah.g}`}><Icon name="book2" />تابع القراءة (صفحة {toAr(s.next_page)})</Link></div></div>
        {h.data && <div className="card"><div className="font-bold mb-2">آخر 14 يوماً</div><div style={{ height: 150 }}><ResponsiveContainer><AreaChart data={h.data.map((x) => ({ ...x, day: x.day.slice(5) }))}><XAxis dataKey="day" tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => [v, 'صفحات']} /><Area dataKey="pages" stroke="#2f4ea8" fill="#c9a24b55" /></AreaChart></ResponsiveContainer></div></div>}
        <div className="flex gap-2"><button className="btn-ghost" onClick={() => setNewPlan(true)}>خطة جديدة</button><button className="btn-danger" onClick={async () => { if (confirm('إيقاف الخطة الحالية؟ سجل قراءتك لن يُحذف.')) { await del('/khatma/plan'); k.reload() } }}>إيقاف الخطة</button></div>
      </>)}
    </div>
  )
}

export function Wird() {
  const { user, notify } = useApp(); const k = useKhatma(); const s = k.data
  if (!user) return <div><PageHeader title="الورد اليومي" /><LoginGate what="سجّل دخولك لتحديد وردك اليومي ومتابعته." /></div>
  return (
    <div className="space-y-4"><PageHeader title="الورد اليومي" />
      {k.loading && <Spinner />}{k.error && <ErrorBox error={k.error} retry={k.reload} />}
      {s && !s.plan && <Empty icon="flame" title="لم تحدد ورداً بعد">ورد اليوم يُحسب من خطة الختمة. اختر مدة وسنحسب لك عدد الصفحات.<div className="mt-3"><Link to="/khatma" className="btn-primary">إنشاء خطة</Link></div></Empty>}
      {s?.plan && (<>
        <div className="card flex flex-col items-center gap-3"><Ring percent={Math.min(100, Math.round(s.today_pages * 100 / s.today_target))} size={160} stroke={14} label={`${toAr(s.today_pages)}/${toAr(s.today_target)}`} sub="صفحات اليوم" />
          <div className="font-bold">{s.today_remaining ? `بقي ${toAr(s.today_remaining)} صفحة` : 'أتممت وردك اليوم، تقبّل الله منك'}</div>
          <div className="muted flex items-center gap-1"><Icon name="flame" className="w-4 h-4 text-orange-500" />{toAr(s.streak)} يوم متواصل</div></div>
        <Link to={`/surah/${s.next_ayah.surah}?g=${s.next_ayah.g}`} className="btn-gold w-full"><Icon name="book2" />ابدأ من صفحة {toAr(s.next_page)}</Link>
        <div className="grid grid-cols-3 gap-2">{[1, 5, s.today_remaining || 1].map((n, i) => <button key={i} className="btn-primary" onClick={async () => { try { await post('/khatma/log', { pages: n }); k.reload(); notify('سُجّل') } catch (e) { notify(e.message, 'err') } }}>سجّل {toAr(n)}</button>)}</div>
        <p className="muted text-center">وردك مأخوذ من ختمة {toAr(s.plan.days)} يوماً. يمكنك أيضاً الضغط على «وصلت هنا» من أي آية في المصحف.</p></>)}
    </div>
  )
}
