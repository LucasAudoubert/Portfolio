/**
 * Screenshot helper (dev-only). Drives the locally installed Edge in headless
 * mode so the 3D output can be checked without a visible browser.
 *
 * Usage:
 *   node tools/shoot.mjs --url http://localhost:5173/inspector.html?model=rafale.glb --out tools/shots/rafale.png
 *   node tools/shoot.mjs --url http://localhost:5173/ --out shot.png --scroll 2400 --wait 1500
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe` : '',
].filter(Boolean)

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

const url = arg('url', 'http://localhost:5173/')
const out = resolve(arg('out', 'tools/shots/shot.png'))
const width = Number(arg('w', 1600))
const height = Number(arg('h', 900))
const wait = Number(arg('wait', 600))
const scrollTo = arg('scroll', null)
const expectReady = args.includes('--ready')

const executablePath = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('Edge not found; set the path in tools/shoot.mjs')
  process.exit(1)
}

mkdirSync(dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    `--window-size=${width},${height}`,
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--mute-audio',
  ],
  defaultViewport: { width, height, deviceScaleFactor: 1 },
})

try {
  const page = await browser.newPage()
  const logs = []
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`))

  const webgl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return 'none'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'webgl'
  })
  console.log('webgl:', webgl)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  if (expectReady) {
    await page.waitForFunction(() => (window).__ready !== undefined, { timeout: 30000 })
    const state = await page.evaluate(() => (window).__ready)
    if (state === 'error') console.log('page reported a load error')
  }

  if (scrollTo !== null) {
    await page.evaluate((y) => window.scrollTo(0, Number(y)), scrollTo)
  }

  await new Promise((r) => setTimeout(r, wait))
  await page.screenshot({ path: out })
  console.log('saved', out)
  for (const line of logs.slice(0, 30)) console.log('  ', line)
} finally {
  await browser.close()
}
