import { useState } from 'react'
import { get, post, del } from '../api'
import { PageHeader, Spinner, ErrorBox, useLoad, LoginGate, Empty } from '../components/ui'
import Icon from '../components/Icon'
import { useApp } from '../store'
import { toAr } from '../lib'

const MEDAL = ['🥇', '🥈', '🥉']
export default function Circles() {
  const { user, notify } = useApp()
  const d = useLoad(() => (user ? get('/circles') : Promise.resolve(null)), [user])
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false)
  if (!user) return <div><PageHeader title="تحدي الأصحاب" /><LoginGate what="سجّل دخولك لتنشئ مجموعة وتتحدى أصحابك في الختمة." /></div>
  const act = async (f, ok) => { setBusy(true); try { await f(); notify(ok); setName(''); setCode(''); d.reload() } catch (e) { notify(e.message, 'err') } finally { setBusy(false) } }
  const invite = (c) => {
    const text = `انضم لتحدي الختمة «${c.name}» على تطبيق أُنس. كود المجموعة: ${c.code}\n${location.origin}/circles`
    if (navigator.share) navigator.share({ text }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }
  return (
    <div className="space-y-4">
      <PageHeader title="تحدي الأصحاب" subtitle="ترتيب أسبوعي بعدد الصفحات المقروءة" />
      <div className="card space-y-3">
        <div className="font-bold">أنشئ مجموعة</div>
        <div className="flex gap-2"><input className="input" placeholder="اسم المجموعة (مثل: شلة الختمة)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="اسم المجموعة" />
          <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => act(() => post('/circles', { name }), 'تم إنشاء المجموعة')}>إنشاء</button></div>
        <div className="font-bold pt-1">انضم بكود</div>
        <div className="flex gap-2"><input className="input text-center tracking-widest" dir="ltr" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} aria-label="كود المجموعة" />
          <button className="btn-gold" disabled={busy || code.trim().length < 4} onClick={() => act(() => post('/circles/join', { code }), 'انضممت للمجموعة')}>انضمام</button></div>
      </div>
      {d.loading && !d.data && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {d.data && d.data.length === 0 && <Empty icon="user" title="لا توجد مجموعات بعد">أنشئ مجموعة وأرسل الكود لأصحابك ليبدأ التحدي.</Empty>}
      {d.data?.map((c) => (
        <div key={c.id} className="card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div><div className="font-extrabold text-lg">{c.name}</div><div className="muted">الكود: <b dir="ltr" className="tracking-widest">{c.code}</b> · {toAr(c.members.length)} أعضاء</div></div>
            <button className="btn-gold !px-3" onClick={() => invite(c)}><Icon name="share" />دعوة</button>
          </div>
          <div className="space-y-2">{c.members.map((m) => (
            <div key={m.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${m.me ? 'bg-gold-100 dark:bg-gold-500/20 ring-1 ring-gold-400' : 'bg-emerald-900/5 dark:bg-emerald-100/10'}`}>
              <span className="w-8 text-center text-lg">{MEDAL[m.rank - 1] || toAr(m.rank)}</span>
              <div className="flex-1 min-w-0"><div className="font-bold truncate">{m.name}{m.me && ' (أنت)'}</div><div className="muted">{toAr(m.total)} صفحة إجمالاً · {toAr(m.streak)} يوم متواصل</div></div>
              <div className="text-center"><div className="font-extrabold text-xl">{toAr(m.week)}</div><div className="text-[11px] muted">هذا الأسبوع</div></div>
            </div>))}</div>
          <button className="btn-danger mt-3 !py-1.5" onClick={() => confirm('تغادر المجموعة؟') && act(() => del('/circles/' + c.id), 'غادرت المجموعة')}>مغادرة المجموعة</button>
        </div>))}
    </div>
  )
}
