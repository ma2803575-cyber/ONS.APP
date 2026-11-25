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
export const surahLabel = (s) => (s || '').replace(/[\u064B-\u065F\u0670]/g, '').trim()
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
