import { useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post, patch, del } from '../api'
import { useApp } from '../store'
import { PageHeader, useLoad, Spinner, ErrorBox, LoginGate, Empty, Bar } from '../components/ui'
import Icon from '../components/Icon'
import { toAr } from '../lib'

export default function Memorization() {
  const { user, notify } = useApp()
  const m = useLoad(() => (user ? get('/memorization') : Promise.resolve(null)), [user])
  const due = useLoad(() => (user ? get('/memorization/due') : Promise.resolve([])), [user, m.data?.memorized])
  const sur = useLoad(() => get('/surahs'), [])
  const [add, setAdd] = useState({ surah: 1, start: 1, end: '' }); const [open, setOpen] = useState(null); const [tab, setTab] = useState('list')
  if (!user) return <div><PageHeader title="الحفظ والمراجعة" /><LoginGate what="سجّل دخولك لإنشاء قائمة حفظ وجدول مراجعة." /></div>
  const cnt = sur.data?.[add.surah - 1]?.count || 7
  const run = async (f, msg) => { try { await f(); if (msg) notify(msg); m.reload() } catch (e) { notify(e.message, 'err') } }
  return (
    <div className="space-y-4"><PageHeader title="الحفظ والمراجعة" back={false} />
      <div className="card space-y-3"><div className="font-bold">إضافة سورة أو آيات إلى قائمة الحفظ</div>
        <div className="grid grid-cols-3 gap-2">
          <select className="input col-span-3" value={add.surah} onChange={(e) => setAdd({ surah: Number(e.target.value), start: 1, end: '' })} aria-label="السورة">{sur.data?.map((x) => <option key={x.n} value={x.n}>{x.n}. {x.name}</option>)}</select>
          <input className="input" type="number" min="1" max={cnt} value={add.start} onChange={(e) => setAdd({ ...add, start: Number(e.target.value) })} aria-label="من آية" placeholder="من" />
          <input className="input" type="number" min="1" max={cnt} value={add.end} onChange={(e) => setAdd({ ...add, end: e.target.value })} aria-label="إلى آية" placeholder={`إلى (${cnt})`} />
          <button className="btn-primary" onClick={() => run(async () => { const r = await post('/memorization', { surah: add.surah, start: add.start || 1, end: add.end ? Number(add.end) : cnt }); notify(r.added ? `أُضيفت ${toAr(r.added)} آية` : 'الآيات مضافة من قبل') })}>إضافة</button></div></div>
      <div className="flex gap-2">{[['list', 'قائمة الحفظ'], ['review', `المراجعة (${toAr(m.data?.due || 0)})`]].map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'chip-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {m.loading && <Spinner />}{m.error && <ErrorBox error={m.error} retry={m.reload} />}
      {m.data && <div className="card"><div className="flex justify-between mb-1 font-bold"><span>التقدم الكلي</span><span>{toAr(m.data.memorized)} / {toAr(m.data.total)} ({toAr(m.data.percent)}%)</span></div><Bar value={m.data.memorized} max={m.data.total || 1} /></div>}
      {tab === 'list' && m.data && m.data.total === 0 && <Empty icon="brain" title="القائمة فارغة">أضف سورة أو نطاق آيات تريد حفظه.</Empty>}
      {tab === 'list' && m.data?.surahs.map((s) => (
        <div key={s.surah} className="card"><button className="w-full flex justify-between items-center" onClick={() => setOpen(open === s.surah ? null : s.surah)}><span className="font-bold">سورة {s.surah_name}</span><span className="muted">{toAr(s.memorized)} / {toAr(s.total)}</span></button>
          <Bar value={s.memorized} max={s.total} className="mt-2" />
          {open === s.surah && <div className="mt-3 space-y-2">{s.ayahs.map((a) => (
            <div key={a.ayah} className="rounded-xl border border-emerald-900/10 p-3"><div className="quran-text !text-[20px] !leading-[2.1] line-clamp-2">{a.text}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2"><span className="muted">آية {toAr(a.n)}</span>
                <button className={`chip ${a.memorized ? 'chip-on' : ''}`} onClick={() => run(() => patch('/memorization/' + a.ayah, { memorized: !a.memorized }))}>{a.memorized ? '✓ محفوظة' : 'علّم كمحفوظة'}</button>
                {a.memorized && <label className="text-sm flex items-center gap-1">الإتقان<select className="input !w-auto !py-1" value={a.mastery} onChange={(e) => run(() => patch('/memorization/' + a.ayah, { mastery: Number(e.target.value) }))}>{[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{toAr(x)}</option>)}</select></label>}
                {a.next_review && <span className="muted">المراجعة: {a.next_review}</span>}
                <button aria-label="حذف" className="mr-auto text-red-600" onClick={() => run(() => del('/memorization/' + a.ayah))}><Icon name="trash" className="w-4 h-4" /></button></div></div>))}</div>}</div>))}
      {tab === 'review' && (<>
        {due.loading && <Spinner />}
        {due.data?.length === 0 && <Empty icon="check" title="لا مراجعة مستحقة اليوم">ما حفظته سيظهر هنا في موعد مراجعته حسب إتقانك.</Empty>}
        {due.data?.map((a) => (<div key={a.ayah} className="card"><div className="muted mb-1">{a.surah_name} · آية {toAr(a.n)}</div><div className="quran-text !text-[22px] !leading-[2.2]">{a.text}</div>
          <div className="mt-3 text-sm font-semibold">كيف كان حفظك؟ (يحدد موعد المراجعة القادمة)</div>
          <div className="flex gap-2 mt-1">{[[1, 'ضعيف'], [2, 'متوسط'], [3, 'جيد'], [4, 'قوي'], [5, 'متقن']].map(([v, l]) => <button key={v} className="btn-ghost flex-1 !px-1 text-xs" onClick={() => run(() => post(`/memorization/${a.ayah}/review`, { mastery: v }), 'سُجّلت المراجعة')}>{l}</button>)}</div>
          <Link className="text-xs muted underline" to={`/surah/${a.surah}?g=${a.g}`}>افتح في المصحف للتحقق</Link></div>))}</>)}
    </div>
  )
}
