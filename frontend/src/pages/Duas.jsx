import { useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post, del } from '../api'
import { useApp } from '../store'
import { PageHeader, useLoad, Spinner, ErrorBox, Empty } from '../components/ui'
import Icon from '../components/Icon'
import { toAr, copyText } from '../lib'

export function Duas() {
  const { notify } = useApp(); const d = useLoad(() => get('/duas'), []); const [tab, setTab] = useState('quranic'); const [cat, setCat] = useState(null)
  const groups = d.data?.[tab] || []; const cur = groups.find((g) => g.category === cat) || null
  return (
    <div className="space-y-4"><PageHeader title="مكتبة الأدعية" />
      {d.loading && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {d.data && (<>
        <div className="flex gap-2">{[['quranic', 'أدعية من القرآن'], ['sunnah', 'أدعية من السنة (حصن المسلم)']].map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'chip-on' : ''}`} onClick={() => { setTab(k); setCat(null) }}>{l}</button>)}</div>
        <div className="flex flex-wrap gap-2">{groups.map((g) => <button key={g.category} className={`chip ${cat === g.category ? 'chip-on' : ''}`} onClick={() => setCat(g.category)}>{g.category}</button>)}</div>
        {!cur && <Empty icon="heart" title="اختر المناسبة">اختر تصنيفاً من الأعلى.</Empty>}
        {cur?.items.map((it, i) => (<div className="card" key={i}><p className="font-quran !text-[24px] leading-[2.3]">{tab === 'quranic' ? it.text : it.text}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap"><span className="muted">{tab === 'quranic' ? it.ref : it.title}</span>{it.count > 1 && <span className="chip">التكرار {toAr(it.count)}</span>}
            {tab === 'quranic' && <Link className="muted underline" to={`/surah/${it.surah}?g=${it.g}`}>في المصحف</Link>}
            <button className="btn-ghost !p-2 mr-auto" aria-label="نسخ" onClick={async () => notify((await copyText(it.text)) ? 'نُسخ' : 'تعذر')}><Icon name="copy" /></button></div></div>))}
        <p className="muted text-center">{tab === 'quranic' ? d.data.sources.quran : d.data.sources.sunnah}</p></>)}
    </div>
  )
}

export function Sadaqah() {
  const { user, notify } = useApp(); const s = useLoad(() => get('/sadaqah'), []); const dd = useLoad(() => get('/deceased-duas'), [])
  const names = useLoad(() => (user ? get('/deceased') : Promise.resolve([])), [user])
  const [f, setF] = useState({ name: '', note: '' })
  const add = async () => {
    if (f.name.trim().length < 2) return notify('اكتب الاسم', 'err')
    try { await post('/deceased', f); setF({ name: '', note: '' }); names.reload() } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="space-y-4"><PageHeader title="الصدقة والدعاء للمتوفين" />
      <div className="card"><div className="font-bold mb-2">أحبّاؤنا الذين رحلوا</div>
        {!user ? <p className="muted">سجّل الدخول لحفظ قائمة أسماء أحبابك المتوفين. الأدعية أدناه متاحة للجميع.</p> : (<>
          <div className="flex gap-2 mb-2"><input className="input" placeholder="الاسم" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="الاسم" /><button className="btn-primary" onClick={add}><Icon name="plus" /></button></div>
          <input className="input mb-2" placeholder="ملاحظة (اختياري)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="ملاحظة" />
          {names.data?.map((n) => <div key={n.id} className="flex items-center justify-between py-2 border-b border-emerald-900/10"><div><div className="font-semibold">{n.name} <span className="muted">رحمه الله</span></div>{n.note && <div className="muted">{n.note}</div>}</div><button aria-label="حذف" className="text-red-600" onClick={async () => { await del('/deceased/' + n.id); names.reload() }}><Icon name="trash" className="w-4 h-4" /></button></div>)}
          {names.data?.length > 0 && <p className="muted mt-2">ادعُ لهم بالأدعية التالية.</p>}</>)}</div>
      <div className="font-bold">أدعية للمتوفين</div>
      {dd.loading && <Spinner />}
      {dd.data?.items.map((it, i) => <div className="card" key={i}><p className="font-quran !text-[22px] leading-[2.2]">{it.text}</p><div className="muted mt-1">{it.ref || it.title} · {it.source}</div></div>)}
      <div className="font-bold mt-2">الصدقة الجارية</div>
      {s.data && (<div className="card"><p className="leading-8">{s.data.intro}</p>
        <div className="mt-3 space-y-2">{s.data.orgs.map((o) => <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-emerald-900/10 p-3 hover:ring-2 ring-gold-400"><Icon name="link" className="text-gold-600" /><div className="flex-1"><div className="font-bold">{o.name}</div><div className="muted">{o.about}</div></div><span className="text-xs muted" dir="ltr">{new URL(o.url).host}</span></a>)}</div>
        <p className="muted mt-3">{s.data.note}</p></div>)}
    </div>
  )
}
