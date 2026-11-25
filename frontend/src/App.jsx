import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
const Splash = lazy(() => import('./pages/Splash'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Login = lazy(() => import('./pages/Auth').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Auth').then(m => ({ default: m.Register })))
const Forgot = lazy(() => import('./pages/Auth').then(m => ({ default: m.Forgot })))
const Reset = lazy(() => import('./pages/Auth').then(m => ({ default: m.Reset })))
const Home = lazy(() => import('./pages/Home'))
const Quran = lazy(() => import('./pages/Quran'))
const Bookmarks = lazy(() => import('./pages/Quran').then(m => ({ default: m.Bookmarks })))
const Reader = lazy(() => import('./pages/Reader'))
const Tafsir = lazy(() => import('./pages/Reader').then(m => ({ default: m.Tafsir })))
const AudioPage = lazy(() => import('./pages/AudioPage'))
const Khatma = lazy(() => import('./pages/Khatma').then(m => ({ default: m.Khatma })))
const Wird = lazy(() => import('./pages/Khatma').then(m => ({ default: m.Wird })))
const Memorization = lazy(() => import('./pages/Memorization'))
const Adhkar = lazy(() => import('./pages/Adhkar').then(m => ({ default: m.Adhkar })))
const AdhkarCategory = lazy(() => import('./pages/Adhkar').then(m => ({ default: m.AdhkarCategory })))
const AdhkarFavorites = lazy(() => import('./pages/Adhkar').then(m => ({ default: m.AdhkarFavorites })))
const Tasbeeh = lazy(() => import('./pages/Tasbeeh'))
const Duas = lazy(() => import('./pages/Duas').then(m => ({ default: m.Duas })))
const Sadaqah = lazy(() => import('./pages/Duas').then(m => ({ default: m.Sadaqah })))
const Assistant = lazy(() => import('./pages/Assistant'))
const Notifications = lazy(() => import('./pages/Account').then(m => ({ default: m.Notifications })))
const Profile = lazy(() => import('./pages/Account').then(m => ({ default: m.Profile })))
const Settings = lazy(() => import('./pages/Account').then(m => ({ default: m.Settings })))
const Menu = lazy(() => import('./pages/Account').then(m => ({ default: m.Menu })))
const NotFound = lazy(() => import('./pages/Account').then(m => ({ default: m.NotFound })))

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-center opacity-60">...</div>}>
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/welcome" element={<Onboarding />} />
      <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} /><Route path="/reset" element={<Reset />} />
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/quran" element={<Quran />} /><Route path="/surah/:n" element={<Reader />} />
        <Route path="/tafsir/:g" element={<Tafsir />} /><Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/audio" element={<AudioPage />} />
        <Route path="/wird" element={<Wird />} /><Route path="/khatma" element={<Khatma />} />
        <Route path="/memorization" element={<Memorization />} />
        <Route path="/adhkar" element={<Adhkar />} /><Route path="/adhkar/:id" element={<AdhkarCategory />} /><Route path="/adhkar-favorites" element={<AdhkarFavorites />} />
        <Route path="/tasbeeh" element={<Tasbeeh />} /><Route path="/duas" element={<Duas />} /><Route path="/sadaqah" element={<Sadaqah />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/notifications" element={<Notifications />} /><Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} /><Route path="/menu" element={<Menu />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
