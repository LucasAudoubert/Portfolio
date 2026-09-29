import * as THREE from 'three'

/**
 * Region-based surface deformation.
 *
 * The Su-35 mesh is a single welded airframe with no separate nodes for the
 * flaps, stabilators, rudders or nozzles, so control surfaces are carved out
 * of the vertex data *by region* instead. Every vertex gets a weight per
 * group (0..1); the group then rotates it about its real hinge line and/or
 * translates it for the exploded view. Because the geometry is never cut,
 * the surface stays watertight - control surfaces bend, and the exploded
 * view simply tears along the region boundary (the airframe material is
 * double-sided, so no holes show).
 *
 * All regions are expressed in the model's root-local frame:
 *   +x = right wing, +y = up, +z = aft (nose at z = -5)
 */

export type SurfaceChannel = 'leFlap' | 'flap' | 'stab' | 'rudder' | 'flex' | 'gearRetract'

export interface DeformGroupSpec {
  id: string
  /** Label shown in the exploded view (omit for un-labelled groups). */
  label?: string
  /** Which physical side this group covers; -1 groups mirror axis + angle. */
  side: 1 | -1
  channel: SurfaceChannel
  /** Max rotation in radians at |channel| = 1. */
  maxAngle: number
  /** Rotation axis (root-local, right-hand side); mirrored for side = -1. */
  axis: [number, number, number]
  /** Point on the hinge line. */
  pivot: [number, number, number]
  /** Translation applied at explode = 1. */
  explode: [number, number, number]
  /** Per-vertex weight in rest space. `s` is |x|. */
  weight(x: number, y: number, z: number, s: number): number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Converts normalised/quantised attributes to plain floats, denormalising. */
function dequantize(geometry: THREE.BufferGeometry, names: string[]) {
  for (const name of names) {
    const attribute = geometry.attributes[name] as THREE.BufferAttribute | undefined
    if (!attribute) continue
    const { count, itemSize } = attribute
    if (!attribute.normalized && attribute.array instanceof Float32Array) continue
    const data = new Float32Array(count * itemSize)
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < itemSize; c++) data[i * itemSize + c] = attribute.getComponent(i, c)
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(data, itemSize))
  }
}

// ---- wing planform (fitted to the mesh) -----------------------------------
const LE = (s: number) => 0.65 + 0.744 * (s - 1.75) // leading edge line
const TE = (s: number) => 2.0 + 0.576 * (s - 1.75) // trailing edge line
const wingBand = (y: number) => y > -0.46 && y < 0.17
const WING_ROOT = 1.02
const WING_TIP = 3.42

