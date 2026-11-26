import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import Logo from './Logo'
import { Toast } from './ui'
import MiniPlayer from './MiniPlayer'
import { useApp } from '../store'

const MAIN = [
  { to: '/home', icon: 'home', label: 'الرئيسية' },
  { to: '/quran', icon: 'book', label: 'المصحف' },
  { to: '/khatma', icon: 'target', label: 'الختمة' },
  { to: '/adhkar', icon: 'spark', label: 'الأذكار' },
  { to: '/assistant', icon: 'bot', label: 'مساعد أُنس' },
]
const MORE = [
  { to: '/wird', icon: 'flame', label: 'الورد اليومي' },
  { to: '/quiz', icon: 'brain', label: 'اختبر حفظك' },
  { to: '/circles', icon: 'user', label: 'تحدي الأصحاب' },
  { to: '/memorization', icon: 'brain', label: 'الحفظ والمراجعة' },
  { to: '/tasbeeh', icon: 'circle', label: 'المسبحة' },
  { to: '/duas', icon: 'heart', label: 'الأدعية' },
  { to: '/sadaqah', icon: 'gift', label: 'الصدقة والدعاء للمتوفين' },
  { to: '/audio', icon: 'headphones', label: 'التلاوات' },
  { to: '/notifications', icon: 'bell', label: 'الإشعارات' },
  { to: '/profile', icon: 'user', label: 'حسابي' },
  { to: '/settings', icon: 'cog', label: 'الإعدادات' },
]
const cls = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${isActive ? 'bg-emerald-700 text-white dark:bg-gold-500 dark:text-emerald-950 font-bold' : 'hover:bg-emerald-900/5 dark:hover:bg-emerald-100/10'}`

export default function Layout() {
  const { unread, user } = useApp()
  const loc = useLocation()
  const immersive = loc.pathname.startsWith('/page/')
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-1 p-4 border-l border-emerald-900/10 dark:border-emerald-100/10 sticky top-0 h-screen overflow-y-auto">
        <Link to="/home" className="mb-4"><Logo tagline /></Link>
        {[...MAIN, ...MORE].map((n) => (
          <NavLink key={n.to} to={n.to} className={cls}><Icon name={n.icon} /><span className="flex-1">{n.label}</span>{n.to === '/notifications' && unread > 0 && <span className="bg-gold-500 text-emerald-950 text-xs rounded-full px-2">{unread}</span>}</NavLink>
        ))}
        {!user && <Link to="/login" className="btn-gold mt-3">تسجيل الدخول</Link>}
      </aside>
      <main className="flex-1 min-w-0">
        {!immersive && <header className="md:hidden flex items-center justify-between px-4 pt-3">
          <Link to="/home"><Logo size={34} /></Link>
          <div className="flex gap-1">
            <Link to="/notifications" aria-label="الإشعارات" className="btn-ghost !p-2 relative"><Icon name="bell" />{unread > 0 && <span className="absolute -top-1 -left-1 bg-gold-500 text-emerald-950 text-[10px] rounded-full px-1.5">{unread}</span>}</Link>
            <Link to="/menu" aria-label="القائمة" className="btn-ghost !p-2"><Icon name="menu" /></Link>
          </div>
        </header>}
        <div key={loc.pathname} className={immersive ? '' : 'max-w-3xl mx-auto p-4 pad-safe'}><Outlet /></div>
      </main>
      <MiniPlayer />
      {!immersive && <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#080f22]/95 backdrop-blur border-t border-emerald-900/10 dark:border-emerald-100/10 flex justify-around pb-[env(safe-area-inset-bottom)]" aria-label="التنقل الرئيسي">
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 px-2 text-[11px] flex-1 ${isActive ? 'text-emerald-700 dark:text-gold-300 font-bold' : 'text-emerald-900/60 dark:text-emerald-100/60'}`}>
            <Icon name={n.icon} className="w-6 h-6" />{n.label}
          </NavLink>
        ))}
      </nav>}
      <Toast />
    </div>
  )
}
export { MORE }
