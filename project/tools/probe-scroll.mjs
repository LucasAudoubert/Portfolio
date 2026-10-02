/**
 * Dev probe: reports how the rig responds to scroll, so pose timings can be
 * verified instead of eyeballed. Positions are in viewport heights.
 *
 *   node tools/probe-scroll.mjs [url] [vh...]
 */
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p))

const url = process.argv[2] ?? 'http://localhost:5173/'
const custom = process.argv.slice(3).map(Number)
const positions = custom.length ? custom : [0, 0.5, 1, 1.8, 2.3, 2.8, 3.2, 3.6, 4.4, 4.9, 5.4, 6.2, 6.6, 7.1, 7.6, 8.2, 8.8, 9.2]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__hologram !== undefined, { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2500))

  const info = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, view: window.innerHeight }))
  console.log(`document ${info.doc}px = ${(info.doc / info.view).toFixed(2)} vh`)
  console.log('     vh   rafale  mq9  apache  explode  labels  canopy  rotor  prop  camAz  dist')
  for (const vh of positions) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(vh * info.view))
    await new Promise((r) => setTimeout(r, 1800))
    const s = await page.evaluate(() => {
      const r = window.__hologram.rig
      return [r.rafale, r.mq9, r.apache, r.explode, r.labels, r.canopy, r.rotor, r.propeller, r.camAzimuth, r.camDistance]
    })
    const f = (v) => v.toFixed(2).padStart(6)
    console.log(`  ${vh.toFixed(2).padStart(5)}  ${s.map(f).join('  ')}`)
  }
} finally {
  await browser.close()
}
