import { Link } from 'react-router-dom'
import { BarChart, Bar as RBar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { get } from '../api'
import { useApp, guest } from '../store'
import { useLoad, Spinner, ErrorBox, Ring, Bar } from '../components/ui'
import Icon from '../components/Icon'
import { hijriDate, gregDate, greeting, toAr, readJSON, todayISO } from '../lib'

const SHORTCUTS = [
  ['/quran', 'book', 'المصحف'], ['/wird', 'flame', 'الورد'], ['/khatma', 'target', 'الختمة'], ['/memorization', 'brain', 'الحفظ'],
  ['/adhkar', 'spark', 'الأذكار'], ['/tasbeeh', 'circle', 'المسبحة'], ['/duas', 'heart', 'الأدعية'], ['/assistant', 'bot', 'المساعد'],
]
export default function Home() {
  const { user } = useApp()
  const d = useLoad(() => (user ? get('/dashboard') : Promise.resolve(null)), [user])
  const tas = guest.tasbeeh()
  const last = d.data?.last_read
  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 text-white hero-bg">
        <div className="text-gold-200 text-sm">{hijriDate()} · {gregDate()}</div>
        <h1 className="text-2xl font-extrabold mt-1">{greeting()}{user ? `، ${user.name}` : ''}</h1>
        <p className="text-emerald-100/90 mt-1">بالقرب من القرآن تحيا القلوب</p>
      </div>
      <div className="grid grid-cols-4 gap-2">{SHORTCUTS.map(([to, ic, l]) => (
        <Link key={to} to={to} className="card !p-3 flex flex-col items-center gap-1 text-center hover:ring-2 ring-gold-400"><Icon name={ic} className="w-6 h-6 text-emerald-700 dark:text-gold-300" /><span className="text-xs font-semibold">{l}</span></Link>))}</div>

      {!user && (<div className="card"><div className="font-bold mb-1">أنت تستخدم أُنس كضيف</div><p className="muted mb-3">المصحف والأذكار والمسبحة والمساعد تعمل بدون حساب. أنشئ حساباً لحفظ الختمة والورد والحفظ والعلامات.</p>
        <div className="flex gap-2"><Link to="/register" className="btn-primary">إنشاء حساب</Link><Link to="/login" className="btn-ghost">دخول</Link></div>
        {tas.total > 0 && <p className="muted mt-3">مجموع تسبيحك على هذا الجهاز: {toAr(tas.total)}</p>}</div>)}
      {user && d.loading && <Spinner />}{user && d.error && <ErrorBox error={d.error} retry={d.reload} />}
      {d.data && (() => { const k = d.data.khatma; const p = k.plan; return (<>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/wird" className="card flex items-center gap-4"><Ring percent={p ? Math.min(100, Math.round((k.today_pages * 100) / k.today_target)) : 0} size={96} stroke={9} label={p ? `${toAr(k.today_pages)}/${toAr(k.today_target)}` : '—'} sub="صفحات" />
            <div><div className="font-bold">وردك اليوم</div><div className="muted">{p ? (k.today_remaining ? `بقي ${toAr(k.today_remaining)} صفحة` : 'أتممت وردك اليوم، تقبّل الله') : 'لم تحدد ورداً بعد'}</div></div></Link>
          <Link to="/khatma" className="card"><div className="flex justify-between font-bold mb-2"><span>ختمة القرآن</span><span>{p ? `${toAr(k.percent)}%` : '—'}</span></div><Bar value={k.percent || 0} />
            <div className="muted mt-2">{p ? `${toAr(k.pages_done)} من ٦٠٤ صفحة · الجزء ${toAr(k.juz_done)}` : 'ابدأ ختمة في 30 أو 60 أو 90 يوماً'}</div></Link>
        </div>
        {last && <Link to={`/surah/${last.surah}?g=${last.g}`} className="card flex items-center gap-3"><Icon name="book2" className="w-8 h-8 text-gold-600" /><div className="flex-1"><div className="font-bold">آخر ما قرأت</div><div className="muted">سورة {last.surah_name} · آية {toAr(last.n)}</div></div><span className="btn-gold !py-1.5">تابع</span></Link>}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="card !p-3"><Icon name="flame" className="w-6 h-6 mx-auto text-orange-500" /><div className="font-extrabold text-xl">{toAr(d.data.streak)}</div><div className="muted">يوم متواصل</div></div>
          <div className="card !p-3"><Icon name="book" className="w-6 h-6 mx-auto text-emerald-600" /><div className="font-extrabold text-xl">{toAr(d.data.total_pages)}</div><div className="muted">صفحة مقروءة</div></div>
          <div className="card !p-3"><Icon name="circle" className="w-6 h-6 mx-auto text-gold-600" /><div className="font-extrabold text-xl">{toAr(d.data.tasbeeh_today)}</div><div className="muted">تسبيح اليوم</div></div>
        </div>
        <div className="card"><div className="font-bold mb-2">الأذكار اليومية</div>
          <div className="flex flex-wrap gap-2">{[['morning_done', 1, 'الصباح والمساء'], ['sleep_done', 2, 'النوم'], ['after_prayer_done', 27, 'بعد الصلاة']].map(([k, id, l]) => (
            <Link key={k} to={`/adhkar/${id}`} className={`chip ${d.data.adhkar[k] ? 'chip-on' : ''}`}>{d.data.adhkar[k] && <Icon name="check" className="w-4 h-4 ml-1" />}{l}</Link>))}</div></div>
        {d.data.memorization.total > 0 && <Link to="/memorization" className="card flex justify-between"><span className="font-bold">الحفظ: {toAr(d.data.memorization.memorized)} من {toAr(d.data.memorization.total)} آية</span><span className="chip chip-on">{toAr(d.data.memorization.due)} للمراجعة</span></Link>}
        <div className="card"><div className="font-bold mb-2">آخر 7 أيام (صفحات)</div><div style={{ height: 160 }}><ResponsiveContainer><BarChart data={d.data.week.map((w) => ({ ...w, day: w.day.slice(5) }))}><XAxis dataKey="day" tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => [v, 'صفحات']} /><RBar dataKey="pages" fill="#c9a24b" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="card"><div className="font-bold mb-3">الإنجازات والأهداف</div><div className="grid grid-cols-2 gap-2">{d.data.achievements.map((a) => (
          <div key={a.key} className={`rounded-xl p-3 border ${a.unlocked ? 'bg-gold-100 border-gold-400 dark:bg-gold-500/20' : 'opacity-50 border-emerald-900/10'}`}><div className="font-bold text-sm">{a.unlocked ? '🏅 ' : '🔒 '}{a.title}</div><div className="muted">{a.desc}</div></div>))}</div></div>
      </>) })()}
    </div>
  )
}
