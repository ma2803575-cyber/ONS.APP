import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { get } from './api'
import { useApp } from './store'

const A = createContext(null)
export const useAudio = () => useContext(A)

export function AudioProvider({ children }) {
  const { settings, notify } = useApp()
  const ref = useRef(null)
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [meta, setMeta] = useState(null) // {surah, reciter}
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })
  const [rate, setRate] = useState(1)

  const current = idx >= 0 ? queue[idx] : null

  const playSurah = useCallback(async (surah, start = 1, end = null, reciter = settings.reciter) => {
    try {
      setLoading(true)
      const q = `/audio/playlist?reciter=${reciter}&surah=${surah}&start=${start}` + (end ? `&end=${end}` : '')
      const { tracks } = await get(q)
      setQueue(tracks); setIdx(0); setMeta({ surah, reciter })
    } catch (e) { notify(e.message, 'err') } finally { setLoading(false) }
  }, [settings.reciter, notify])

  useEffect(() => {
    const el = ref.current; if (!el) return
    if (current) { el.src = current.url; el.playbackRate = rate; el.play().then(() => setPlaying(true)).catch(() => setPlaying(false)) }
  }, [current?.url]) // eslint-disable-line

  useEffect(() => { if (ref.current) ref.current.playbackRate = rate }, [rate])

  const toggle = () => { const el = ref.current; if (!el || !current) return; el.paused ? el.play() : el.pause() }
  const next = () => setIdx((i) => (i + 1 < queue.length ? i + 1 : i))
  const prev = () => setIdx((i) => (i > 0 ? i - 1 : i))
  const stop = () => { ref.current?.pause(); setQueue([]); setIdx(-1); setPlaying(false); setMeta(null) }
  const seek = (p) => { const el = ref.current; if (el && el.duration) el.currentTime = p * el.duration }

  return (
    <A.Provider value={{ playSurah, toggle, next, prev, stop, seek, current, queue, idx, playing, meta, loading, time, rate, setRate }}>
      {children}
      <audio ref={ref} preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime({ cur: e.target.currentTime, dur: e.target.duration || 0 })}
        onEnded={() => { if (idx + 1 < queue.length) setIdx(idx + 1); else { setPlaying(false) } }}
        onError={() => notify('تعذر تشغيل الصوت (تحقق من الإنترنت)', 'err')} />
    </A.Provider>
  )
}
