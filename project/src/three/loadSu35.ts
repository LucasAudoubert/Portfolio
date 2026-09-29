import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import {
  AIRFRAME_GROUPS,
  GEAR_GROUPS,
  buildSurfaceRig,
  mirrorGroups,
  type SurfaceRig,
} from './surfaces'

/**
 * Loads the Su-35 airframe (Sketchfab model by "bohmerang", CC-BY-NC-SA-4.0,
 * optimised with glTF-Transform from 31 MB to ~1.2 MB).
 *
 * The raw model is Y-up with the nose along +X. This module normalises it to
 * the rig's convention - nose along -Z, wings along X, length 10 units,
 * centred on the origin - bakes the two deformable meshes into that frame,
 * and builds the afterburner + label anchors.
 */

const MODEL_URL = `${import.meta.env.BASE_URL}models/su-35.glb`
const TARGET_LENGTH = 10

/**
 * Canopy travel in model units. Model space after the glTF node chain:
 * +x = nose (so -x is aft), +y = up, +z = span. The canopy slides back over
 * the spine and lifts a touch.
 */
const CANOPY_SLIDE = 12
const CANOPY_LIFT = 1.5

/** Exploded-view offsets for the parts that are whole glTF nodes. */
const NODE_EXPLODE: Record<string, [number, number, number]> = {
  'SU-35-cockpit_2': [0, 0.9, 0.15],
  'SU-35-hud_3': [0, 1.05, -0.35],
}
const CANOPY_EXPLODE = new THREE.Vector3(0, 1.35, 0.4)
const GEAR_EXPLODE = new THREE.Vector3(0, -0.7, 0.25)

export interface JetLabel {
  id: string
  label: string
  /** Anchor object whose world position the label tracks. */
  marker: THREE.Object3D
  /** Root-space anchors follow the exploded view (node anchors do not). */
  rest?: THREE.Vector3
  offset?: THREE.Vector3
}

export interface JetModel {
  /** Normalised wrapper: rotation is free for the rig's attitude tweens. */
  root: THREE.Group
  /** Canopy node - slides aft on its rails. */
  canopy: THREE.Object3D
  canopyRest: THREE.Vector3
  canopyDelta: THREE.Vector3
  canopyExplode: THREE.Vector3
  /** Retracted landing gear (visible while the gear is travelling up). */
  gearRetracted: THREE.Object3D
  /** Extended landing gear - swings down from its trunnions. */
  gearDeployed: THREE.Object3D
  /** Landing light mesh + its material (emissive intensity is rig-driven). */
  gearLight: THREE.Object3D | null
  landingLightMaterial: THREE.MeshStandardMaterial | null
  /** Region-based deformation for the airframe + gear. */
  surfaces: SurfaceRig
  gearSurfaces: SurfaceRig
  /** Afterburner plumes (one group per engine, positioned on the nozzles). */
  plumes: THREE.Group[]
  plumeMaterial: THREE.MeshBasicMaterial
  /** Part anchors for the exploded-view labels. */
  labels: JetLabel[]
  /** Node-based parts that translate when the model explodes. */
  explodeNodes: Array<{ node: THREE.Object3D; rest: THREE.Vector3; offset: THREE.Vector3 }>
  dispose(): void
}

export function loadSu35(onProgress?: (ratio: number) => void): Promise<JetModel> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)

  return new Promise((resolve, reject) => {
    loader.load(
      MODEL_URL,
      (gltf) => {
        try {
          resolve(prepare(gltf))
        } catch (error) {
          reject(error)
        }
      },
      (event) => {
        if (!onProgress) return
        onProgress(event.total > 0 ? event.loaded / event.total : 0)
      },
      (error) => reject(error),
    )
  })
}

