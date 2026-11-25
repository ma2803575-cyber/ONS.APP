import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get, post, patch, del, setToken } from '../api'
import { useApp } from '../store'
import { PageHeader, useLoad, Spinner, ErrorBox, Empty, LoginGate } from '../components/ui'
import Icon from '../components/Icon'
import { MORE } from '../components/Layout'
import { toAr } from '../lib'

export function Notifications() {
  const { user, refreshUnread } = useApp(); const n = useLoad(() => (user ? get('/notifications') : Promise.resolve(null)), [user])
  if (!user) return <div><PageHeader title="الإشعارات" /><LoginGate what="سجّل الدخول لتصلك تنبيهات الورد والمراجعة والإنجازات." /></div>
  const read = async () => { await post('/notifications/read'); n.reload(); refreshUnread() }
  return (
    <div className="space-y-3"><PageHeader title="الإشعارات" right={n.data?.unread > 0 && <button className="btn-ghost" onClick={read}>تعليم الكل كمقروء</button>} />
      {n.loading && <Spinner />}{n.error && <ErrorBox error={n.error} retry={n.reload} />}
      {n.data?.items.length === 0 && <Empty icon="bell" title="لا إشعارات">ستظهر هنا تذكيرات الورد وإنجازاتك.</Empty>}
      {n.data?.items.map((x) => <div key={x.id} className={`card ${x.read ? 'opacity-70' : 'border-gold-400'}`}><div className="font-bold">{x.title}</div><div className="muted">{x.body}</div><div className="text-xs muted mt-1">{x.created_at.slice(0, 16).replace('T', ' ')}</div></div>)}
      <p className="muted text-center">تذكيرات الجهاز (متصفح) تُضبط من الإعدادات وتعمل أثناء فتح التطبيق.</p>
    </div>
  )
}

export function Profile() {
  const { user, logout, notify, setUser } = useApp(); const nav = useNavigate()
  const [name, setName] = useState(user?.name || ''); const [pw, setPw] = useState({ old_password: '', new_password: '' })
  const st = useLoad(() => (user ? get('/dashboard') : Promise.resolve(null)), [user])
  if (!user) return <div><PageHeader title="حسابي" /><LoginGate /></div>
  const run = async (f, ok) => { try { await f(); notify(ok) } catch (e) { notify(e.message, 'err') } }
  return (
    <div className="space-y-4"><PageHeader title="الملف الشخصي" back={false} />
      <div className="card flex items-center gap-3"><div className="w-14 h-14 rounded-full bg-emerald-700 text-gold-200 flex items-center justify-center text-2xl font-extrabold">{user.name[0]}</div><div><div className="font-bold">{user.name}</div><div className="muted" dir="ltr">{user.email}</div></div></div>
      {st.data && <div className="grid grid-cols-3 gap-2 text-center"><div className="card !p-3"><div className="font-extrabold text-xl">{toAr(st.data.streak)}</div><div className="muted">يوم متواصل</div></div><div className="card !p-3"><div className="font-extrabold text-xl">{toAr(st.data.total_pages)}</div><div className="muted">صفحة</div></div><div className="card !p-3"><div className="font-extrabold text-xl">{toAr(st.data.achievements.filter((a) => a.unlocked).length)}</div><div className="muted">إنجاز</div></div></div>}
      <div className="card space-y-2"><div className="font-bold">الاسم</div><input className="input" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary" onClick={() => run(async () => setUser(await patch('/me', { name })), 'تم الحفظ')}>حفظ</button></div>
      <div className="card space-y-2"><div className="font-bold">تغيير كلمة المرور</div>
        <input type="password" className="input" placeholder="الحالية" dir="ltr" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} autoComplete="current-password" />
        <input type="password" className="input" placeholder="الجديدة (8 أحرف+)" dir="ltr" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" />
        <button className="btn-primary" onClick={() => run(async () => { await post('/me/password', pw); setPw({ old_password: '', new_password: '' }) }, 'تم تغيير كلمة المرور')}>تغيير</button></div>
      <button className="btn-ghost w-full" onClick={() => { logout(); nav('/home') }}><Icon name="logout" />تسجيل الخروج</button>
      <button className="btn-danger w-full" onClick={async () => { if (confirm('سيُحذف حسابك وكل بياناتك نهائياً. متأكد؟')) { await del('/me'); setToken(null); logout(); nav('/home'); notify('حُذف الحساب') } }}>حذف الحساب نهائياً</button>
    </div>
  )
}

