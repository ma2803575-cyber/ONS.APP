import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, Link, useNavigate, Navigate } from 'react-router-dom'
import { get, post } from '../api'
import { PageHeader, Spinner, ErrorBox, useLoad } from '../components/ui'
import Icon from '../components/Icon'
import { useApp, useBookmarks, saveLast, ayahAnywhere } from '../store'
import { useAudio } from '../audio'
import { toAr, ayahShareText, shareText, copyText, surahLabel, shareAyahImage } from '../lib'

const THEMES = { paper: 'mushaf-paper', sepia: 'mushaf-sepia', night: 'mushaf-night' }
const NEXT_THEME = { paper: 'sepia', sepia: 'night', night: 'paper' }

// Old /surah/:n links still work: they open the mushaf page that holds the surah (or the exact ayah).
export function SurahRedirect() {
  const { n } = useParams(); const [sp] = useSearchParams()
  const g = Number(sp.get('g')) || null
  const [to, setTo] = useState(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        if (g) { const a = await ayahAnywhere(g); if (live) setTo(`/page/${a.page}?g=${g}`); return }
        const list = await get('/surahs'); const s = list.find((x) => x.n === Number(n))
        if (live) setTo(`/page/${s ? s.page : 1}`)
      } catch { if (live) setTo('/page/1') }
    })()
    return () => { live = false }
  }, [n, g])
  return to ? <Navigate to={to} replace /> : <Spinner />
}

