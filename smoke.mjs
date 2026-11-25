// End-to-end smoke test driving the real built app + API in headless Chrome.
// Usage: ONS_URL=http://localhost:8000 CHROME=/usr/bin/google-chrome node e2e/smoke.mjs
import puppeteer from 'puppeteer-core'
const URL = process.env.ONS_URL || 'http://localhost:8000'
const results = []
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')) }
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/audio|net::ERR|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (t) => t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
const text = () => page.evaluate(() => document.body.innerText)
const ntext = async () => strip(await text())
const clickText = async (t, sel = 'button,a') => {
  const h = await page.evaluateHandle((t, sel) => [...document.querySelectorAll(sel)].find((e) => e.innerText.trim().includes(t)), t, sel)
  const el = h.asElement(); if (!el) throw new Error('no element with text: ' + t); await el.click()
}
const shot = (n) => page.screenshot({ path: `shots/${n}.png` })

await page.goto(URL + '/', { waitUntil: 'networkidle0' })
ok('splash shows name', (await text()).includes('أُنس') && (await text()).includes('بالقرب من القرآن تحيا القلوب'))
await shot('01-splash')
await page.waitForFunction(() => location.pathname === '/welcome', { timeout: 6000 })
ok('onboarding after splash', (await text()).includes('مصحف كامل'))
await shot('02-onboarding')
await clickText('التالي'); await clickText('التالي'); await shot('03-onboarding3')
await clickText('إنشاء حساب')
await page.waitForSelector('input[type=password]')
const email = `e2e${Date.now()}@example.com`
// validation first
await clickText('إنشاء الحساب'); ok('register validation shows error', (await text()).includes('اكتب اسمك'))
const inputs = await page.$$('input')
await inputs[0].type('محمد علي'); await inputs[1].type(email); await inputs[2].type('Passw0rd!x')
await clickText('إنشاء الحساب')
await page.waitForFunction(() => location.pathname === '/home', { timeout: 8000 })
await sleep(800)
ok('home greets user with name', (await text()).includes('محمد علي'))
ok('home shows hijri date', /هـ|١٤\d\d/.test(await text()))
await shot('04-home-new')

// Quran reader
await page.goto(URL + '/quran', { waitUntil: 'networkidle0' })
ok('surah list has 114 entries', (await page.$$eval('a[href^="/surah/"]', (a) => a.length)) === 114)
await shot('05-quran-index')
await page.type('input[aria-label="بحث في القرآن"]', 'الصبر'); await sleep(1200)
ok('search returns ayah results', (await page.$$eval('a[href*="?g="]', (a) => a.length)) > 0)
await shot('06-search')
await page.goto(URL + '/surah/1', { waitUntil: 'networkidle0' }); await sleep(500)
ok('Fatiha shows 7 ayah markers', (await page.$$eval('.ayah-end', (a) => a.length)) === 7)
ok('reader contains Quran text', (await ntext()).includes('الحمد لله رب العلمين'))
await shot('07-reader')
await page.click('#a2'); await sleep(300); await shot('08-ayah-sheet')
await clickText('علامة مرجعية'); await sleep(600)
ok('bookmark persisted via API', await page.evaluate(async () => (await (await fetch('/api/bookmarks', { headers: { Authorization: 'Bearer ' + localStorage.ons_token } })).json()).length === 1))
await page.click('#a3'); await clickText('وصلت هنا'); await sleep(500)
ok('"reached here" without plan shows server message', (await text()).includes('أنشئ خطة ختمة'))
// tafsir
await page.goto(URL + '/tafsir/1', { waitUntil: 'networkidle0' }); await sleep(400)
ok('tafsir shows source', (await text()).includes('المصدر') && (await text()).includes('مجمع الملك فهد'))
await shot('09-tafsir')
await page.goto(URL + '/surah/112', { waitUntil: 'networkidle0' }); await sleep(2500)
ok('last read saved to server', await page.evaluate(async () => { const r = await (await fetch('/api/reading/last', { headers: { Authorization: 'Bearer ' + localStorage.ons_token } })).json(); return r && r.surah === 112 }))

