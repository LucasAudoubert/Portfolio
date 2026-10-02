import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { ModelConfig } from '../../data/models'
import { createGlowLineMaterial, createGlowPointMaterial, type GlowMaterial } from './materials'

/**
 * Turns one prepared GLB (see tools/optimize-models.mjs) into a hologram: a
 * white wireframe with structural edges picked out, a faint vertex layer, and
 * a registry of named parts that can be exploded or spun on their own.
 * Nothing here animates - the rig does that once per frame.
 */

export interface HologramSpin {
  /** Pivot group sitting on the hub axis; the rig rotates and offsets it. */
  pivot: THREE.Group
  /** Pivot position at rest (stage space). */
  rest: THREE.Vector3
  /** Exploded offset of the whole spinning group (taken from the hub part). */
  explode: THREE.Vector3
  axis: 'x' | 'y' | 'z'
  speed: number
  /** Rig channel that scales the speed. */
  key: string
  /** Hub position, canonical space. */
  center: THREE.Vector3
  /** Radius of the swept disc, for the rotation indicator. */
  radius: number
}

export interface HologramPart {
  name: string
  /** Group holding this part's wire, edges and points. */
  object: THREE.Group
  /** Canonical bounds and centre at rest. */
  box: THREE.Box3
  center: THREE.Vector3
  radius: number
  /** Local position at rest; the rig restores this at explode = 0. */
  rest: THREE.Vector3
  /** Offset at explode = 1 (outboard already mirrored to the part's side). */
  explode: THREE.Vector3
  /** 0..1 lag so parts separate one after another, not all at once. */
  stagger: number
  /** Spin group this part rides in (moved through its pivot, not directly). */
  spin: HologramSpin | null
  /** Current centre in stage space - written by the rig every frame. */
  current: THREE.Vector3
}

export interface HologramModel {
  id: string
  config: ModelConfig
  /** Container the rig shows and hides. */
  root: THREE.Group
  /** Body the rig rotates (attitude) and explodes. */
  stage: THREE.Group
  parts: HologramPart[]
  spins: HologramSpin[]
  bounds: THREE.Box3
  size: THREE.Vector3
  /** Largest downward / upward exploded offset, for the reveal cut range. */
  reach: { down: number; up: number }
  glowMaterials: GlowMaterial[]
  dispose(): void
}

/** Line weights: structural edges carry the silhouette, the raw wire is air. */
const WIRE_OPACITY = 0.11
const EDGE_OPACITY = 0.52
const POINT_OPACITY = 0.3
/** Faces flatter than this keep their shared edge in the structural layer. */
const EDGE_THRESHOLD = 24
/** Triangles per unit of bounding-sphere area above which a part is "dense". */
const DENSE_PART = 900
const DENSE_EDGE_THRESHOLD = 45
/** Fraction of the explode range used to stagger parts. */
const STAGGER = 0.4

