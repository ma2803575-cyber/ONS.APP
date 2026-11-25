import { Link } from 'react-router-dom'
import Icon from './Icon'
import { useAudio } from '../audio'

export default function MiniPlayer() {
  const a = useAudio()
  if (!a.current) return null
  const pct = a.time.dur ? (a.time.cur / a.time.dur) * 100 : 0
  return (
    <div className="fixed inset-x-2 bottom-[4.6rem] md:bottom-4 md:right-72 z-50 bg-emerald-900 text-white rounded-2xl shadow-xl p-3 animate-fadeUp" role="region" aria-label="مشغل التلاوة">
      <div className="flex items-center gap-2">
        <Link to={`/surah/${a.meta?.surah}`} className="flex-1 min-w-0 text-sm"><div className="font-bold truncate">سورة {a.meta?.surah} · آية {a.current.n}</div><div className="opacity-70 text-xs">{a.idx + 1} / {a.queue.length}</div></Link>
        <button aria-label="السابق" onClick={a.prev} className="p-2 rotate-180"><Icon name="prev" fill /></button>
        <button aria-label={a.playing ? 'إيقاف مؤقت' : 'تشغيل'} onClick={a.toggle} className="p-2.5 rounded-full bg-gold-500 text-emerald-950"><Icon name={a.playing ? 'pause' : 'play'} fill /></button>
        <button aria-label="التالي" onClick={a.next} className="p-2 rotate-180"><Icon name="next" fill /></button>
        <button aria-label="إغلاق" onClick={a.stop} className="p-2"><Icon name="x" /></button>
      </div>
      <div className="h-1 bg-white/20 rounded mt-2 cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); a.seek(1 - (e.clientX - r.left) / r.width) }}><div className="h-full bg-gold-400 rounded float-right" style={{ width: pct + '%' }} /></div>
    </div>
  )
}
