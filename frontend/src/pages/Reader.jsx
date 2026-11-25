import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { get, post } from '../api'
import { PageHeader, Spinner, ErrorBox, useLoad } from '../components/ui'
import Icon from '../components/Icon'
import { useApp, useBookmarks, saveLast } from '../store'
import { useAudio } from '../audio'
import { toAr, ayahShareText, shareText, copyText } from '../lib'

export default function Reader() {
  const { n } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate()
  const { user, settings, setSettings, notify } = useApp(); const audio = useAudio(); const bm = useBookmarks()
  const [sheet, setSheet] = useState(null)
  const target = Number(sp.get('g')) || null
  const sn = Number(n)
  const d = useLoad(() => get('/surahs/' + sn), [sn])
  const saveT = useRef()

  // scroll to target ayah
  useEffect(() => {
    if (!d.data) return
    const el = target && document.getElementById('a' + target)
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150); else window.scrollTo(0, 0)
  }, [d.data, target])

  // remember last position: the ayah near the upper third of the screen (also saved once on load)
  useEffect(() => {
    if (!d.data) return
    const pick = () => {
      const els = [...document.querySelectorAll('[data-g]')]
      const line = window.innerHeight * 0.3
      let cur = els[0]
      for (const el of els) { if (el.getBoundingClientRect().top <= line) cur = el; else break }
      if (cur) { clearTimeout(saveT.current); saveT.current = setTimeout(() => saveLast(user, Number(cur.dataset.g)), 1000) }
    }
    pick()
    window.addEventListener('scroll', pick, { passive: true })
    return () => { window.removeEventListener('scroll', pick); clearTimeout(saveT.current) }
  }, [d.data, user])

  const s = d.data
  const playingG = audio.current?.g
  let lastPage = null
  return (
    <div>
      <PageHeader title={s ? `سورة ${s.name}` : '...'} subtitle={s && `${s.type === 'Meccan' ? 'مكية' : 'مدنية'} · ${toAr(s.count)} آية`}
        right={s && <div className="flex gap-1">
          <button className="btn-ghost !p-2" aria-label="تصغير الخط" onClick={() => setSettings({ fontSize: Math.max(18, settings.fontSize - 2) })}>أ-</button>
          <button className="btn-ghost !p-2" aria-label="تكبير الخط" onClick={() => setSettings({ fontSize: Math.min(56, settings.fontSize + 2) })}>أ+</button>
          <button className="btn-ghost !p-2" aria-label="الوضع الليلي" onClick={() => setSettings({ dark: !settings.dark })}><Icon name={settings.dark ? 'sun' : 'moon'} /></button>
          <button className="btn-gold !p-2" aria-label="استماع للسورة" onClick={() => audio.playSurah(sn)}><Icon name="headphones" /></button></div>} />
      {d.loading && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {s && (<>
        <div className="card pattern text-center mb-4"><div className="text-2xl font-extrabold">{s.name}</div>{s.bismillah && <div className="quran-text !text-center mt-2">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>}</div>
        <div className="card !p-4 sm:!p-6">
          <div className="quran-text" dir="rtl">
            {s.ayahs.map((a) => {
              const marker = a.page !== lastPage ? (lastPage = a.page, <span key={'p' + a.page} className="block text-center my-3 text-xs muted border-y border-gold-400/40 py-1 font-sans">الجزء {toAr(a.juz)} · الحزب {toAr(a.hizb)} · صفحة {toAr(a.page)}</span>) : null
              return (<span key={a.g}>{marker}
                <span id={'a' + a.g} data-g={a.g} className={`ayah ${playingG === a.g ? 'playing' : ''} ${target === a.g ? 'target' : ''}`} onClick={() => setSheet(a)}>
                  {a.text}<span className="ayah-end">{toAr(a.n)}</span>{bm.ids.has(a.g) && <Icon name="bookmark" fill className="w-4 h-4 inline text-gold-600" />}</span> </span>)
            })}
          </div>
        </div>
        <div className="flex justify-between mt-4 gap-2">
          {sn < 114 ? <Link className="btn-ghost" to={`/surah/${sn + 1}`}>السورة التالية ←</Link> : <span />}
          {sn > 1 && <Link className="btn-ghost" to={`/surah/${sn - 1}`}>→ السورة السابقة</Link>}
        </div>
        <p className="muted text-center mt-4">{s.sources.quran}</p>
      </>)}
      {sheet && <AyahSheet a={sheet} close={() => setSheet(null)} bm={bm} audio={audio} nav={nav} user={user} notify={notify} />}
    </div>
  )
}

