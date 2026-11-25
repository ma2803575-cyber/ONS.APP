import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Icon from './Icon'
import { useApp } from '../store'

export function PageHeader({ title, back = true, right, subtitle }) {
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-3 mb-4">
      {back && <button aria-label="رجوع" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/home'))} className="btn-ghost !p-2 rotate-180"><Icon name="arrow" /></button>}
      <div className="flex-1 min-w-0"><h1 className="h1 truncate">{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      {right}
    </div>
  )
}
export function Ring({ percent = 0, size = 120, stroke = 10, label, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${p}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity=".12" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#c9a24b" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} style={{ transition: 'stroke-dashoffset .8s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-extrabold text-xl">{label ?? `${p}%`}</div>{sub && <div className="text-xs muted">{sub}</div>}
      </div>
    </div>
  )
}
export function Bar({ value, max = 100, className = '' }) {
  const p = max ? Math.min(100, (value * 100) / max) : 0
  return <div className={`h-2.5 rounded-full bg-emerald-900/10 dark:bg-emerald-100/10 overflow-hidden ${className}`}><div className="h-full bg-gradient-to-l from-gold-400 to-emerald-600 rounded-full transition-all duration-700" style={{ width: p + '%' }} /></div>
}
export function Empty({ icon = 'info', title, children }) {
  return <div className="card text-center py-8"><div className="mx-auto w-12 h-12 rounded-full bg-gold-100 dark:bg-gold-500/20 text-gold-700 dark:text-gold-300 flex items-center justify-center mb-3"><Icon name={icon} className="w-6 h-6" /></div><div className="font-bold mb-1">{title}</div><div className="muted">{children}</div></div>
}
export function LoginGate({ what }) {
  return (
    <Empty icon="user" title="هذه الخاصية تحتاج حساباً">
      <p className="mb-3">{what || 'سجّل دخولك ليُحفظ تقدّمك على الخادم ويظهر على أي جهاز.'}</p>
      <div className="flex gap-2 justify-center"><Link to="/login" className="btn-primary">تسجيل الدخول</Link><Link to="/register" className="btn-ghost">حساب جديد</Link></div>
    </Empty>
  )
}
export function Spinner() { return <div className="flex justify-center py-10" role="status" aria-label="جارٍ التحميل"><div className="w-8 h-8 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" /></div> }
export function ErrorBox({ error, retry }) {
  return <div className="card border-red-300 text-center"><p className="text-red-700 dark:text-red-300 mb-2">{error?.message || error}</p>{retry && <button className="btn-ghost" onClick={retry}>إعادة المحاولة</button>}</div>
}
export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return <div role="status" className={`fixed top-4 inset-x-0 mx-auto w-fit max-w-[90vw] z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-fadeUp ${toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-800 text-white'}`}>{toast.msg}</div>
}
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    return fn().then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error }))
  }, deps) // eslint-disable-line
  useEffect(() => { reload() }, [reload])
  return { ...state, reload }
}
