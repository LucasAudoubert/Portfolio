import * as THREE from 'three'
import type { HologramModel } from './model'
import { createGlowLineMaterial, type GlowMaterial } from './materials'

/**
 * The technical graphics that surround the airframe: reference axes, a
 * dimension bracket under the span, the rotation indicator on the spin axis
 * and the scanning ruler. All flat white lines, all independent from the
 * model so they can be animated on their own timeline.
 */

export interface HologramOverlay {
  group: THREE.Group
  /** Rotation indicator; rotate this around its own axis. */
  ring: THREE.Group | null
  /** Sweep rig; the rig slides it through the airframe along Y. */
  scan: THREE.Group
  fade: Array<{ material: THREE.Material; base: number }>
  /** Shader materials that follow the scanning ruler. */
  glowMaterials: GlowMaterial[]
  dispose(): void
}

const AXIS_OPACITY = 0.15
const ACCENT_OPACITY = 0.65
const SCAN_OPACITY = 0.4

/** Short line segment helper: pushes two points into a flat vertex list. */
function segment(list: number[], a: THREE.Vector3, b: THREE.Vector3) {
  list.push(a.x, a.y, a.z, b.x, b.y, b.z)
}

export function createHologramOverlay(model: HologramModel): HologramOverlay {
  const group = new THREE.Group()
  group.name = `${model.id}-overlay`

  const axisMaterial = createGlowLineMaterial(AXIS_OPACITY)
  const accentMaterial = createGlowLineMaterial(ACCENT_OPACITY)
  /** The scanning ruler gets its own material so it can pulse on its own. */
  const scanMaterial = createGlowLineMaterial(SCAN_OPACITY)

  // --- reference axes through the origin ------------------------------------
  const half = model.size.clone().multiplyScalar(0.5)
  const axisVerts: number[] = []
  const tick = 0.18
  for (const axis of ['x', 'y', 'z'] as const) {
    const end = new THREE.Vector3()
    end[axis] = half[axis] + 0.25
    const start = end.clone().multiplyScalar(-1)
    segment(axisVerts, start, end)
    // End ticks: a small cross so each axis reads as a station line.
    for (const other of ['x', 'y', 'z'] as const) {
      if (other === axis) continue
      const a = end.clone()
      const b = end.clone()
      a[other] -= tick
      b[other] += tick
      segment(axisVerts, a, b)
    }
  }

  // --- dimension bracket under the span ------------------------------------
  const bracketY = -half.y - 0.9
  segment(
    axisVerts,
    new THREE.Vector3(-half.x, bracketY, 0),
    new THREE.Vector3(half.x, bracketY, 0),
  )
  for (const x of [-half.x, half.x]) {
    segment(
      axisVerts,
      new THREE.Vector3(x, bracketY - 0.22, 0),
      new THREE.Vector3(x, bracketY + 0.22, 0),
    )
  }
  // ...and a shorter one across the length, on the ground plane.
  const lengthZ = half.z
  const bracketX = -half.x - 0.7
  segment(
    axisVerts,
    new THREE.Vector3(bracketX, bracketY, -lengthZ),
    new THREE.Vector3(bracketX, bracketY, lengthZ),
  )
  for (const z of [-lengthZ, lengthZ]) {
    segment(
      axisVerts,
      new THREE.Vector3(bracketX - 0.22, bracketY, z),
      new THREE.Vector3(bracketX + 0.22, bracketY, z),
    )
  }

  const axes = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(axisVerts, 3)),
    axisMaterial,
  )
  axes.frustumCulled = false
  group.add(axes)

  // --- rotation indicator ---------------------------------------------------
  let ring: THREE.Group | null = null
  const primary = model.spins[0]
  if (primary) {
    const { center, radius, axis } = primary
    ring = new THREE.Group()
    ring.position.copy(center)
    if (axis === 'x') ring.rotation.y = Math.PI / 2
    else if (axis === 'y') ring.rotation.x = -Math.PI / 2

    const verts: number[] = []
    const steps = 72
    const point = (angle: number, r: number) =>
      new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0)
    for (let i = 0; i < steps; i++) {
      segment(verts, point((i / steps) * Math.PI * 2, radius), point(((i + 1) / steps) * Math.PI * 2, radius))
    }
    // Graduations every 15 degrees, longer every 90.
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2
      const inner = i % 6 === 0 ? radius - 0.45 : radius - 0.22
      segment(verts, point(angle, radius), point(angle, inner))
    }
    // Two arrowheads on the ring, showing the direction of travel.
    for (const base of [0, Math.PI]) {
      const tip = point(base, radius - 0.02)
      const wing = 0.26
      segment(verts, tip, point(base - wing / radius, radius - wing))
      segment(verts, tip, point(base + wing / radius, radius - wing))
    }
    // The axis itself, drawn through the hub.
    const axisEnd = new THREE.Vector3()
    axisEnd[axis] = radius * 0.55
    segment(verts, axisEnd.clone().multiplyScalar(-1), axisEnd.clone().multiplyScalar(1))

    const ringLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)),
      accentMaterial,
    )
    ringLines.frustumCulled = false
    ring.add(ringLines)
    group.add(ring)
  }

  // --- scanning ruler -------------------------------------------------------
  const scan = new THREE.Group()
  const scanVerts: number[] = []
  const width = half.x + 0.9
  for (const offset of [-0.16, 0, 0.16]) {
    scanVerts.push(-width, offset, 0, width, offset, 0)
    void offset
  }
  // Ticks along the ruler: a real measuring line, not a laser.
  for (let x = -Math.floor(width); x <= width; x += 0.5) {
    const long = Math.abs(x % 1) < 1e-6
    const h = long ? 0.16 : 0.08
    segment(scanVerts, new THREE.Vector3(x, -h, 0), new THREE.Vector3(x, h, 0))
  }
  const scanLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(scanVerts, 3)),
    scanMaterial,
  )
  scanLines.frustumCulled = false
  scan.add(scanLines)
  group.add(scan)

  return {
    group,
    ring,
    scan,
    fade: [
      { material: axisMaterial, base: axisMaterial.baseOpacity },
      { material: accentMaterial, base: accentMaterial.baseOpacity },
      { material: scanMaterial, base: scanMaterial.baseOpacity },
    ],
    glowMaterials: [axisMaterial, accentMaterial, scanMaterial],
    dispose: () => {
      group.traverse((object) => {
        const lines = object as THREE.LineSegments
        if (lines.isLineSegments) lines.geometry.dispose()
      })
      axisMaterial.dispose()
      accentMaterial.dispose()
      scanMaterial.dispose()
    },
  }
}