export default function Reader() {
  const { p } = useParams(); const [sp] = useSearchParams(); const nav = useNavigate()
  const { user, settings, setSettings, notify } = useApp(); const audio = useAudio(); const bm = useBookmarks()
  const page = Math.min(604, Math.max(1, Number(p) || 1))
  const target = Number(sp.get('g')) || null
  const [sheet, setSheet] = useState(null)
  const [jump, setJump] = useState(false)
  const [dir, setDir] = useState('next')
  const d = useLoad(() => get('/page/' + page), [page])
  const theme = settings.mushafTheme || (settings.dark ? 'night' : 'paper')
  const saveT = useRef(); const touch = useRef(null)

  const go = useCallback((to, how = 'next') => {
    if (to < 1 || to > 604) return
    setDir(how); nav(`/page/${to}`)
  }, [nav])
  const finish = useCallback(async () => {
    if (user) {
      try { const st = await post('/khatma/reach', { page }); notify(`أحسنت، أتممت صفحة ${toAr(page)} (${toAr(st.percent)}%)`) } catch { /* no active khatma plan or offline: just turn the page */ }
    }
    go(page + 1, 'next')
  }, [user, page, go, notify])

  useEffect(() => { window.scrollTo(0, 0) }, [page])
  useEffect(() => { if (page < 604) get('/page/' + (page + 1)).catch(() => {}) }, [page])
  useEffect(() => {
    const a = d.data?.ayahs?.[0]; if (!a) return
    clearTimeout(saveT.current); saveT.current = setTimeout(() => saveLast(user, target || a.g), 800)
    return () => clearTimeout(saveT.current)
  }, [d.data, user, target])
  useEffect(() => {
    const k = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') finish(); if (e.key === 'ArrowRight') go(page - 1, 'prev') }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [finish, go, page])

  const ayahs = d.data?.ayahs || []
  const first = ayahs[0]
  const playingG = audio.current?.g
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = (e) => {
    const s = touch.current; if (!s) return; const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y; touch.current = null
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) { if (dx > 0) finish(); else go(page - 1, 'prev') }
  }
  const surahsOnPage = [...new Set(ayahs.map((a) => surahLabel(a.surah_name)))]
  const title = surahsOnPage.length > 1 ? surahsOnPage.join(' · ') : surahsOnPage[0]

  return (
    <div className={`mushaf-shell ${THEMES[theme]}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="mushaf-top">
        <button className="mushaf-btn rotate-180" aria-label="رجوع" onClick={() => nav('/quran')}><Icon name="arrow" /></button>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-extrabold truncate quran-title">{first ? `سورة ${title}` : '...'}</div>
          <div className="text-xs opacity-70">{first && `الجزء ${toAr(first.juz)} · الحزب ${toAr(first.hizb)}`}</div>
        </div>
        <div className="flex gap-1">
          <button className="mushaf-btn" aria-label="تصغير الخط" onClick={() => setSettings({ fontSize: Math.max(20, settings.fontSize - 2) })}>أ-</button>
          <button className="mushaf-btn" aria-label="تكبير الخط" onClick={() => setSettings({ fontSize: Math.min(44, settings.fontSize + 2) })}>أ+</button>
          <button className="mushaf-btn" aria-label="تغيير لون الصفحة" onClick={() => { const t = NEXT_THEME[theme]; setSettings({ mushafTheme: t, dark: t === 'night' }) }}><Icon name={theme === 'night' ? 'sun' : 'moon'} /></button>
        </div>
      </div>

      <div className="mushaf-stage">
        {d.error && <ErrorBox error={d.error} retry={d.reload} />}
        {d.loading && !d.data && <div className="py-24"><Spinner /></div>}
        {d.data && (
          <div key={page} className={`mushaf-page ${dir === 'next' ? 'turn-next' : 'turn-prev'}`}>
            <div className="mushaf-frame">
              <div className="quran-text mushaf-text" dir="rtl">
                {ayahs.map((a) => (
                  <span key={a.g}>
                    {a.n === 1 && (
                      <span className="block surah-banner"><span className="surah-banner-in">سورة {a.surah_name}</span></span>
                    )}
                    {a.n === 1 && a.surah !== 1 && a.surah !== 9 && <span className="block text-center bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>}
                    <span id={'a' + a.g} className={`ayah ${playingG === a.g ? 'playing' : ''} ${target === a.g ? 'target' : ''}`} onClick={() => setSheet(a)}>
                      {a.text}<span className="ayah-end">{toAr(a.n)}</span>{bm.ids.has(a.g) && <Icon name="bookmark" fill className="w-4 h-4 inline text-gold-600" />}</span>{' '}
                  </span>
                ))}
              </div>
              <div className="mushaf-foot"><span className="mushaf-num">{toAr(page)}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="mushaf-bar">
        <button className="mushaf-nav" onClick={() => go(page - 1, 'prev')} disabled={page <= 1} aria-label="الصفحة السابقة">→ السابقة</button>
        <button className="mushaf-count" onClick={() => setJump(true)} aria-label="الانتقال إلى صفحة">{toAr(page)} / {toAr(604)}</button>
        <button className="mushaf-next" onClick={finish} disabled={page >= 604} aria-label="التالي">التالي ←</button>
      </div>
      {jump && <JumpSheet page={page} close={() => setJump(false)} go={(n) => { setJump(false); go(n, n > page ? 'next' : 'prev') }} />}
      {sheet && <AyahSheet a={sheet} close={() => setSheet(null)} bm={bm} audio={audio} nav={nav} user={user} notify={notify} />}
    </div>
  )
}

function JumpSheet({ page, close, go }) {
  const [v, setV] = useState('')
  const list = useLoad(() => get('/surahs'), [])
  const submit = (e) => { e.preventDefault(); const n = Number(v); if (n >= 1 && n <= 604) go(n) }
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" onClick={close} role="dialog" aria-modal="true" aria-label="الانتقال">
      <div className="bg-paper dark:bg-[#0e1a36] text-emerald-950 dark:text-emerald-50 w-full max-w-md rounded-t-3xl p-5 animate-fadeUp max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input className="input" inputMode="numeric" placeholder={`رقم الصفحة (١ - ٦٠٤)، الحالية ${toAr(page)}`} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} autoFocus aria-label="رقم الصفحة" />
          <button className="btn-primary" type="submit">اذهب</button>
        </form>
        <div className="font-bold mb-2">الأجزاء</div>
        <div className="grid grid-cols-6 gap-2 mb-4">{Array.from({ length: 30 }, (_, i) => <JuzBtn key={i} j={i + 1} go={go} />)}</div>
        <div className="font-bold mb-2">السور</div>
        <div className="grid grid-cols-2 gap-2">{list.data?.map((s) => <button key={s.n} className="btn-ghost !py-2 !justify-start" onClick={() => go(s.page)}><span className="muted w-7">{toAr(s.n)}</span>{surahLabel(s.name)}</button>)}</div>
      </div>
    </div>
  )
}
function JuzBtn({ j, go }) {
  return <button className="btn-ghost !p-2" onClick={async () => { try { const r = await get('/juz/' + j); go(r.page_start) } catch { /* offline and not cached */ } }}>{toAr(j)}</button>
}

export function AyahSheet({ a, close, bm, audio, nav, user, notify }) {
  const on = bm.ids.has(a.g)
  const act = async (f) => { await f(); }
  const reach = async () => {
    if (!user) return notify('سجّل الدخول لتسجيل تقدم الختمة', 'err')
    try { const st = await post('/khatma/reach', { page: a.page }); notify(`سُجّل وصولك لصفحة ${toAr(a.page)} (${st.percent}%)`) ; close() } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center" onClick={close} role="dialog" aria-modal="true" aria-label="خيارات الآية">
      <div className="bg-paper dark:bg-[#0e1a36] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 animate-fadeUp" onClick={(e) => e.stopPropagation()}>
        <div className="text-center muted mb-1">{a.surah_name} · آية {toAr(a.n)} · صفحة {toAr(a.page)}</div>
        <div className="quran-text !text-[22px] !leading-[2.2] !text-center line-clamp-3 mb-4">{a.text}</div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <button className="btn-ghost flex-col" onClick={() => { bm.toggle(a.g); close() }}><Icon name="bookmark" fill={on} />{on ? 'إزالة العلامة' : 'علامة مرجعية'}</button>
          <button className="btn-ghost flex-col" onClick={() => nav(`/tafsir/${a.g}`)}><Icon name="book2" />التفسير</button>
          <button className="btn-ghost flex-col" onClick={() => { audio.playSurah(a.surah, a.n); close() }}><Icon name="play" fill />استماع من هنا</button>
          <button className="btn-ghost flex-col" onClick={async () => { notify((await copyText(ayahShareText(a))) ? 'نُسخت الآية' : 'تعذر النسخ', 'ok'); close() }}><Icon name="copy" />نسخ</button>
          <button className="btn-ghost flex-col" onClick={async () => { const r = await shareText(ayahShareText(a)); if (r === 'copied') notify('نُسخت الآية للمشاركة'); close() }}><Icon name="share" />مشاركة</button>
          <button className="btn-ghost flex-col" onClick={reach}><Icon name="check" />وصلت هنا (ختمة)</button>
          <button className="btn-gold col-span-3" onClick={async () => { const s = await shareAyahImage(a); notify(s === 'saved' ? 'تم حفظ صورة الآية' : s === 'fail' ? 'تعذر إنشاء الصورة' : 'تمت المشاركة', s === 'fail' ? 'err' : 'ok'); close() }}><Icon name="share" />مشاركة الآية كصورة</button>
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
