import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Stamps dist/sw.js with a build id and the list of built assets to precache for offline use.
function offlineSW() {
  let outDir = 'dist'
  return {
    name: 'ons-offline-sw',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir) },
    closeBundle() {
      const assetsDir = path.join(outDir, 'assets')
      const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff')).sort() : []
      const list = files.map((f) => '/assets/' + f)
      const hash = crypto.createHash('sha1').update(list.join('|') + fs.readFileSync(path.join(outDir, 'index.html'))).digest('hex').slice(0, 10)
      const sw = path.join(outDir, 'sw.js')
      let src = fs.readFileSync(sw, 'utf8')
      src = src.replace("/*__BUILD__*/'dev'", JSON.stringify(hash)).replace('/*__ASSETS__*/[]', JSON.stringify(list))
      fs.writeFileSync(sw, src)
    },
  }
}
export default defineConfig({
  plugins: [react(), offlineSW()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.js' },
})
