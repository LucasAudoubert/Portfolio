/** Diagnostic: y-band profile of a part in a processed GLB. Dev-only. */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'

const [file, partName] = process.argv.slice(2)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(file)
await doc.transform(dequantize())
const node = doc.getRoot().listNodes().find((n) => n.getName() === partName)
if (!node) throw new Error(`part ${partName} not found`)

const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
const prims = node.getMesh().listPrimitives()
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
console.log(`part ${partName}: x[${min[0].toFixed(2)}..${max[0].toFixed(2)}] y[${min[1].toFixed(2)}..${max[1].toFixed(2)}] z[${min[2].toFixed(2)}..${max[2].toFixed(2)}]`)

const BANDS = 14
const bands = Array.from({ length: BANDS }, () => ({ n: 0, flat: 0, maxX: 0, maxZrel: 0, minZrel: 99, maxAbsZ: 0 }))
const a = [0, 0, 0]
const b = [0, 0, 0]
const c = [0, 0, 0]
const span = max[1] - min[1]
for (const prim of prims) {
  const pos = prim.getAttribute('POSITION')
  const idx = prim.getIndices().getArray()
  for (let i = 0; i < idx.length; i += 3) {
    pos.getElement(idx[i], a)
    pos.getElement(idx[i + 1], b)
    pos.getElement(idx[i + 2], c)
    const A=toWorld(a),B=toWorld(b),C=toWorld(c); const cy = (A[1] + B[1] + C[1]) / 3
    const cx = (A[0] + B[0] + C[0]) / 3
    const cz = (A[2] + B[2] + C[2]) / 3
    const uy = B[1] - A[1], uz = B[2] - A[2], ux = B[0] - A[0]
    const vy = C[1] - A[1], vz = C[2] - A[2], vx = C[0] - A[0]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz) || 1
    ny /= len
    void nx; void nz
    const band = bands[Math.min(BANDS - 1, Math.max(0, Math.floor(((cy - min[1]) / span) * BANDS)))]
    band.n++
    if (Math.abs(ny) > 0.55) band.flat++
    band.maxX = Math.max(band.maxX, Math.abs(cx))
    band.maxZrel = Math.max(band.maxZrel, Math.abs(cz + 1.05))
    band.minZrel = Math.min(band.minZrel, Math.abs(cz + 1.05))
    band.maxAbsZ = Math.max(band.maxAbsZ, Math.abs(cz))
  }
}
console.log('  y band          tris   flat   max|x|  max|z+1.05|  max|z|')
bands.forEach((band, i) => {
  const lo = (min[1] + (span * i) / BANDS).toFixed(2)
  const hi = (min[1] + (span * (i + 1)) / BANDS).toFixed(2)
  console.log(
    `  ${lo.padStart(6)}..${hi.padStart(6)}  ${String(band.n).padStart(5)}  ${String(band.flat).padStart(5)}  ${band.maxX.toFixed(2).padStart(6)}  ${band.maxZrel.toFixed(2).padStart(10)}  ${band.maxAbsZ.toFixed(2).padStart(6)}`,
  )
})