function prepare(gltf: { scene: THREE.Group }): JetModel {
  const model = gltf.scene
  model.updateMatrixWorld(true)

  const canopy = model.getObjectByName('SU-35canopy_1')
  const gearRetracted = model.getObjectByName('SU-35-landingOff_5')
  const gearDeployed = model.getObjectByName('SU-35-landingOn_6')
  const gearLight = model.getObjectByName('SU-35-landingOnLight_7') ?? null
  const airframeNode = model.getObjectByName('SU-35-airframe_0')
  if (!canopy || !gearRetracted || !gearDeployed || !airframeNode) {
    throw new Error('su-35.glb is missing expected nodes (canopy / airframe / landing gear)')
  }

  // Canopy travel is authored in the canopy's parent frame.
  const parent = canopy.parent
  if (!parent) throw new Error('su-35.glb: canopy node has no parent')
  const parentQuat = parent.getWorldQuaternion(new THREE.Quaternion()).invert()
  const canopyDelta = new THREE.Vector3(-CANOPY_SLIDE, CANOPY_LIFT, 0).applyQuaternion(parentQuat)
  const canopyRest = canopy.position.clone()

  const landingLightMaterial = findLandingLightMaterial(gearLight)
  if (landingLightMaterial) landingLightMaterial.emissiveIntensity = 0.1
  gearDeployed.visible = false
  if (gearLight) gearLight.visible = false

  // --- normalise: nose +X -> -Z, scale to TARGET_LENGTH, centre on origin --
  const orientation = new THREE.Group()
  orientation.rotation.y = Math.PI / 2
  orientation.add(model)

  const box = new THREE.Box3().setFromObject(orientation)
  const size = box.getSize(new THREE.Vector3())
  const length = Math.max(size.x, size.z)
  orientation.scale.setScalar(TARGET_LENGTH / length)
  box.setFromObject(orientation)
  const center = box.getCenter(new THREE.Vector3())
  orientation.position.set(-center.x, -center.y, -center.z)

  const root = new THREE.Group()
  root.name = 'su-35'
  root.add(orientation)
  root.updateMatrixWorld(true)

  // --- bake the deformable meshes into root-local space -------------------
  // After baking, each mesh carries its own geometry in root coordinates, so
  // it must be re-parented to an identity transform under the root.
  const airframeMesh = airframeNode.children[0] as THREE.Mesh
  const gearMesh = gearDeployed.children[0] as THREE.Mesh
  const surfaces = buildSurfaceRig(airframeMesh, mirrorGroups(AIRFRAME_GROUPS), rootWorldToLocal(root, airframeMesh))
  const gearSurfaces = buildSurfaceRig(gearMesh, GEAR_GROUPS, rootWorldToLocal(root, gearMesh))

  const airframeHolder = new THREE.Group()
  airframeHolder.name = 'airframe'
  root.add(airframeHolder)
  airframeHolder.add(airframeMesh)

  const gearHolder = new THREE.Group()
  gearHolder.name = 'gear-deployed'
  root.add(gearHolder)
  gearHolder.add(gearMesh)
  root.updateMatrixWorld(true)

  // --- labels: anchors that follow each part ------------------------------
  const labels: JetLabel[] = []
  for (const group of surfaces.labelled()) {
    const spec = group.spec
    if (spec.side !== 1) continue // label one of each mirrored pair
    const marker = new THREE.Object3D()
    marker.position.copy(group.center)
    root.add(marker)
    labels.push({
      id: spec.id,
      label: spec.label!,
      marker,
      rest: group.center.clone(),
      offset: new THREE.Vector3(...spec.explode),
    })
  }
  // node-based parts: anchor at their own bounding-box centre in node space
  const anchor = (id: string, text: string, node: THREE.Object3D) => {
    node.updateMatrixWorld(true)
    const worldCenter = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())
    const marker = new THREE.Object3D()
    marker.position.copy(node.worldToLocal(worldCenter))
    node.add(marker)
    labels.push({ id, label: text, marker })
  }
  const canopyNode = model.getObjectByName('SU-35canopy_1')
  const cockpitNode = model.getObjectByName('SU-35-cockpit_2')
  if (canopyNode) anchor('canopy', 'Canopy', canopyNode)
  if (cockpitNode) anchor('cockpit', 'Cockpit & seat', cockpitNode)
  anchor('gear', 'Landing gear', gearHolder)

  // --- exploded-view translations for the node-based parts ----------------
  const explodeNodes: JetModel['explodeNodes'] = [
    { node: gearHolder, rest: gearHolder.position.clone(), offset: GEAR_EXPLODE.clone() },
  ]
  for (const [name, offset] of Object.entries(NODE_EXPLODE)) {
    const node = model.getObjectByName(name)
    if (!node) continue
    explodeNodes.push({ node, rest: node.position.clone(), offset: new THREE.Vector3(...offset) })
  }

  // --- afterburners: find the nozzle exits on the baked airframe ----------
  const nozzle = findNozzles(airframeMesh)
  const plumeMaterial = new THREE.MeshBasicMaterial({
    color: 0xeef2ff,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  })
  const plumeGeometry = makePlumeGeometry(nozzle.radius, 1.9)
  const glowGeometry = new THREE.CircleGeometry(nozzle.radius * 1.02, 20)
  glowGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(glowGeometry.attributes.position.count * 4).fill(1), 4),
  )
  const plumes = nozzle.positions.map((position) => {
    const group = new THREE.Group()
    group.position.copy(position)
    const plume = new THREE.Mesh(plumeGeometry, plumeMaterial)
    const core = new THREE.Mesh(plumeGeometry, plumeMaterial)
    core.scale.set(0.5, 0.5, 0.72)
    const glow = new THREE.Mesh(glowGeometry, plumeMaterial)
    group.add(plume, core, glow)
    group.visible = false
    root.add(group)
    return group
  })

  return {
    root,
    canopy,
    canopyRest,
    canopyDelta,
    canopyExplode: CANOPY_EXPLODE,
    gearRetracted,
    gearDeployed: gearHolder,
    gearLight,
    landingLightMaterial,
    surfaces,
    gearSurfaces,
    plumes,
    plumeMaterial,
    labels,
    explodeNodes,
    dispose: () => {
      plumeGeometry.dispose()
      glowGeometry.dispose()
      plumeMaterial.dispose()
      disposeTree(root)
    },
  }
}

