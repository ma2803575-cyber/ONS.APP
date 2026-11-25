import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { useApp } from '../store'
import { post } from '../api'

function Shell({ title, children, foot }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-paper dark:from-emerald-950 dark:to-[#0b1511]">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><Logo size={56} tagline /></div>
        <div className="card"><h1 className="h1 mb-4">{title}</h1>{children}</div>
        <div className="text-center mt-4 text-sm">{foot}</div>
      </div>
    </div>
  )
}
function Field({ label, ...p }) { return <label className="block mb-3"><span className="text-sm font-semibold mb-1 block">{label}</span><input className="input" {...p} /></label> }
const emailOk = (e) => /^\S+@\S+\.\S+$/.test(e)

export function Login() {
  const { login, notify } = useApp(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!emailOk(email)) return setErr('اكتب بريداً صحيحاً')
    if (!pw) return setErr('اكتب كلمة المرور')
    setBusy(true)
    try { const u = await login(email, pw); notify('أهلاً ' + u.name); nav('/home') } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="تسجيل الدخول" foot={<><Link to="/register" className="text-emerald-700 dark:text-gold-300 font-bold">إنشاء حساب جديد</Link> · <Link to="/home" className="muted">متابعة بدون حساب</Link></>}>
      <form onSubmit={submit} noValidate>
        <Field label="البريد الإلكتروني" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <Field label="كلمة المرور" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" />
        {err && <p role="alert" className="text-red-600 text-sm mb-3">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '...' : 'دخول'}</button>
        <Link to="/forgot" className="block text-center text-sm mt-3 muted">نسيت كلمة المرور؟</Link>
      </form>
    </Shell>
  )
}
export function Register() {
  const { register, notify } = useApp(); const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.name.trim().length < 2) return setErr('اكتب اسمك')
    if (!emailOk(f.email)) return setErr('اكتب بريداً صحيحاً')
    if (f.password.length < 8) return setErr('كلمة المرور 8 أحرف على الأقل')
    setBusy(true)
    try { await register(f.name.trim(), f.email, f.password); notify('تم إنشاء حسابك'); nav('/home') } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="حساب جديد" foot={<Link to="/login" className="text-emerald-700 dark:text-gold-300 font-bold">لدي حساب بالفعل</Link>}>
      <form onSubmit={submit} noValidate>
        <Field label="الاسم" value={f.name} onChange={set('name')} autoComplete="name" />
        <Field label="البريد الإلكتروني" type="email" value={f.email} onChange={set('email')} autoComplete="email" dir="ltr" />
        <Field label="كلمة المرور (8 أحرف أو أكثر)" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" dir="ltr" />
        {err && <p role="alert" className="text-red-600 text-sm mb-3">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? '...' : 'إنشاء الحساب'}</button>
      </form>
    </Shell>
  )
}
export function Forgot() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [token, setToken] = useState(''); const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!emailOk(email)) return setErr('اكتب بريداً صحيحاً')
    try { const r = await post('/auth/forgot', { email }); setMsg(r.message); setToken(r.dev_token || '') } catch (x) { setErr(x.message) }
  }
  return (
    <Shell title="استعادة كلمة المرور" foot={<Link to="/login" className="muted">رجوع</Link>}>
      <form onSubmit={submit} noValidate>
        <Field label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        {err && <p role="alert" className="text-red-600 text-sm mb-3">{err}</p>}
        <button className="btn-primary w-full">إرسال</button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
      {token && <p className="mt-2 text-xs p-2 rounded bg-gold-100 text-emerald-950">وضع التطوير: لا يوجد خادم بريد مفعّل. <Link className="underline font-bold" to={`/reset?token=${token}`}>افتح رابط الاستعادة</Link></p>}
    </Shell>
  )
}
export function Reset() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const { notify } = useApp()
  const [pw, setPw] = useState(''); const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('كلمة المرور 8 أحرف على الأقل')
    try { await post('/auth/reset', { token: sp.get('token') || '', password: pw }); notify('تم تغيير كلمة المرور'); nav('/login') } catch (x) { setErr(x.message) }
  }
  return (
    <Shell title="كلمة مرور جديدة">
      <form onSubmit={submit} noValidate>
        <Field label="كلمة المرور الجديدة" type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" autoComplete="new-password" />
        {err && <p role="alert" className="text-red-600 text-sm mb-3">{err}</p>}
        <button className="btn-primary w-full">حفظ</button>
      </form>
    </Shell>
  )
}