export function Settings() {
  const { settings, setSettings, notify } = useApp(); const rec = useLoad(() => get('/meta'), [])
  const toggleReminder = async () => {
    if (!settings.reminderOn) {
      if (typeof Notification === 'undefined') return notify('المتصفح لا يدعم الإشعارات', 'err')
      const p = await Notification.requestPermission()
      if (p !== 'granted') return notify('لم يُمنح إذن الإشعارات', 'err')
      setSettings({ reminderOn: true })
      new Notification('أُنس | ONS', { body: 'سيصلك تذكير الورد أثناء فتح التطبيق.' })
    } else setSettings({ reminderOn: false })
  }
  return (
    <div className="space-y-4"><PageHeader title="الإعدادات" back={false} />
      <div className="card flex justify-between items-center"><span className="font-bold">الوضع الليلي</span><button role="switch" aria-checked={settings.dark} className={`w-14 h-8 rounded-full p-1 transition ${settings.dark ? 'bg-emerald-600' : 'bg-gray-300'}`} onClick={() => setSettings({ dark: !settings.dark })}><span className={`block w-6 h-6 rounded-full bg-white transition ${settings.dark ? '-translate-x-6' : ''}`} /></button></div>
      <div className="card"><div className="font-bold mb-2">حجم خط المصحف: {toAr(settings.fontSize)}</div><input type="range" min="18" max="56" step="2" className="w-full" value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} aria-label="حجم الخط" /><p className="font-quran mt-2" style={{ fontSize: settings.fontSize }}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p></div>
      <div className="card"><div className="font-bold mb-2">القارئ الافتراضي</div><select className="input" value={settings.reciter} onChange={(e) => setSettings({ reciter: e.target.value })}>{rec.data?.reciters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div className="card"><div className="font-bold mb-2">التفسير الافتراضي</div><select className="input" value={settings.tafsir} onChange={(e) => setSettings({ tafsir: e.target.value })}><option value="muyassar">التفسير الميسر</option><option value="jalalayn">تفسير الجلالين</option></select></div>
      <div className="card space-y-2"><div className="flex justify-between items-center"><span className="font-bold">تذكير الورد (على هذا الجهاز)</span><button className={settings.reminderOn ? 'btn-primary' : 'btn-ghost'} onClick={toggleReminder}>{settings.reminderOn ? 'مُفعّل' : 'تفعيل'}</button></div>
        {settings.reminderOn && <input type="time" className="input" value={settings.reminderTime} onChange={(e) => setSettings({ reminderTime: e.target.value })} />}
        <p className="muted">يعمل التذكير عندما يكون أُنس مفتوحاً في المتصفح. الإشعارات في الخلفية تحتاج تطبيق جوال أو Push Server (غير مضمّن).</p></div>
      <div className="card muted"><div className="font-bold text-emerald-900 dark:text-gold-300 mb-1">عن أُنس | ONS</div>بالقرب من القرآن تحيا القلوب. {rec.data && <><br />{rec.data.quran_source}<br />التفسير: {rec.data.tafsir_sources.muyassar}<br />الأذكار: {rec.data.adhkar_source}</>}</div>
    </div>
  )
}

export function Menu() {
  return (<div><PageHeader title="القائمة" back={false} /><div className="grid grid-cols-2 gap-3">{MORE.map((m) => <Link key={m.to} to={m.to} className="card flex items-center gap-3 hover:ring-2 ring-gold-400"><Icon name={m.icon} className="text-gold-600" /><span className="font-semibold text-sm">{m.label}</span></Link>)}</div></div>)
}
export function NotFound() { return <Empty icon="info" title="الصفحة غير موجودة"><Link className="btn-primary mt-3" to="/home">الرئيسية</Link></Empty> }