/** Matrix that maps a mesh's current world transform into the root's frame. */
function rootWorldToLocal(root: THREE.Object3D, node: THREE.Object3D): THREE.Matrix4 {
  root.updateMatrixWorld(true)
  node.updateMatrixWorld(true)
  return new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(node.matrixWorld)
}

/**
 * Finds the two nozzle exits on the tail: aft-most vertices below the
 * centreline, split left/right of the tail stinger.
 */
function findNozzles(mesh: THREE.Mesh): { positions: THREE.Vector3[]; radius: number } {
  const position = mesh.geometry.attributes.position
  const sums = [
    { x: 0, y: 0, z: 0, n: 0 },
    { x: 0, y: 0, z: 0, n: 0 },
  ]
  let maxZ = -Infinity
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    if (z > 4.3 && y < 0.05 && Math.abs(x) > 0.2 && Math.abs(x) < 1.1) {
      const side = x > 0 ? 0 : 1
      sums[side].x += x
      sums[side].y += y
      sums[side].z += z
      sums[side].n++
      if (z > maxZ) maxZ = z
    }
  }
  const positions = sums
    .filter((s) => s.n > 0)
    .map((s) => new THREE.Vector3(s.x / s.n, s.y / s.n, s.z / s.n))
  if (positions.length === 0) positions.push(new THREE.Vector3(0.6, -0.33, 4.5), new THREE.Vector3(-0.6, -0.33, 4.5))
  return { positions, radius: 0.24 }
}

/**
 * Open cone pointing aft (+Z) with a per-vertex ALPHA falloff (RGBA colour
 * attribute): bright at the nozzle, invisible at the tip. Normal blending on
 * purpose - additive blending on a transparent canvas composites dark
 * fragments as opaque black.
 */
function makePlumeGeometry(radius: number, length: number): THREE.ConeGeometry {
  const geo = new THREE.ConeGeometry(radius, length, 16, 1, true)
  const pos = geo.attributes.position
  const rgba = new Float32Array(pos.count * 4)
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + length / 2) / length, 0, 1)
    // blue-white near the nozzle, cooler and dimmer toward the tip
    rgba[i * 4] = 0.72 + 0.28 * t
    rgba[i * 4 + 1] = 0.84 + 0.16 * t
    rgba[i * 4 + 2] = 1
    rgba[i * 4 + 3] = Math.pow(1 - t, 1.25)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4))
  geo.rotateX(Math.PI / 2)
  geo.translate(0, 0, length / 2)
  return geo
}

function findLandingLightMaterial(root: THREE.Object3D | null): THREE.MeshStandardMaterial | null {
  let found: THREE.MeshStandardMaterial | null = null
  root?.traverse((child) => {
    const material = (child as THREE.Mesh).material
    if (material instanceof THREE.MeshStandardMaterial && material.name === 'SU-35-landinglights') {
      found = material
    }
  })
  return found
}

function disposeTree(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    list.forEach((material) => materials.add(material))
  })
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) value.dispose()
    })
    material.dispose()
  })
}