export async function loadHologramModel(config: ModelConfig): Promise<HologramModel> {
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(`${import.meta.env.BASE_URL}${config.url}`)

  const source = gltf.scene
  source.updateMatrixWorld(true)

  const wireMaterial = createGlowLineMaterial(WIRE_OPACITY)
  const edgeMaterial = createGlowLineMaterial(EDGE_OPACITY)
  const pointMaterial = createGlowPointMaterial(POINT_OPACITY, 1.6)

  const root = new THREE.Group()
  root.name = `${config.id}-root`
  const stage = new THREE.Group()
  stage.name = `${config.id}-stage`
  root.add(stage)

  // The prepared GLB is scene -> <id> -> one node per part.
  const body = source.children[0] ?? source
  const parts: HologramPart[] = []
  const bounds = new THREE.Box3()
  const owned: THREE.BufferGeometry[] = []
  const order = Object.keys(config.explode)

  for (const child of [...body.children]) {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) continue
    mesh.updateMatrixWorld(true)

    const geometry = mesh.geometry as THREE.BufferGeometry
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute)
    box.applyMatrix4(mesh.matrixWorld)
    bounds.union(box)

    // Small, very dense parts (wheels, the sensor ball: thousands of triangles
    // in a few centimetres) turn into solid white blobs if every edge and
    // vertex is drawn. They keep their structural edges only.
    const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const density = triangles / Math.max(1e-3, 4 * Math.PI * sphere.radius * sphere.radius)
    const dense = density > DENSE_PART

    // WireframeGeometry and EdgesGeometry bake positions into new buffers, so
    // they carry the node transform copied onto the layer.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, dense ? DENSE_EDGE_THRESHOLD : EDGE_THRESHOLD),
      edgeMaterial,
    )
    owned.push(edges.geometry)
    const layers: THREE.Object3D[] = [edges]
    if (!dense) {
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), wireMaterial)
      owned.push(wire.geometry)
      layers.unshift(wire)
      layers.push(new THREE.Points(geometry, pointMaterial))
    }

    const object = new THREE.Group()
    object.name = mesh.name
    for (const layer of layers) {
      layer.matrixAutoUpdate = false
      layer.matrix.copy(mesh.matrixWorld)
      layer.frustumCulled = false
      object.add(layer)
    }
    stage.add(object)

    const center = box.getCenter(new THREE.Vector3())
    const raw = config.explode[mesh.name] ?? [0, 0, 0]
    // X is "outboard": mirror it to whichever side the part sits on.
    const side = Math.abs(center.x) > 0.05 ? Math.sign(center.x) : 1
    const index = order.indexOf(mesh.name)

    parts.push({
      name: mesh.name,
      object,
      box,
      center,
      radius: sphere.radius,
      rest: new THREE.Vector3(),
      explode: new THREE.Vector3(raw[0] * side, raw[1], raw[2]),
      stagger: index < 0 ? 0 : (index / Math.max(1, order.length - 1)) * STAGGER,
      spin: null,
      current: center.clone(),
    })
  }

  // --- spin groups ----------------------------------------------------------
  // The hub part's bounding-box centre IS the axis: averaging several parts
  // (a 3-blade prop is not symmetric in its bounding box) put the pivot off
  // the shaft and made the propeller wobble around its hub.
  const spins: HologramSpin[] = []
  for (const spinConfig of config.spins ?? []) {
    const hub = parts.find((part) => part.name === spinConfig.pivot)
    const members = parts.filter((part) => spinConfig.parts.includes(part.name))
    if (!hub || !members.length) continue

    const pivot = new THREE.Group()
    pivot.name = `${config.id}-spin-${spinConfig.pivot}`
    pivot.position.copy(hub.center)
    stage.add(pivot)

    const swept = new THREE.Box3()
    for (const part of members) {
      pivot.attach(part.object) // keeps the world transform, rebases on the pivot
      part.rest.copy(part.object.position)
      swept.union(part.box)
    }
    const size = swept.getSize(new THREE.Vector3())
    const across =
      spinConfig.axis === 'y'
        ? Math.max(size.x, size.z)
        : spinConfig.axis === 'x'
          ? Math.max(size.y, size.z)
          : Math.max(size.x, size.y)

    const spin: HologramSpin = {
      pivot,
      rest: hub.center.clone(),
      // The whole group translates with its hub, so a rotor slides along its
      // mast instead of its blades flying apart while spinning.
      explode: hub.explode.clone(),
      axis: spinConfig.axis,
      speed: spinConfig.speed,
      key: spinConfig.key,
      center: hub.center.clone(),
      radius: across * 0.5 + 0.15,
    }
    for (const part of members) part.spin = spin
    spins.push(spin)
  }

  // --- reveal range: how far the exploded parts reach above / below ---------
  let down = 0
  let up = 0
  for (const part of parts) {
    down = Math.max(down, -Math.min(0, part.explode.y))
    up = Math.max(up, Math.max(0, part.explode.y))
  }

  const dispose = () => {
    owned.forEach((geometry) => geometry.dispose())
    wireMaterial.dispose()
    edgeMaterial.dispose()
    pointMaterial.dispose()
  }

  return {
    id: config.id,
    config,
    root,
    stage,
    parts,
    spins,
    bounds,
    size: bounds.getSize(new THREE.Vector3()),
    reach: { down, up },
    glowMaterials: [wireMaterial, edgeMaterial, pointMaterial],
    dispose,
  }
}

/** Eased, staggered explode amount for one part (0..1). */
export function partExplode(part: HologramPart, explode: number): number {
  const t = THREE.MathUtils.clamp((explode - part.stagger) / (1 - STAGGER), 0, 1)
  // easeInOutCubic: parts accelerate off their mounts and settle in place.
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