export const AIRFRAME_GROUPS: DeformGroupSpec[] = [
  // ---- leading-edge flaps: the forward 16% of the outer wing ------------
  {
    id: 'leFlapR',
    label: 'Leading-edge flap',
    side: 1,
    channel: 'leFlap',
    maxAngle: THREE.MathUtils.degToRad(-26),
    axis: [1, 0, 0.744],
    pivot: [0, -0.15, -0.45],
    explode: [0.3, 0.2, -0.62],
    weight: (_x, y, z, s) =>
      wingBand(y) && s > 1.06 && s < WING_TIP && z > LE(s) - 0.1 && z < LE(s) + 0.2
        ? clamp01((LE(s) + 0.2 - z) / 0.3) * clamp01((s - 1.06) / 0.3)
        : 0,
  },
  // ---- flaperons: the aft 20% of the outer wing -------------------------
  {
    id: 'flapR',
    label: 'Flaperon',
    side: 1,
    channel: 'flap',
    maxAngle: THREE.MathUtils.degToRad(32),
    axis: [1, 0, 0.576],
    pivot: [0, -0.2, 0.65],
    explode: [0.45, -0.22, 0.75],
    weight: (_x, y, z, s) =>
      wingBand(y) && s > 1.06 && s < WING_TIP && z > TE(s) - 0.34 && z < TE(s) + 0.12
        ? clamp01((z - (TE(s) - 0.34)) / 0.24) * clamp01((s - 1.06) / 0.3)
        : 0,
  },
  // ---- outboard wing panel (flex + label; not separated in the exploded
  //      view - the wing is blended into the fuselage on a Flanker) --------
  {
    id: 'wingR',
    label: 'Wing',
    side: 1,
    channel: 'flex',
    maxAngle: THREE.MathUtils.degToRad(4.5),
    axis: [0, 0, 1], // bending about the longitudinal axis lifts the tip
    pivot: [0, -0.15, 1.0],
    explode: [0, 0, 0],
    weight: (_x, y, z, s) =>
      s > WING_ROOT && z > -1.5 && z < 3.75 && y > -0.5 && y < 0.25
        ? clamp01((s - 1.15) / 1.6) ** 1.4
        : 0,
  },
  // ---- all-moving stabilators ------------------------------------------
  {
    id: 'stabR',
    label: 'Stabilator',
    side: 1,
    channel: 'stab',
    maxAngle: THREE.MathUtils.degToRad(18),
    axis: [1, 0, 0],
    pivot: [0, -0.45, 3.55],
    explode: [0.55, -0.35, 1.05],
    weight: (_x, y, z, s) =>
      s > 1.08 && s < 2.85 && y > -0.72 && y < -0.34 && z > 3.5
        ? clamp01((z - 3.5) / 0.3) * clamp01((2.95 - s) / 0.2) * clamp01((s - 1.06) / 0.22)
        : 0,
  },
  // ---- rudders: aft strip of each fin ----------------------------------
  {
    id: 'rudderR',
    label: 'Rudder',
    side: 1,
    channel: 'rudder',
    maxAngle: THREE.MathUtils.degToRad(24),
    axis: [0, 1, 0],
    // the hinge is a vertical line at the fin's trailing edge (x ≈ ±1.05)
    pivot: [1.05, 0, 3.16],
    explode: [0.12, 0.22, 0.6],
    weight: (_x, y, z, s) =>
      s > 0.72 && s < 1.5 && y > 0.5 && z > 2.9
        ? clamp01((z - 3.16) / 0.22) * clamp01((1.5 - s) / 0.15)
        : 0,
  },
  // ---- vertical fins (exploded translation + label only) ----------------
  {
    id: 'finR',
    label: 'Vertical fin',
    side: 1,
    channel: 'leFlap', // unused (maxAngle 0)
    maxAngle: 0,
    axis: [0, 1, 0],
    pivot: [0, 0, 3.2],
    explode: [0.1, 0.85, -0.1],
    weight: (_x, y, z, s) => (s > 0.7 && s < 1.55 && y > 0.58 && z > 2.2 && z < 3.75 ? 1 : 0),
  },
  // ---- engine nacelles + nozzles ---------------------------------------
  {
    id: 'engineR',
    label: 'Engine nacelle',
    side: 1,
    channel: 'leFlap', // unused
    maxAngle: 0,
    axis: [0, 1, 0],
    pivot: [0, 0, 3.8],
    explode: [0.22, -0.18, 1.05],
    weight: (x, y, z, s) =>
      x > 0.18 && s < 1.06 && y > -0.85 && y < 0.02 && z > 3.45 ? clamp01((z - 3.45) / 0.25) : 0,
  },
  // ---- radome / nose cone ----------------------------------------------
  {
    id: 'nose',
    label: 'Radome',
    side: 1,
    channel: 'leFlap', // unused
    maxAngle: 0,
    axis: [0, 1, 0],
    pivot: [0, 0, -3.1],
    explode: [0, -0.15, -1.5],
    weight: (_x, _y, z) => clamp01((-3.1 - z) / 0.2),
  },
]

/** Mirror every right-hand group to the left. */
export function mirrorGroups(specs: DeformGroupSpec[]): DeformGroupSpec[] {
  const out: DeformGroupSpec[] = []
  for (const spec of specs) {
    out.push(spec)
    if (spec.side === 1 && /R$/.test(spec.id)) {
      out.push({
        ...spec,
        id: spec.id.replace(/R$/, 'L'),
        label: spec.label ? `${spec.label} (L)` : undefined,
        side: -1,
        axis: [-spec.axis[0], spec.axis[1], spec.axis[2]],
        pivot: [-spec.pivot[0], spec.pivot[1], spec.pivot[2]],
        explode: [-spec.explode[0], spec.explode[1], spec.explode[2]],
      })
    }
  }
  return out
}

/** Gear legs retract about their trunnions (measured from the mesh). */
export const GEAR_GROUPS: DeformGroupSpec[] = [
  {
    id: 'gearMainR',
    side: 1,
    channel: 'gearRetract',
    // A full 90° retraction would swing the strut through the fuselage; 42°
    // reads as the leg folding up under the belly.
    maxAngle: THREE.MathUtils.degToRad(42),
    axis: [1, 0, 0],
    pivot: [0.95, -0.08, 0.85],
    explode: [0, 0, 0],
    weight: (x) => (x > 0.3 ? 1 : 0),
  },
  {
    id: 'gearMainL',
    side: -1,
    channel: 'gearRetract',
    maxAngle: THREE.MathUtils.degToRad(42),
    axis: [-1, 0, 0],
    pivot: [-0.95, -0.08, 0.85],
    explode: [0, 0, 0],
    weight: (x) => (x < -0.3 ? 1 : 0),
  },
  {
    id: 'gearNose',
    side: 1,
    channel: 'gearRetract',
    maxAngle: THREE.MathUtils.degToRad(42),
    axis: [1, 0, 0],
    pivot: [0, -0.05, -1.05],
    explode: [0, 0, 0],
    weight: (x, _y, z) => (Math.abs(x) < 0.3 && z < 0.2 ? 1 : 0),
  },
]

// ---------------------------------------------------------------------------

