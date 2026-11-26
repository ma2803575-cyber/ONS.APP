export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
export function hijriDate(d = new Date()) {
  try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) } catch { return '' }
}
export function gregDate(d = new Date()) {
  try { return new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) } catch { return d.toDateString() }
}
export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'قيام الليل مبارك'
  if (h < 12) return 'صباح النور'
  if (h < 17) return 'طاب يومك'
  if (h < 20) return 'مساء النور'
  return 'مساء الخير'
}
export const surahLabel = (s) => (s || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').trim()
export function ayahShareText(a) {
  return `﴿${a.text}﴾\n[${a.surah_name} : ${a.n}]\n\nمن تطبيق أُنس | ONS`
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select()
    let ok = false; try { ok = document.execCommand('copy') } catch { /* empty */ }
    ta.remove(); return ok
  }
}
export async function shareText(t) {
  if (navigator.share) { try { await navigator.share({ text: t }); return 'shared' } catch { return 'cancel' } }
  return (await copyText(t)) ? 'copied' : 'fail'
}
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
export const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v))

// Renders an ayah as a shareable 1080x1350 image card (works offline, no external service).
export async function ayahImage(a) {
  try { await document.fonts.load("40px 'Amiri Quran'", a.text) } catch { /* fall back to serif */ }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2f6b'); g.addColorStop(1, '#0a1433'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.strokeStyle = '#c9a24b'; x.lineWidth = 6; x.strokeRect(50, 50, W - 100, H - 100); x.lineWidth = 2; x.strokeRect(70, 70, W - 140, H - 140)
  x.direction = 'rtl'; x.textAlign = 'center'; x.fillStyle = '#dcc06a'; x.font = "700 44px Cairo, sans-serif"
  x.fillText(`سورة ${surahLabel(a.surah_name)} · آية ${toAr(a.n)}`, W / 2, 170)
  let size = a.text.length > 220 ? 42 : a.text.length > 120 ? 54 : 66
  let lines
  for (;;) {
    x.font = `${size}px 'Amiri Quran', serif`; lines = []; let cur = ''
    for (const w of a.text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > W - 260 && cur) { lines.push(cur); cur = w } else cur = t }
    lines.push(cur)
    if (lines.length * size * 2 <= H - 520 || size <= 30) break
    size -= 4
  }
  const lh = size * 2, top = (H - lines.length * lh) / 2 + size * 0.4
  x.fillStyle = '#fbfaf5'; lines.forEach((ln, i) => x.fillText(ln, W / 2, top + i * lh))
  x.fillStyle = '#dcc06a'; x.font = "700 40px Cairo, sans-serif"; x.fillText('أُنس | ONS', W / 2, H - 150)
  x.font = "400 28px Cairo, sans-serif"; x.fillStyle = '#a7f3d0'; x.fillText('بالقرب من القرآن تحيا القلوب', W / 2, H - 100)
  return new Promise((r) => c.toBlob(r, 'image/png'))
}
export async function shareAyahImage(a) {
  const blob = await ayahImage(a); if (!blob) return 'fail'
  const file = new File([blob], `ons-${a.surah}-${a.n}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return 'shared' } catch { return 'cancel' } }
  const u = URL.createObjectURL(blob), el = document.createElement('a'); el.href = u; el.download = file.name; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000)
  return 'saved'
}
