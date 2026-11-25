import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { post } from '../api'
import { PageHeader } from '../components/ui'
import Icon from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { useApp } from '../store'
import { toAr, readJSON, writeJSON } from '../lib'

const SUGGEST = ['آيات عن الصبر', 'آيات عن الرزق', 'تفسير آية الكرسي', 'أريد ختمة في 60 يوماً', 'خطة حفظ سورة الملك في 10 أيام', 'أذكار الصباح', 'دعاء الكرب']
const WELCOME = { role: 'bot', answer: 'السلام عليكم، أنا مساعد أُنس. أبحث لك في القرآن والتفسير والأذكار من مصادر موثقة داخل التطبيق، ولا أخترع آية ولا حديثاً ولا أُصدر فتاوى. وإن لم أجد مصدراً أقول لك ذلك.', items: [], sources: [] }

function Item({ it }) {
  if (it.type === 'ayah') return (<div className="rounded-xl bg-emerald-900/5 dark:bg-emerald-100/10 p-3 mt-2"><div className="font-quran !text-[22px] leading-[2.2]">{it.text}<span className="ayah-end">{toAr(it.n)}</span></div>
    <div className="muted">سورة {it.surah_name} · آية {toAr(it.n)}</div>
    {it.tafsir && <details className="mt-1"><summary className="cursor-pointer text-sm font-semibold">التفسير الميسر</summary><p className="mt-1 text-sm leading-7">{it.tafsir}</p></details>}
    <div className="flex gap-3 mt-1 text-sm"><Link className="underline" to={`/surah/${it.surah}?g=${it.g}`}>المصحف</Link><Link className="underline" to={`/tafsir/${it.g}`}>التفسير الكامل</Link></div></div>)
  if (it.type === 'dhikr') return <div className="rounded-xl bg-emerald-900/5 dark:bg-emerald-100/10 p-3 mt-2"><div className="muted">{it.category} · التكرار {toAr(it.count)}</div><p className="leading-8 mt-1">{it.text}</p><Link className="underline text-sm" to={`/adhkar/${it.cat_id}`}>افتح القسم</Link></div>
  if (it.type === 'hadith') return <div className="rounded-xl bg-emerald-900/5 dark:bg-emerald-100/10 p-3 mt-2"><div className="muted">{it.book} · حديث رقم {toAr(it.number)}</div><p className="leading-8 mt-1">{it.text}</p></div>
  return null
}

export default function Assistant() {
  const { user, notify } = useApp(); const nav = useNavigate()
  const [msgs, setMsgs] = useState(() => readJSON('ons_chat', [WELCOME])); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const end = useRef()
  useEffect(() => { writeJSON('ons_chat', msgs.slice(-30)); end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  const send = async (m) => {
    const q = (m ?? text).trim(); if (!q || busy) return
    setText(''); setMsgs((x) => [...x, { role: 'user', answer: q }]); setBusy(true)
    try { const r = await post('/assistant', { message: q }); setMsgs((x) => [...x, { role: 'bot', ...r }]) }
    catch (e) { setMsgs((x) => [...x, { role: 'bot', answer: e.message, items: [], sources: [] }]) } finally { setBusy(false) }
  }
  const doAction = async (a) => {
    if (!user) return notify('سجّل الدخول أولاً', 'err')
    try {
      if (a.type === 'khatma') { await post('/khatma/plan', { days: a.days }); notify('أُنشئت الخطة'); nav('/khatma') }
      if (a.type === 'memorize') nav('/memorization')
    } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 11rem)' }}>
      <PageHeader title="مساعد أُنس" back={false} subtitle="إجابات من مصادر موثقة فقط" right={<button className="btn-ghost !p-2" aria-label="مسح المحادثة" onClick={() => setMsgs([WELCOME])}><Icon name="trash" /></button>} />
      <div className="flex-1 space-y-3">
        {msgs.map((m, i) => m.role === 'user' ? <div key={i} className="flex justify-start"><div className="bg-emerald-700 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[85%]">{m.answer}</div></div> : (
          <div key={i} className="flex gap-2"><div className="shrink-0"><LogoMark size={30} /></div>
            <div className="card !p-3 max-w-[92%]"><p className="leading-8">{m.answer}</p>{m.items?.map((it, k) => <Item key={k} it={it} />)}
              {m.action && <button className="btn-gold mt-2" onClick={() => doAction(m.action)}>{m.action.type === 'khatma' ? `أنشئ خطة ${toAr(m.action.days)} يوماً` : 'افتح قائمة الحفظ'}</button>}
              {m.note && <p className="muted mt-2">{m.note}</p>}
              {m.sources?.length > 0 && <div className="mt-2 border-t border-emerald-900/10 pt-2 text-xs muted"><b>المصادر:</b><ul className="list-disc pr-4">{m.sources.map((s, k) => <li key={k}>{s}</li>)}</ul></div>}</div></div>))}
        {busy && <div className="muted">يبحث...</div>}<div ref={end} />
      </div>
      <div className="flex flex-wrap gap-2 my-3">{SUGGEST.map((s) => <button key={s} className="chip hover:bg-gold-100" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="sticky bottom-24 md:bottom-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
        <input className="input" placeholder="اسأل أو ابحث، مثل: آيات عن الرحمة" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label="رسالتك" />
        <button className="btn-primary" disabled={busy || !text.trim()} aria-label="إرسال"><Icon name="send" className="w-5 h-5 rotate-180" /></button></form>
    </div>
  )
}