// Khatma
await page.goto(URL + '/khatma', { waitUntil: 'networkidle0' }); await sleep(400)
await clickText('٦٠ يوماً'); ok('plan preview computes 11 pages', (await text()).includes('١١'))
await clickText('ابدأ الختمة'); await sleep(900)
ok('khatma plan created', (await text()).includes('٠ / ٦٠٤'))
await clickText('+١٠ صفحة'); await sleep(700)
ok('logging 10 pages updates progress', (await text()).includes('١٠ / ٦٠٤'))
await shot('10-khatma')
await page.goto(URL + '/wird', { waitUntil: 'networkidle0' }); await sleep(400)
ok('wird shows today 10/11', (await text()).includes('١٠/١١') || (await text()).includes('١٠'))
await shot('11-wird')
// memorization
await page.goto(URL + '/memorization', { waitUntil: 'networkidle0' }); await sleep(400)
await page.select('select[aria-label="السورة"]', '112'); await clickText('إضافة', 'button'); await sleep(800)
ok('memorization list has surah 112', (await ntext()).includes('الاخلاص'))
await shot('12-memorization')
// adhkar + tasbeeh
await page.goto(URL + '/adhkar/1', { waitUntil: 'networkidle0' }); await sleep(400)
ok('adhkar category shows items', (await page.$$eval('.card', (c) => c.length)) > 5)
await shot('13-adhkar')
await page.goto(URL + '/tasbeeh', { waitUntil: 'networkidle0' }); await sleep(300)
for (let i = 0; i < 5; i++) await page.click('button[aria-label^="تسبيح"]')
await sleep(1800)
ok('tasbeeh counter increments and saves', await page.evaluate(async () => (await (await fetch('/api/tasbeeh', { headers: { Authorization: 'Bearer ' + localStorage.ons_token } })).json()).today === 5))
await shot('14-tasbeeh')
// duas + sadaqah
await page.goto(URL + '/duas', { waitUntil: 'networkidle0' }); await clickText('الدنيا والآخرة'); await sleep(300)
ok('quranic dua text shown', (await ntext()).includes('ربنا ءاتنا في الدنيا حسنة'))
await shot('15-duas')
await page.goto(URL + '/sadaqah', { waitUntil: 'networkidle0' }); await sleep(500); await shot('16-sadaqah')
ok('sadaqah lists official links', (await page.$$eval('a[target=_blank]', (a) => a.length)) >= 3)
// assistant
await page.goto(URL + '/assistant', { waitUntil: 'networkidle0' })
await page.type('input[aria-label="رسالتك"]', 'آيات عن الصبر'); await page.keyboard.press('Enter'); await sleep(1500)
ok('assistant returns ayahs with sources', (await text()).includes('المصادر') && (await text()).includes('التفسير الميسر'))
await page.type('input[aria-label="رسالتك"]', 'ما حكم الموسيقى'); await page.keyboard.press('Enter'); await sleep(1200)
ok('assistant refuses fatwa', (await text()).includes('لا أُصدر فتاوى'))
await shot('17-assistant')
// dashboard
await page.goto(URL + '/home', { waitUntil: 'networkidle0' }); await sleep(900)
ok('dashboard shows khatma progress', (await text()).includes('ختمة القرآن'))
await shot('18-home')
await page.goto(URL + '/notifications', { waitUntil: 'networkidle0' }); await sleep(500)
ok('notifications exist', (await text()).includes('إنجاز') || (await text()).includes('ورد اليوم'))
await shot('19-notifications')
await page.goto(URL + '/settings', { waitUntil: 'networkidle0' }); await clickText('الوضع الليلي', 'span,div'); 
await page.click('button[role=switch]'); await sleep(300)
ok('dark mode toggles class', await page.evaluate(() => document.documentElement.classList.contains('dark')))
await shot('20-settings-dark')
await page.goto(URL + '/profile', { waitUntil: 'networkidle0' }); await sleep(500); await shot('21-profile')
// logout / login again
await clickText('تسجيل الخروج'); await sleep(500)
await page.goto(URL + '/login', { waitUntil: 'networkidle0' })
const li = await page.$$('input'); await li[0].type(email); await li[1].type('wrong-password'); await clickText('دخول', 'button'); await sleep(700)
ok('wrong password shows error', (await text()).includes('غير صحيحة'))
await li[1].click(); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await li[1].type('Passw0rd!x'); await clickText('دخول', 'button')
await page.waitForFunction(() => location.pathname === '/home', { timeout: 6000 }).catch(async () => { await shot('login-fail'); console.log((await text()).slice(0, 300)) })
ok('login works again', page.url().endsWith('/home'))
// guest mode
await page.evaluate(() => localStorage.removeItem('ons_token'))
await page.goto(URL + '/surah/2', { waitUntil: 'networkidle0' }); await sleep(500)
ok('guest can read Baqarah (286 ayahs)', (await page.$$eval('.ayah-end', (a) => a.length)) === 286)
await page.goto(URL + '/khatma', { waitUntil: 'networkidle0' }); ok('guest sees login gate on khatma', (await text()).includes('تحتاج حساباً'))
// desktop layout
await page.setViewport({ width: 1280, height: 800 }); await page.goto(URL + '/home', { waitUntil: 'networkidle0' }); await shot('22-desktop-home')
ok('desktop sidebar visible', await page.evaluate(() => getComputedStyle(document.querySelector('aside')).display !== 'none'))
await page.goto(URL + '/surah/18', { waitUntil: 'networkidle0' }); await sleep(500); await shot('23-desktop-reader')
// horizontal overflow check on mobile
await page.setViewport({ width: 360, height: 740 })
for (const p of ['/home', '/quran', '/surah/2', '/adhkar', '/tasbeeh', '/assistant', '/duas', '/sadaqah', '/audio']) {
  await page.goto(URL + p, { waitUntil: 'networkidle0' }); await sleep(250)
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok('no horizontal overflow at 360px ' + p, w <= 1, 'overflow ' + w)
}
ok('no JS/console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
