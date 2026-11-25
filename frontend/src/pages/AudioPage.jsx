import { useEffect, useState } from 'react'
import { get } from '../api'
import { PageHeader, useLoad, Spinner } from '../components/ui'
import Icon from '../components/Icon'
import { useApp } from '../store'
import { useAudio } from '../audio'
import { toAr } from '../lib'

export default function AudioPage() {
  const { settings, setSettings } = useApp(); const audio = useAudio()
  const meta = useLoad(() => get('/meta'), []); const sur = useLoad(() => get('/surahs'), [])
  const [s, setS] = useState(1); const [from, setFrom] = useState(1); const [to, setTo] = useState(7)
  const cnt = sur.data?.[s - 1]?.count || 7
  useEffect(() => { setFrom(1); setTo(cnt) }, [s, cnt])
  const rec = meta.data?.reciters
  return (
    <div><PageHeader title="التلاوات" subtitle="تلاوات آية بآية من cdn.islamic.network" back={false} />
      {(meta.loading || sur.loading) && <Spinner />}
      {rec && sur.data && (<div className="card space-y-4">
        <label className="block"><span className="font-semibold text-sm">القارئ</span>
          <select className="input mt-1" value={settings.reciter} onChange={(e) => setSettings({ reciter: e.target.value })}>{rec.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="block"><span className="font-semibold text-sm">السورة</span>
          <select className="input mt-1" value={s} onChange={(e) => setS(Number(e.target.value))}>{sur.data.map((x) => <option key={x.n} value={x.n}>{x.n}. {x.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="font-semibold text-sm">من آية</span><input type="number" min="1" max={to} className="input mt-1" value={from} onChange={(e) => setFrom(Math.max(1, Math.min(Number(e.target.value) || 1, to)))} /></label>
          <label><span className="font-semibold text-sm">إلى آية</span><input type="number" min={from} max={cnt} className="input mt-1" value={to} onChange={(e) => setTo(Math.min(cnt, Math.max(Number(e.target.value) || cnt, from)))} /></label>
        </div>
        <div className="flex gap-2"><button className="btn-gold flex-1" onClick={() => audio.playSurah(s, from, to)} disabled={audio.loading}><Icon name="play" fill />{from === 1 && to === cnt ? 'تشغيل السورة كاملة' : `تشغيل الآيات ${toAr(from)}–${toAr(to)}`}</button></div>
        {audio.current && (<div className="rounded-xl bg-emerald-900/5 dark:bg-emerald-100/10 p-3 flex items-center gap-2">
          <div className="flex-1 text-sm">يُشغَّل الآن: آية {toAr(audio.current.n)} ({audio.idx + 1}/{audio.queue.length})</div>
          <select aria-label="السرعة" className="input !w-24 !py-1" value={audio.rate} onChange={(e) => audio.setRate(Number(e.target.value))}>{[0.75, 1, 1.25, 1.5].map((r) => <option key={r} value={r}>{r}x</option>)}</select></div>)}
        <p className="muted">يتطلب التشغيل اتصالاً بالإنترنت. المصدر الصوتي: {meta.data.audio_base}</p>
      </div>)}
    </div>
  )
}
