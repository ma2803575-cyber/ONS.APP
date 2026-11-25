import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { get, post, del } from '../api'
import { useApp } from '../store'
import { PageHeader, useLoad, Spinner, ErrorBox, Empty } from '../components/ui'
import Icon from '../components/Icon'
import { toAr, copyText } from '../lib'

export function Adhkar() {
  const { user } = useApp(); const d = useLoad(() => get('/adhkar'), [])
  const [q, setQ] = useState(''); const [grp, setGrp] = useState(null)
  const favs = useLoad(() => (user ? get('/adhkar-favorites') : Promise.resolve([])), [user])
  const cats = d.data?.categories || []
  const norm = (s) => s.replace(/[\u064B-\u065F]/g, '')
  const list = q ? cats.filter((c) => norm(c.category).includes(norm(q))) : grp ? cats.filter((c) => grp.ids.includes(c.id)) : []
  return (
    <div className="space-y-4"><PageHeader title="الأذكار والأدعية" back={false} subtitle="من حصن المسلم" />
      {d.loading && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {d.data && (<>
        <div className="grid grid-cols-2 gap-3">{d.data.featured.map((f, i) => (
          <Link key={f.key} to={`/adhkar/${f.id}`} className="card flex flex-col items-center gap-2 py-5 hover:ring-2 ring-gold-400"><Icon name={['sun', 'moon', 'flame', 'check'][i]} className="w-8 h-8 text-gold-600" /><span className="font-bold text-center text-sm">{f.name}</span></Link>))}</div>
        <Link to="/adhkar-favorites" className="btn-ghost w-full"><Icon name="heart" />أذكاري المفضلة {user && favs.data ? `(${toAr(favs.data.length)})` : ''}</Link>
        <input className="input" placeholder="ابحث في أقسام الأذكار" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في الأذكار" />
        <div className="flex flex-wrap gap-2">{d.data.groups.map((g) => <button key={g.name} className={`chip ${grp?.name === g.name ? 'chip-on' : ''}`} onClick={() => { setGrp(grp?.name === g.name ? null : g); setQ('') }}>{g.name}</button>)}</div>
        {(q || grp) && (list.length ? <div className="space-y-2">{list.map((c) => <Link key={c.id} to={`/adhkar/${c.id}`} className="card !p-3 flex justify-between hover:ring-2 ring-gold-400"><span className="font-semibold">{c.category}</span><span className="muted">{toAr(c.count)}</span></Link>)}</div> : <Empty icon="search" title="لا نتائج">جرّب كلمة أخرى.</Empty>)}
        {!q && !grp && <details className="card"><summary className="font-bold cursor-pointer">كل الأقسام ({toAr(cats.length)})</summary><div className="mt-3 space-y-1 max-h-96 overflow-y-auto">{cats.map((c) => <Link key={c.id} to={`/adhkar/${c.id}`} className="block py-2 border-b border-emerald-900/10">{c.category}</Link>)}</div></details>}
        <p className="muted text-center">{d.data.source}</p></>)}
    </div>
  )
}

export function DhikrCard({ it, catId, onFav, user, notify }) {
  const [n, setN] = useState(0); const target = it.count || 1; const done = n >= target
  const bump = () => { if (!done) { setN(n + 1); if (navigator.vibrate) navigator.vibrate(8) } }
  return (
    <div className={`card ${done ? 'ring-2 ring-emerald-500' : ''}`}>
      <p className="leading-[2.2] text-lg whitespace-pre-line font-quran !text-[22px]">{it.text}</p>
      <div className="flex items-center gap-2 mt-3 flex-wrap"><span className="chip">التكرار: {toAr(target)}</span>
        <button className={`btn ${done ? 'bg-emerald-600 text-white' : 'btn-gold'}`} onClick={bump} aria-label="عدّ"><span className="font-extrabold">{toAr(n)}</span>/{toAr(target)}{done && <Icon name="check" />}</button>
        {n > 0 && <button className="btn-ghost !p-2" aria-label="إعادة" onClick={() => setN(0)}><Icon name="refresh" /></button>}
        <button className="btn-ghost !p-2 mr-auto" aria-label="نسخ" onClick={async () => notify((await copyText(it.text)) ? 'نُسخ' : 'تعذر النسخ')}><Icon name="copy" /></button>
        <button className={`btn-ghost !p-2 ${it.favorite ? 'text-red-600' : ''}`} aria-label="مفضلة" onClick={() => onFav(it)}><Icon name="heart" fill={it.favorite} /></button></div>
    </div>
  )
}

export function AdhkarCategory() {
  const { id } = useParams(); const { user, notify } = useApp()
  const d = useLoad(() => get('/adhkar/' + id), [id, user])
  const [fav, setFav] = useState({})
  const onFav = async (it) => {
    if (!user) return notify('سجّل الدخول لحفظ المفضلة', 'err')
    const on = fav[it.id] ?? it.favorite
    try { on ? await del(`/adhkar-favorites/${id}/${it.id}`) : await post('/adhkar-favorites', { cat_id: Number(id), item_id: it.id }); setFav({ ...fav, [it.id]: !on }) } catch (e) { notify(e.message, 'err') }
  }
  const markDone = async () => { try { await post('/adhkar-done/' + id); notify('سُجّل إتمام الذكر اليوم') } catch (e) { notify(e.message, 'err') } }
  return (
    <div className="space-y-3"><PageHeader title={d.data?.category || '...'} />
      {d.loading && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {d.data?.items.map((it) => <DhikrCard key={it.id} it={{ ...it, favorite: fav[it.id] ?? it.favorite }} catId={id} onFav={onFav} user={user} notify={notify} />)}
      {d.data && (<>{user ? <button className="btn-primary w-full" onClick={markDone}><Icon name="check" />أتممت هذا القسم اليوم</button> : <p className="muted text-center">سجّل الدخول لتسجيل إتمام الأذكار اليومي.</p>}
        <p className="muted text-center">المصدر: {d.data.source}. {d.data.note}</p></>)}
    </div>
  )
}
export function AdhkarFavorites() {
  const { user, notify } = useApp(); const f = useLoad(() => (user ? get('/adhkar-favorites') : Promise.resolve([])), [user])
  return (<div className="space-y-3"><PageHeader title="أذكاري المفضلة" />
    {!user && <Empty icon="heart" title="تحتاج حساباً">سجّل الدخول لحفظ أذكارك المفضلة.</Empty>}
    {user && f.data?.length === 0 && <Empty icon="heart" title="لا مفضلة بعد">اضغط على القلب في أي ذكر.</Empty>}
    {f.data?.map((it) => <div key={it.cat_id + '-' + it.id}><div className="muted mb-1">{it.category}</div><DhikrCard it={it} catId={it.cat_id} user={user} notify={notify} onFav={async () => { await del(`/adhkar-favorites/${it.cat_id}/${it.id}`); f.reload() }} /></div>)}</div>)
}
