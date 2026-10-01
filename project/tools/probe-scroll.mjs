/**
 * Dev probe: reports how the rig responds to scroll, so pose timings can be
 * verified instead of eyeballed.
 *
 *   node tools/probe-scroll.mjs [url] [scrollPx...]
 */
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p))

const url = process.argv[2] ?? 'http://localhost:5173/'
const positions = process.argv.slice(3).map(Number)
const scrolls = positions.length ? positions : [0, 450, 900, 1350, 1800, 2250, 2700, 3150, 3600, 4050]

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
  await new Promise((r) => setTimeout(r, 1500))

  const height = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    view: window.innerHeight,
  }))
  console.log(`document ${height.doc}px  viewport ${height.view}px  range ${height.doc - height.view}px`)
  console.log('  scroll   ratio   t(ms)   chapter  rafale apache mq9  explode  scan  labels  canopy  gear  rotor')
  for (const y of scrolls) {
    await page.evaluate((value) => window.scrollTo(0, value), y)
    await new Promise((r) => setTimeout(r, 2200))
    const state = await page.evaluate(() => {
      const handle = window.__hologram
      const rig = handle.rig
      return {
        actual: window.scrollY,
        chapter: handle.chapter,
        rafale: rig.rafale,
        apache: rig.apache,
        mq9: rig.mq9,
        explode: rig.explode,
        scan: rig.scan,
        labels: rig.labels,
        canopy: rig.canopy,
        gear: rig.gear,
        rotor: rig.rotor,
      }
    })
    const ratio = (state.actual / (height.doc - height.view)).toFixed(3)
    console.log(
      `  ${String(state.actual).padStart(5)}   ${ratio}   ${String(Math.round(ratio * 5000)).padStart(4)}   ` +
        `${String(state.chapter).padStart(5)}     ${state.rafale.toFixed(2)}   ${state.apache.toFixed(2)}   ${state.mq9.toFixed(2)}   ` +
        `${state.explode.toFixed(2)}    ${state.scan.toFixed(2)}  ${state.labels.toFixed(2)}    ${state.canopy.toFixed(2)}   ${state.gear.toFixed(2)}   ${state.rotor.toFixed(2)}`,
    )
  }
} finally {
  await browser.close()
}
