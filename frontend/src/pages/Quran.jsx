import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { get } from '../api'
import { PageHeader, Spinner, ErrorBox, useLoad, Empty } from '../components/ui'
import Icon from '../components/Icon'
import { useApp, guest, useBookmarks, ayahAnywhere, lastReadAyah } from '../store'
import { toAr } from '../lib'

export default function Quran() {
  const { user } = useApp()
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [tab, setTab] = useState('surah')
  const s = useLoad(() => get('/surahs'), [])
  const last = useLoad(() => lastReadAyah(user), [user])

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); setErr(''); return }
    const t = setTimeout(async () => {
      setBusy(true); setErr('')
      try { setRes(await get('/search?q=' + encodeURIComponent(q.trim()))) } catch (e) { setErr(e.message) } finally { setBusy(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const lastAyah = last.data && (last.data.then ? null : last.data)
  return (
    <div>
      <PageHeader title="المصحف الشريف" back={false} right={<Link to="/bookmarks" className="btn-ghost"><Icon name="bookmark" />العلامات</Link>} />
      <div className="relative mb-3"><Icon name="search" className="w-5 h-5 absolute top-3.5 right-3 opacity-50" />
        <input className="input !pr-10" placeholder="ابحث عن سورة أو كلمة أو آية (مثل 2:255)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في القرآن" /></div>

      {q.trim().length >= 2 ? (
        <div className="space-y-3">
          {busy && <Spinner />}{err && <ErrorBox error={err} />}
          {res && !busy && (<>
            {res.surahs.length > 0 && <div className="flex flex-wrap gap-2">{res.surahs.map((x) => <Link key={x.n} to={`/surah/${x.n}`} className="chip chip-on">سورة {x.name}</Link>)}</div>}
            {res.ayahs.length === 0 && res.surahs.length === 0 && <Empty icon="search" title="لا نتائج">جرّب كلمة أخرى بدون تشكيل.</Empty>}
            {res.ayahs.map((a) => (
              <Link key={a.g} to={`/surah/${a.surah}?g=${a.g}`} className="card block hover:ring-2 ring-gold-400">
                <div className="quran-text !text-[22px] !leading-[2.2]">{a.text}</div>
                <div className="muted mt-1">{a.surah_name} · آية {toAr(a.n)} · صفحة {toAr(a.page)}</div>
              </Link>))}
            {res.ayahs.length >= 30 && <p className="muted text-center">عُرضت أول 30 نتيجة. ضيّق البحث لنتائج أدق.</p>}
          </>)}
        </div>
      ) : (<>
        {lastAyah && <Link to={`/surah/${lastAyah.surah}?g=${lastAyah.g}`} className="card flex items-center gap-3 mb-3 bg-gradient-to-l from-gold-100 to-white dark:from-gold-500/10"><Icon name="book2" className="w-8 h-8 text-gold-600" /><div className="flex-1"><div className="font-bold">تابع من آخر موضع</div><div className="muted">سورة {lastAyah.surah_name} · آية {toAr(lastAyah.n)}</div></div></Link>}
        <div className="flex gap-2 mb-3">{[['surah', 'السور'], ['juz', 'الأجزاء']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-on' : ''}`}>{l}</button>)}</div>
        {s.loading && <Spinner />}{s.error && <ErrorBox error={s.error} retry={s.reload} />}
        {tab === 'surah' && s.data && <div className="grid sm:grid-cols-2 gap-2">{s.data.map((x) => (
          <Link key={x.n} to={`/page/${x.page}`} className="card !p-3 flex items-center gap-3 hover:ring-2 ring-gold-400">
            <span className="w-10 h-10 shrink-0 rotate-45 rounded-lg border-2 border-gold-500 flex items-center justify-center"><span className="-rotate-45 font-bold text-sm">{toAr(x.n)}</span></span>
            <div className="flex-1 min-w-0"><div className="font-bold quran-title text-lg">{x.name}</div><div className="muted">{x.type === 'Meccan' ? 'مكية' : 'مدنية'} · {toAr(x.count)} آية</div></div>
            <div className="muted text-xs">جزء {toAr(x.juz)}</div></Link>))}</div>}
        {tab === 'juz' && <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{Array.from({ length: 30 }, (_, i) => <JuzLink key={i} j={i + 1} />)}</div>}
      </>)}
    </div>
  )
}
function JuzLink({ j }) {
  const [to, setTo] = useState(null)
  useEffect(() => { get('/juz/' + j).then((r) => setTo(`/page/${r.page_start}`)).catch(() => {}) }, [j])
  return <Link to={to || '#'} className="card !p-3 text-center hover:ring-2 ring-gold-400"><div className="muted">الجزء</div><div className="font-extrabold text-xl">{toAr(j)}</div></Link>
}

export function Bookmarks() {
  const { user } = useApp(); const bm = useBookmarks()
  const l = useLoad(async () => {
    if (user) return get('/bookmarks')
    const ids = guest.bookmarks(); return Promise.all(ids.map((g) => ayahAnywhere(g)))
  }, [user, bm.ids.size])
  return (
    <div><PageHeader title="العلامات المرجعية" />
      {l.loading && <Spinner />}{l.error && <ErrorBox error={l.error} retry={l.reload} />}
      {l.data && l.data.length === 0 && <Empty icon="bookmark" title="لا علامات بعد">اضغط على أي آية في المصحف ثم «علامة مرجعية».</Empty>}
      <div className="space-y-3">{l.data?.map((a) => (
        <div key={a.g} className="card"><Link to={`/surah/${a.surah}?g=${a.g}`} className="quran-text !text-[22px] !leading-[2.2] block">{a.text}</Link>
          <div className="flex items-center justify-between mt-2"><span className="muted">{a.surah_name} · آية {toAr(a.n)}</span><button className="btn-danger !py-1.5" onClick={() => bm.toggle(a.g)}><Icon name="trash" />إزالة</button></div></div>))}</div>
    </div>
  )
}