interface BuiltGroup {
  spec: DeformGroupSpec
  axis: THREE.Vector3
  pivot: THREE.Vector3
  angleSign: number
  weights: Float32Array
  /** Weighted centre of the group's vertices in rest space (for labels). */
  center: THREE.Vector3
}

export interface SurfaceRig {
  /** Apply the given channel values; returns true when the mesh changed. */
  apply(values: Record<string, number>): boolean
  /** Rest-space centre of a group (undefined for un-labelled groups). */
  centerOf(id: string): THREE.Vector3 | undefined
  /** Groups that carry a label. */
  labelled(): BuiltGroup[]
  dispose(): void
}

/**
 * Bakes `mesh` into root-local space and prepares its deformable copy.
 * `rootLocalMatrix` maps the mesh's current world transform into the model's
 * root frame. The mesh ends up as an identity child of wherever it is
 * parented, so reparent it directly under the root afterwards.
 */
export function buildSurfaceRig(
  mesh: THREE.Mesh,
  specs: DeformGroupSpec[],
  rootLocalMatrix: THREE.Matrix4,
): SurfaceRig {
  // Quantised (KHR_mesh_quantization) attributes must become float before a
  // matrix is baked in - writing world-space floats into an int16 array
  // would silently truncate.
  dequantize(mesh.geometry, ['position', 'normal', 'tangent'])

  // Bake: after this the geometry *is* root-local, so region maths and the
  // per-frame writes need no extra transforms.
  mesh.geometry.applyMatrix4(rootLocalMatrix)
  mesh.position.set(0, 0, 0)
  mesh.quaternion.identity()
  mesh.scale.set(1, 1, 1)
  mesh.updateMatrix()
  mesh.frustumCulled = false

  const position = mesh.geometry.attributes.position as THREE.BufferAttribute
  const count = position.count
  const rest = new Float32Array(position.array as Float32Array)
  const out = new Float32Array(count * 3)

  const groups: BuiltGroup[] = specs.map((spec) => {
    const weights = new Float32Array(count)
    const acc = new THREE.Vector3()
    let total = 0
    // Paired groups (id ends in R/L) are authored against |x|, so they must be
    // gated to their own side - otherwise a right-wing vertex would receive
    // both the right and the (mirrored) left rotation.
    const paired = /[RL]$/.test(spec.id)
    for (let i = 0; i < count; i++) {
      const x = rest[i * 3]
      const y = rest[i * 3 + 1]
      const z = rest[i * 3 + 2]
      if (paired && (spec.side === 1 ? x < 0 : x > 0)) continue
      const w = spec.weight(x, y, z, Math.abs(x))
      if (w > 0) {
        weights[i] = w
        acc.x += x * w
        acc.y += y * w
        acc.z += z * w
        total += w
      }
    }
    const center = total > 0 ? acc.divideScalar(total) : new THREE.Vector3()
    return {
      spec,
      axis: new THREE.Vector3(...spec.axis).normalize(),
      pivot: new THREE.Vector3(...spec.pivot),
      // A mirrored rotation about the mirrored axis needs the negated angle.
      angleSign: spec.side === -1 ? -1 : 1,
      weights,
      center,
    }
  })

  let lastKey = ''
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const rel = new THREE.Vector3()

  const apply = (values: Record<string, number>): boolean => {
    const key = groups
      .map((g) => `${values[g.spec.channel] ?? 0}|${values.explode ?? 0}`)
      .join(',')
    if (key === lastKey) return false
    lastKey = key

    const explode = values.explode ?? 0

    for (let i = 0; i < count; i++) {
      v.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2])
      let ex = 0
      let ey = 0
      let ez = 0
      let touched = false

      for (const g of groups) {
        const w = g.weights[i]
        if (w === 0) continue
        touched = true
        const value = values[g.spec.channel] ?? 0
        if (value !== 0 && g.spec.maxAngle !== 0) {
          const angle = value * g.spec.maxAngle * g.angleSign * w
          rel.copy(v).sub(g.pivot)
          q.setFromAxisAngle(g.axis, angle)
          rel.applyQuaternion(q)
          v.copy(g.pivot).add(rel)
        }
        if (explode !== 0) {
          ex += g.spec.explode[0] * explode * w
          ey += g.spec.explode[1] * explode * w
          ez += g.spec.explode[2] * explode * w
        }
      }

      out[i * 3] = v.x + ex
      out[i * 3 + 1] = v.y + ey
      out[i * 3 + 2] = v.z + ez
      if (!touched) {
        out[i * 3] = rest[i * 3]
        out[i * 3 + 1] = rest[i * 3 + 1]
        out[i * 3 + 2] = rest[i * 3 + 2]
      }
    }

    ;(position.array as Float32Array).set(out)
    position.needsUpdate = true
    return true
  }

  return {
    apply,
    centerOf: (id) => groups.find((g) => g.spec.id === id)?.center,
    labelled: () => groups.filter((g) => !!g.spec.label),
    dispose: () => mesh.geometry.dispose(),
  }
}
