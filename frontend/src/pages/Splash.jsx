import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import { useApp } from '../store'

export default function Splash() {
  const nav = useNavigate(); const { ready, user } = useApp()
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => nav(localStorage.getItem('ons_onboarded') || user ? '/home' : '/welcome', { replace: true }), 1600)
    return () => clearTimeout(t)
  }, [ready, user, nav])
  return (
    <div className="min-h-screen flex flex-col items-center justify-center hero-bg text-white">
      <div className="animate-fadeUp flex flex-col items-center gap-5">
        <LogoMark size={110} />
        <h1 className="text-5xl font-extrabold text-gold-300">أُنس</h1>
        <div className="tracking-[.6em] text-gold-200/80 text-sm">ONS</div>
        <p className="mt-6 text-emerald-100/90">بالقرب من القرآن تحيا القلوب</p>
      </div>
    </div>
  )
}