function AyahSheet({ a, close, bm, audio, nav, user, notify }) {
  const on = bm.ids.has(a.g)
  const act = async (f) => { await f(); }
  const reach = async () => {
    if (!user) return notify('سجّل الدخول لتسجيل تقدم الختمة', 'err')
    try { const st = await post('/khatma/reach', { page: a.page }); notify(`سُجّل وصولك لصفحة ${toAr(a.page)} (${st.percent}%)`) ; close() } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center" onClick={close} role="dialog" aria-modal="true" aria-label="خيارات الآية">
      <div className="bg-paper dark:bg-[#10201a] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
        <div className="text-center muted mb-1">{a.surah_name} · آية {toAr(a.n)} · صفحة {toAr(a.page)}</div>
        <div className="quran-text !text-[22px] !leading-[2.2] !text-center line-clamp-3 mb-4">{a.text}</div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <button className="btn-ghost flex-col" onClick={() => { bm.toggle(a.g); close() }}><Icon name="bookmark" fill={on} />{on ? 'إزالة العلامة' : 'علامة مرجعية'}</button>
          <button className="btn-ghost flex-col" onClick={() => nav(`/tafsir/${a.g}`)}><Icon name="book2" />التفسير</button>
          <button className="btn-ghost flex-col" onClick={() => { audio.playSurah(a.surah, a.n); close() }}><Icon name="play" fill />استماع من هنا</button>
          <button className="btn-ghost flex-col" onClick={async () => { notify((await copyText(ayahShareText(a))) ? 'نُسخت الآية' : 'تعذر النسخ', 'ok'); close() }}><Icon name="copy" />نسخ</button>
          <button className="btn-ghost flex-col" onClick={async () => { const r = await shareText(ayahShareText(a)); if (r === 'copied') notify('نُسخت الآية للمشاركة'); close() }}><Icon name="share" />مشاركة</button>
          <button className="btn-ghost flex-col" onClick={reach}><Icon name="check" />وصلت هنا (ختمة)</button>
        </div>
      </div>
    </div>
  )
}

export function Tafsir() {
  const { g } = useParams(); const { settings, setSettings, notify } = useApp()
  const d = useLoad(() => get('/tafsir/' + g), [g])
  const [src, setSrc] = useState(settings.tafsir || 'muyassar')
  const a = d.data?.ayah; const t = d.data?.tafsirs.find((x) => x.id === src)
  const gi = Number(g)
  return (
    <div><PageHeader title="التفسير" subtitle={a && `${a.surah_name} · آية ${toAr(a.n)}`} />
      {d.loading && <Spinner />}{d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {a && (<>
        <div className="card mb-3"><div className="quran-text !text-[24px] !text-center">{a.text}<span className="ayah-end">{toAr(a.n)}</span></div></div>
        <div className="flex gap-2 mb-3">{d.data.tafsirs.map((x) => <button key={x.id} className={`chip ${src === x.id ? 'chip-on' : ''}`} onClick={() => { setSrc(x.id); setSettings({ tafsir: x.id }) }}>{x.name}</button>)}</div>
        <div className="card"><p className="leading-9 text-lg whitespace-pre-line">{t.text}</p><p className="muted mt-3 border-t pt-2 border-emerald-900/10">المصدر: {t.source}</p></div>
        <div className="flex justify-between mt-4">
          {gi < 6236 && <Link className="btn-ghost" to={`/tafsir/${gi + 1}`}>الآية التالية ←</Link>}
          {gi > 1 && <Link className="btn-ghost" to={`/tafsir/${gi - 1}`}>→ الآية السابقة</Link>}
        </div>
        <div className="mt-3 flex gap-2"><button className="btn-ghost" onClick={async () => notify((await copyText(`${a.text}\n\nالتفسير (${t.source}):\n${t.text}`)) ? 'نُسخ' : 'تعذر', 'ok')}><Icon name="copy" />نسخ التفسير</button>
          <Link className="btn-ghost" to={`/surah/${a.surah}?g=${a.g}`}>فتح في المصحف</Link></div>
      </>)}
    </div>
  )
}
