import { useEffect, useMemo, useState } from 'react'
import { get } from '../api'
import { PageHeader, Spinner, ErrorBox } from '../components/ui'
import { useApp, guest, ayahAnywhere } from '../store'
import { toAr, surahLabel } from '../lib'

const strip = (w) => w.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const ROUNDS = 8

function buildQuestion(ayahs) {
  const pool = ayahs.filter((a) => a.text.split(' ').length >= 4 && a.text.split(' ').length <= 14)
  const a = (pool.length ? pool : ayahs)[Math.floor(Math.random() * (pool.length || ayahs.length))]
  const words = a.text.split(' ')
  const nBlank = words.length > 8 ? 3 : 2
  const idx = shuffle(words.map((_, i) => i).filter((i) => strip(words[i]).length > 2)).slice(0, nBlank).sort((x, y) => x - y)
  const answers = idx.map((i) => words[i])
  const have = new Set(answers.map(strip))
  const decoys = shuffle([...new Set(ayahs.flatMap((x) => x.text.split(' ')))].filter((w) => strip(w).length > 2 && !have.has(strip(w)))).slice(0, 4 - 0)
  return { a, words, idx, answers, options: shuffle([...new Set([...answers, ...decoys])]) }
}

export default function Quiz() {
  const { user } = useApp()
  const [src, setSrc] = useState(null)
  const [pageData, setPageData] = useState(null); const [err, setErr] = useState(null)
  const [round, setRound] = useState(0); const [score, setScore] = useState(0); const [q, setQ] = useState(null)
  const [filled, setFilled] = useState([]); const [wrong, setWrong] = useState(0); const [shake, setShake] = useState(false); const [mistakes, setMistakes] = useState(0)

  const start = async (kind) => {
    setErr(null); setSrc(kind); setRound(0); setScore(0); setMistakes(0)
    try {
      let page
      if (kind === 'last') { const g = guest.last(); const a = g ? await ayahAnywhere(g) : null; page = a ? a.page : 1 }
      else if (kind === 'amma') page = 582 + Math.floor(Math.random() * 23)
      else page = 1 + Math.floor(Math.random() * 604)
      const pages = [page, Math.min(604, page + 1)]
      const data = (await Promise.all(pages.map((p) => get('/page/' + p)))).flatMap((x) => x.ayahs)
      setPageData(data); setQ(buildQuestion(data)); setFilled([]); setWrong(0)
    } catch (e) { setErr(e); setSrc(null) }
  }
  const pick = (w) => {
    if (filled.length >= q.idx.length) return
    if (strip(w) === strip(q.answers[filled.length])) {
      const nf = [...filled, w]; setFilled(nf)
      if (nf.length === q.idx.length) setTimeout(() => { setScore((s) => s + (wrong === 0 ? 1 : 0.5)); setRound((r) => r + 1) }, 700)
    } else { setWrong((x) => x + 1); setMistakes((m) => m + 1); setShake(true); setTimeout(() => setShake(false), 320) }
  }
  useEffect(() => { if (pageData && round > 0 && round < ROUNDS) { setQ(buildQuestion(pageData)); setFilled([]); setWrong(0) } }, [round]) // eslint-disable-line
  const used = useMemo(() => new Set(filled), [filled])

  if (!src) return (
    <div className="space-y-4"><PageHeader title="اختبر حفظك" subtitle="أكمل الكلمات الناقصة في الآية" />
      {err && <ErrorBox error={err} />}
      <div className="grid gap-3">
        <button className="card text-right hover:ring-2 ring-gold-400" onClick={() => start('last')}><div className="font-bold">من آخر ما قرأت</div><div className="muted">آيات من الصفحة التي وصلت إليها</div></button>
        <button className="card text-right hover:ring-2 ring-gold-400" onClick={() => start('amma')}><div className="font-bold">جزء عمّ</div><div className="muted">للمبتدئين في الحفظ</div></button>
        <button className="card text-right hover:ring-2 ring-gold-400" onClick={() => start('random')}><div className="font-bold">من أي مكان في المصحف</div><div className="muted">تحدٍّ مفتوح</div></button>
      </div>
      {!user && <p className="muted text-center">الاختبار يعمل بدون حساب.</p>}
    </div>)
  if (round >= ROUNDS) return (
    <div className="space-y-4 text-center"><PageHeader title="النتيجة" back={false} />
      <div className="card py-8"><div className="text-5xl mb-2">{score >= ROUNDS * 0.8 ? '🏆' : score >= ROUNDS * 0.5 ? '🌟' : '📖'}</div>
        <div className="text-3xl font-extrabold">{toAr(Math.round(score * 10) / 10)} / {toAr(ROUNDS)}</div>
        <p className="muted mt-2">{mistakes === 0 ? 'ما شاء الله، بدون أي خطأ!' : `عدد الأخطاء: ${toAr(mistakes)}`}</p></div>
      <div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => start(src)}>جولة جديدة</button><button className="btn-ghost flex-1" onClick={() => setSrc(null)}>تغيير المصدر</button></div></div>)
  if (!q) return <Spinner />
  const done = filled.length === q.idx.length
  return (
    <div className="space-y-4"><PageHeader title="اختبر حفظك" subtitle={`السؤال ${toAr(round + 1)} من ${toAr(ROUNDS)}`} />
      <div className="h-2 rounded-full bg-emerald-900/10 overflow-hidden"><div className="h-full bg-gold-500 transition-all" style={{ width: (round / ROUNDS) * 100 + '%' }} /></div>
      <div className={`card ${shake ? 'shake' : ''}`}>
        <div className="muted text-center mb-2">{surahLabel(q.a.surah_name)} · آية {toAr(q.a.n)}</div>
        <div className="quran-text !text-center !text-[26px] !leading-[2.4]" dir="rtl">
          {q.words.map((w, i) => { const k = q.idx.indexOf(i); if (k < 0) return <span key={i}>{w} </span>
            return <span key={i} className="blank">{filled[k] ? <span className="text-emerald-700 dark:text-gold-300">{filled[k]}</span> : <span className="opacity-0">{q.answers[k]}</span>}</span> })}
        </div>
      </div>
      {done ? <div className="text-center font-bold text-emerald-700 dark:text-gold-300">أحسنت ✓</div> :
        <div className="flex flex-wrap justify-center gap-2">{q.options.map((w) => <button key={w} disabled={used.has(w)} onClick={() => pick(w)} className="btn-ghost !text-xl quran-text !leading-normal disabled:opacity-30">{w}</button>)}</div>}
      <p className="muted text-center">اختر الكلمات بالترتيب الصحيح. الخطأ يقلّل النقاط.</p>
    </div>
  )
}
