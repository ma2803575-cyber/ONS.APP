import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { LogoMark } from '../components/Logo'

const SLIDES = [
  { icon: 'book', title: 'مصحف كامل بنصّه الموثّق', text: 'القرآن الكريم كاملاً بالرسم العثماني، مع الجزء والحزب والصفحة، وبحث وعلامات وآخر موضع وصلت إليه، وتفسير بمصدره.' },
  { icon: 'target', title: 'ورد يومي وختمة تمضي بك', text: 'اختر ختمة في 30 أو 60 أو 90 يوماً أو مدة تناسبك، وتابع تقدمك وإنجازاتك يوماً بيوم، وراجع ما حفظت بجدول مراجعة ذكي.' },
  { icon: 'spark', title: 'أذكار ومسبحة ومساعد بمصادر', text: 'أذكار حصن المسلم ومسبحة إلكترونية، ومساعد لا يخترع آية ولا حديثاً: كل إجابة معها مصدرها، وإن لم يجد قال لك ذلك.' },
]
export default function Onboarding() {
  const [i, setI] = useState(0); const nav = useNavigate(); const s = SLIDES[i]
  const finish = (to) => { localStorage.setItem('ons_onboarded', '1'); nav(to, { replace: true }) }
  return (
    <div className="min-h-screen flex flex-col hero-bg text-white p-6">
      <div className="flex justify-between items-center"><LogoMark size={40} /><button className="text-sm text-gold-200" onClick={() => finish('/home')}>تخطي</button></div>
      <div key={i} className="flex-1 flex flex-col items-center justify-center text-center gap-5 max-w-md mx-auto animate-fadeUp">
        <div className="w-24 h-24 rounded-full bg-gold-500/20 text-gold-300 flex items-center justify-center"><Icon name={s.icon} className="w-12 h-12" /></div>
        <h2 className="text-2xl font-extrabold text-gold-200">{s.title}</h2>
        <p className="text-emerald-50/90 leading-8">{s.text}</p>
      </div>
      <div className="flex justify-center gap-2 mb-5">{SLIDES.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-8 bg-gold-400' : 'w-2 bg-white/30'}`} />)}</div>
      <div className="max-w-md w-full mx-auto flex flex-col gap-3">
        {i < SLIDES.length - 1 ? <button className="btn-gold" onClick={() => setI(i + 1)}>التالي</button> : (<>
          <button className="btn-gold" onClick={() => finish('/register')}>إنشاء حساب</button>
          <button className="btn bg-white/10 hover:bg-white/20" onClick={() => finish('/home')}>ابدأ بدون حساب</button></>)}
      </div>
    </div>
  )
}
