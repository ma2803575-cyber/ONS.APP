import puppeteer from 'puppeteer-core'
const base = process.argv[2] || 'http://localhost:8000'
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({ width: 390, height: 844 })
await p.goto(base + '/', { waitUntil: 'networkidle0' })
await p.evaluate(() => navigator.serviceWorker.ready)
await new Promise((r) => setTimeout(r, 12000)) // let content precache finish
await p.reload({ waitUntil: 'networkidle0' })
const cached = await p.evaluate(async () => ({ keys: await caches.keys(), content: (await (await caches.open('ons-content')).keys()).length, ctrl: !!navigator.serviceWorker.controller }))
console.log('cache', JSON.stringify(cached))
await p.setOfflineMode(true)
for (const [path, shot] of [['/', 'home'], ['/surah/2', 'surah2'], ['/surah/36', 'surah36'], ['/adhkar', 'adhkar'], ['/duas', 'duas']]) {
  await p.goto(base + path, { waitUntil: 'networkidle0' }).catch((e) => console.log('goto err', path, e.message))
  await new Promise((r) => setTimeout(r, 1500))
  const t = await p.evaluate(() => document.body.innerText.replace(/\n/g, ' | ').slice(0, 160))
  console.log(path, '=>', t)
  await p.screenshot({ path: `/downloads/off-${shot}.png` })
}
await b.close()
