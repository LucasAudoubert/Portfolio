/**
 * Diagnostic: slice profile of a part in a processed GLB. Dev-only.
 *
 *   node tools/band-probe.mjs public/models/rafale.glb airframe z
 *
 * Prints one row per slice along the chosen axis with, per row: triangle
 * count, how many are "flat" (normal mostly along Y), and the extent of the
 * geometry on the other two axes. Used to pick region cuts.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'

const [file, partName, axis = 'y'] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(file)
await doc.transform(dequantize())
const node = doc.getRoot().listNodes().find((n) => n.getName() === partName)
if (!node) throw new Error(`part ${partName} not found`)

const axisIndex = { x: 0, y: 1, z: 2 }[axis]
const others = [0, 1, 2].filter((k) => k !== axisIndex)
const prims = node.getMesh().listPrimitives()

const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
const p = [0, 0, 0]
// Quantisation can push the mesh scale onto the node, so work in world space.
const wm = node.getWorldMatrix()
const toWorld = (v) => [
  wm[0] * v[0] + wm[4] * v[1] + wm[8] * v[2] + wm[12],
  wm[1] * v[0] + wm[5] * v[1] + wm[9] * v[2] + wm[13],
  wm[2] * v[0] + wm[6] * v[1] + wm[10] * v[2] + wm[14],
]
for (const prim of prims) {
  const pos = prim.getAttribute('POSITION')
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p)
    const w = toWorld(p)
    for (let k = 0; k < 3; k++) {
      if (w[k] < min[k]) min[k] = w[k]
      if (w[k] > max[k]) max[k] = w[k]
    }
  }
}
const fmt = (v) => v.map((x) => x.toFixed(1).padStart(6)).join(' ')
console.log(`part ${partName}: min(${fmt(min)}) max(${fmt(max)})  slice axis ${axis}`)

const BANDS = 20
const span = max[axisIndex] - min[axisIndex]
const bands = Array.from({ length: BANDS }, () => ({
  n: 0,
  flat: 0,
  lo: [Infinity, Infinity],
  hi: [-Infinity, -Infinity],
}))
const a = [0, 0, 0]
const b = [0, 0, 0]
const c = [0, 0, 0]
for (const prim of prims) {
  const pos = prim.getAttribute('POSITION')
  const idx = prim.getIndices().getArray()
  for (let i = 0; i < idx.length; i += 3) {
    pos.getElement(idx[i], a)
    pos.getElement(idx[i + 1], b)
    pos.getElement(idx[i + 2], c)
    const A = toWorld(a)
    const B = toWorld(b)
    const C = toWorld(c)
    const centre = [0, 1, 2].map((k) => (A[k] + B[k] + C[k]) / 3)
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
    let ny = u[2] * v[0] - u[0] * v[2]
    const len = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ) || 1
    ny /= len
    const band = bands[
      Math.min(BANDS - 1, Math.max(0, Math.floor(((centre[axisIndex] - min[axisIndex]) / span) * BANDS)))
    ]
    band.n++
    if (Math.abs(ny) > 0.55) band.flat++
    for (let k = 0; k < 2; k++) {
      band.lo[k] = Math.min(band.lo[k], centre[others[k]])
      band.hi[k] = Math.max(band.hi[k], centre[others[k]])
    }
  }
}

const names = { x: 'X', y: 'Y', z: 'Z' }
console.log(
  `  ${axis} band            tris   flat   ${names[others[0]]} range           ${names[others[1]]} range`,
)
bands.forEach((band, i) => {
  const lo = (min[axisIndex] + (span * i) / BANDS).toFixed(2)
  const hi = (min[axisIndex] + (span * (i + 1)) / BANDS).toFixed(2)
  const range = (k) =>
    band.n === 0 ? '     -' : `${band.lo[k].toFixed(2).padStart(6)}..${band.hi[k].toFixed(2).padStart(6)}`
  console.log(
    `  ${lo.padStart(6)}..${hi.padStart(6)}  ${String(band.n).padStart(5)}  ${String(band.flat).padStart(5)}   ${range(0)}        ${range(1)}`,
  )
})
