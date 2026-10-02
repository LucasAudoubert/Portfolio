import * as THREE from 'three'
import type { HologramModel } from './model'
import { createGlowLineMaterial, type GlowMaterial } from './materials'

/**
 * The technical graphics around an airframe, in its own stage space:
 *
 *   - reference axes and dimension brackets (span, length);
 *   - the rotation indicator, riding on the primary spin hub;
 *   - the scanning ruler;
 *   - exploded-view traces: one thin line per part, from its mounting point
 *     to where it has been pulled - the "assembly path" of a technical
 *     exploded drawing.
 */

export interface HologramOverlay {
  group: THREE.Group
  /** Rotation indicator; follows the primary hub, turns in its own plane. */
  ring: THREE.Group | null
  /** Sweep ruler; the rig slides it through the airframe along Y. */
  scan: THREE.Group
  /** Rewrites the trace segments from the parts' current positions. */
  updateTraces(amount: number): void
  /** materials[0] axes, [1] accents, [2] scan, [3] traces */
  glowMaterials: GlowMaterial[]
  dispose(): void
}

const AXIS_OPACITY = 0.13
const ACCENT_OPACITY = 0.6
const SCAN_OPACITY = 0.38
const TRACE_OPACITY = 0.32

function segment(list: number[], a: THREE.Vector3, b: THREE.Vector3) {
  list.push(a.x, a.y, a.z, b.x, b.y, b.z)
}

function lines(verts: number[], material: THREE.Material): THREE.LineSegments {
  const object = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)),
    material,
  )
  object.frustumCulled = false
  return object
}

export function createHologramOverlay(model: HologramModel): HologramOverlay {
  const group = new THREE.Group()
  group.name = `${model.id}-overlay`

  const axisMaterial = createGlowLineMaterial(AXIS_OPACITY)
  const accentMaterial = createGlowLineMaterial(ACCENT_OPACITY)
  const scanMaterial = createGlowLineMaterial(SCAN_OPACITY)
  const traceMaterial = createGlowLineMaterial(TRACE_OPACITY)

  const { min, max } = model.bounds
  const centre = model.bounds.getCenter(new THREE.Vector3())

  // --- reference axes + dimension brackets ---------------------------------
  const axisVerts: number[] = []
  const tick = 0.16
  for (const axis of ['x', 'y', 'z'] as const) {
    const a = centre.clone()
    const b = centre.clone()
    a[axis] = min[axis] - 0.3
    b[axis] = max[axis] + 0.3
    segment(axisVerts, a, b)
    for (const end of [a, b]) {
      for (const other of ['x', 'y', 'z'] as const) {
        if (other === axis) continue
        const p = end.clone()
        const q = end.clone()
        p[other] -= tick
        q[other] += tick
        segment(axisVerts, p, q)
      }
    }
  }

  const floor = min.y - 0.85
  // Span bracket, in front of the nose.
  segment(axisVerts, new THREE.Vector3(min.x, floor, min.z), new THREE.Vector3(max.x, floor, min.z))
  for (const x of [min.x, max.x]) {
    segment(axisVerts, new THREE.Vector3(x, floor - 0.2, min.z), new THREE.Vector3(x, floor + 0.2, min.z))
  }
  // Length bracket, along the left side.
  segment(axisVerts, new THREE.Vector3(min.x - 0.6, floor, min.z), new THREE.Vector3(min.x - 0.6, floor, max.z))
  for (const z of [min.z, max.z]) {
    segment(axisVerts, new THREE.Vector3(min.x - 0.8, floor, z), new THREE.Vector3(min.x - 0.4, floor, z))
  }
  group.add(lines(axisVerts, axisMaterial))

  // --- rotation indicator ---------------------------------------------------
  let ring: THREE.Group | null = null
  const primary = model.spins[0]
  if (primary) {
    const { radius, axis } = primary
    ring = new THREE.Group()
    // The ring is drawn in its local XY plane: turn that plane square to the axis.
    const plane = new THREE.Group()
    if (axis === 'x') plane.rotation.y = Math.PI / 2
    else if (axis === 'y') plane.rotation.x = -Math.PI / 2
    ring.add(plane)

    const verts: number[] = []
    const steps = 96
    const point = (angle: number, r: number) => new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0)
    for (let i = 0; i < steps; i++) {
      // Dashed outer circle: every other segment.
      if (i % 2 === 0) segment(verts, point((i / steps) * Math.PI * 2, radius), point(((i + 1) / steps) * Math.PI * 2, radius))
    }
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2
      const inner = i % 9 === 0 ? radius - 0.42 : radius - 0.18
      segment(verts, point(angle, radius), point(angle, inner))
    }
    for (const base of [0, Math.PI]) {
      const tip = point(base, radius - 0.02)
      const wing = Math.min(0.28, radius * 0.25)
      segment(verts, tip, point(base - wing / radius, radius - wing))
      segment(verts, tip, point(base + wing / radius, radius - wing))
    }
    const spinner = lines(verts, accentMaterial)
    spinner.name = 'spinner'
    plane.add(spinner)
    group.add(ring)
  }

  // --- scanning ruler -------------------------------------------------------
  const scan = new THREE.Group()
  const scanVerts: number[] = []
  const left = min.x - 0.9
  const right = max.x + 0.9
  for (const offset of [-0.14, 0, 0.14]) {
    segment(scanVerts, new THREE.Vector3(left, offset, centre.z), new THREE.Vector3(right, offset, centre.z))
  }
  for (let x = Math.ceil(left * 2) / 2; x <= right; x += 0.5) {
    const h = Math.abs(x % 1) < 1e-6 ? 0.16 : 0.08
    segment(scanVerts, new THREE.Vector3(x, -h, centre.z), new THREE.Vector3(x, h, centre.z))
  }
  scan.add(lines(scanVerts, scanMaterial))
  group.add(scan)

  // --- exploded-view traces (dynamic) ---------------------------------------
  const traced = model.parts.filter((part) => part.explode.lengthSq() > 0.01)
  const traceBuffer = new Float32Array(traced.length * 6)
  const traceGeometry = new THREE.BufferGeometry()
  traceGeometry.setAttribute('position', new THREE.BufferAttribute(traceBuffer, 3).setUsage(THREE.DynamicDrawUsage))
  const traces = new THREE.LineSegments(traceGeometry, traceMaterial)
  traces.frustumCulled = false
  group.add(traces)

  const updateTraces = (amount: number) => {
    traces.visible = amount > 0.02
    if (!traces.visible) return
    traced.forEach((part, i) => {
      const o = i * 6
      traceBuffer[o] = part.center.x
      traceBuffer[o + 1] = part.center.y
      traceBuffer[o + 2] = part.center.z
      traceBuffer[o + 3] = part.current.x
      traceBuffer[o + 4] = part.current.y
      traceBuffer[o + 5] = part.current.z
    })
    traceGeometry.attributes.position.needsUpdate = true
  }

  return {
    group,
    ring,
    scan,
    updateTraces,
    glowMaterials: [axisMaterial, accentMaterial, scanMaterial, traceMaterial],
    dispose: () => {
      group.traverse((object) => {
        const segments = object as THREE.LineSegments
        if (segments.isLineSegments) segments.geometry.dispose()
      })
      axisMaterial.dispose()
      accentMaterial.dispose()
      scanMaterial.dispose()
      traceMaterial.dispose()
    },
  }
}
