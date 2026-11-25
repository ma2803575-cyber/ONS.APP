export function LogoMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="شعار أُنس">
            <rect width="64" height="64" rx="16" fill="#064e3b" stroke="#c9a24b" strokeOpacity=".5" strokeWidth="1.5" />
      <path d="M40 14a19 19 0 1 0 0 36 15 15 0 1 1 0-36z" fill="#c9a24b" />
      <circle cx="43" cy="26" r="2.6" fill="#f5ecc9" />
      <path d="M14 50c6-4 12-4 18 0 6-4 12-4 18 0" stroke="#f5ecc9" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".85" />
    </svg>
  )
}
export default function Logo({ size = 44, light = false, tagline = false }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`font-extrabold text-2xl ${light ? 'text-gold-200' : 'text-emerald-900 dark:text-gold-300'}`}>أُنس <span className="text-sm font-semibold opacity-70 tracking-widest">ONS</span></div>
        {tagline && <div className={`text-xs ${light ? 'text-emerald-100/80' : 'muted'}`}>بالقرب من القرآن تحيا القلوب</div>}
      </div>
    </div>
  )
}
