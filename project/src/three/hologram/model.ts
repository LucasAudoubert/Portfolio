import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { ModelConfig } from '../../data/models'

/**
 * Turns one prepared GLB (see tools/optimize-models.mjs) into a hologram: a
 * white wireframe with structural edges picked out, a faint vertex layer, and
 * a registry of named parts that can be moved, exploded or spun on their own.
 * Nothing here animates - the rig does that once per frame.
 */

export interface HologramPart {
  name: string
  /** Group holding this part's wire, edges and points. */
  object: THREE.Group
  /** Canonical-space centre of the part (annotation anchor). */
  center: THREE.Vector3
  /** Local position at rest; the rig restores this at explode = 0. */
  rest: THREE.Vector3
  /** Offset applied at explode = 1. */
  explode: THREE.Vector3
}

export interface HologramSpin {
  /** Pivot group sitting on the rotation axis; rotate this. */
  pivot: THREE.Group
  axis: 'x' | 'y' | 'z'
  /** Radians per second at rig speed 1. */
  speed: number
  /** Rig channel that scales the speed. */
  key: string
  /** Axis-aligned centre of the swept disc. */
  center: THREE.Vector3
  /** Radius of the swept disc, for the rotation indicator. */
  radius: number
}

export interface HologramModel {
  id: string
  config: ModelConfig
  /** Container the rig positions and fades. */
  root: THREE.Group
  /** Body the rig rotates (attitude) and explodes. */
  stage: THREE.Group
  parts: HologramPart[]
  spins: HologramSpin[]
  size: THREE.Vector3
  /** Materials whose opacity the rig scales, with their base value. */
  fade: Array<{ material: THREE.Material; base: number }>
  dispose(): void
}

/** Line weights: structural edges carry the silhouette, the raw wire is air. */
const WIRE_OPACITY = 0.12
const EDGE_OPACITY = 0.5
const POINT_OPACITY = 0.3
/** Faces flatter than this keep their shared edge in the structural layer. */
const EDGE_THRESHOLD = 24

export async function loadHologramModel(config: ModelConfig): Promise<HologramModel> {
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(`${import.meta.env.BASE_URL}${config.url}`)

  const source = gltf.scene
  source.updateMatrixWorld(true)

  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: WIRE_OPACITY,
    depthWrite: false,
  })
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: EDGE_OPACITY,
    depthWrite: false,
  })
  const pointMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: POINT_OPACITY,
    depthWrite: false,
  })

  const root = new THREE.Group()
  root.name = `${config.id}-root`
  const stage = new THREE.Group()
  stage.name = `${config.id}-stage`
  root.add(stage)

  // The prepared GLB is scene -> <id> -> one node per part.
  const body = source.children[0] ?? source
  const parts: HologramPart[] = []
  const bounds = new THREE.Box3()
  const boxes = new Map<string, THREE.Box3>()
  const owned: THREE.BufferGeometry[] = []

  for (const child of [...body.children]) {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) continue
    mesh.updateMatrixWorld(true)

    const geometry = mesh.geometry as THREE.BufferGeometry
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute)
    box.applyMatrix4(mesh.matrixWorld)
    bounds.union(box)
    boxes.set(mesh.name, box)

    // WireframeGeometry and EdgesGeometry both bake positions into a new
    // buffer, so they carry the node transform copied onto the layer.
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), wireMaterial)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD), edgeMaterial)
    const points = new THREE.Points(geometry, pointMaterial)
    owned.push(wire.geometry, edges.geometry)

    const object = new THREE.Group()
    object.name = mesh.name
    for (const layer of [wire, edges, points]) {
      layer.matrixAutoUpdate = false
      layer.matrix.copy(mesh.matrixWorld)
      layer.frustumCulled = false
      object.add(layer)
    }
    stage.add(object)

    parts.push({
      name: mesh.name,
      object,
      center: box.getCenter(new THREE.Vector3()),
      rest: new THREE.Vector3(),
      explode: new THREE.Vector3(...(config.explode[mesh.name] ?? [0, 0, 0])),
    })
  }

  // --- spin pivots ----------------------------------------------------------
  const spins: HologramSpin[] = []
  for (const config_ of config.spins ?? []) {
    const spinning = parts.filter((part) => config_.parts.includes(part.name))
    if (!spinning.length) continue

    const center = new THREE.Vector3()
    const swept = new THREE.Box3()
    for (const part of spinning) {
      center.add(part.center)
      swept.union(boxes.get(part.name)!)
    }
    center.divideScalar(spinning.length)

    const pivot = new THREE.Group()
    pivot.name = `${config.id}-spin-${config_.key}`
    pivot.position.copy(center)
    stage.add(pivot)
    for (const part of spinning) {
      pivot.attach(part.object) // keeps the world transform, rebases on the pivot
      part.rest.copy(part.object.position)
    }

    const sweptSize = swept.getSize(new THREE.Vector3())
    spins.push({
      pivot,
      axis: config_.axis,
      speed: config_.speed,
      key: config_.key,
      center,
      radius: 0.5 * Math.max(sweptSize.x, sweptSize.z) + 0.2,
    })
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
    size: bounds.getSize(new THREE.Vector3()),
    fade: [
      { material: wireMaterial, base: WIRE_OPACITY },
      { material: edgeMaterial, base: EDGE_OPACITY },
      { material: pointMaterial, base: POINT_OPACITY },
    ],
    dispose,
  }
}
