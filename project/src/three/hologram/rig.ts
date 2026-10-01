import * as THREE from 'three'
import type { HologramModel } from './model'
import type { HologramOverlay } from './overlay'
import { updateGlow } from './materials'

/**
 * The rig is a flat object of numbers. Anime.js tweens THIS (cheap, no Three.js
 * setters involved) and `applyRig` pushes the values into the scene once per
 * rendered frame - the same pattern used for the camera and the mechanisms.
 *
 * Declared as a `type` (not an interface) so it satisfies Anime.js's
 * `Record<string, any>` target constraint via the implicit index signature.
 */
export type HologramRig = {
  // Camera orbit around the subject
  camAzimuth: number // radians around Y; 0 = behind the tail, PI = nose-on
  camElevation: number // radians above the horizon
  camDistance: number
  camTargetY: number
  camTargetZ: number
  camShiftX: number // screen-space: + moves the airframe right

  // Attitude of the airframe
  yaw: number
  pitch: number
  roll: number
  posY: number

  // Presence per airframe (0..1). At spread = 1 the three line up.
  rafale: number
  apache: number
  mq9: number
  spread: number

  // Mechanisms
  canopy: number // 0..1 canopy slid aft
  gear: number // 0..1 landing gear down
  rotor: number // rotor spin speed
  propeller: number // propeller spin speed
  sensor: number // sensor turret rotation amount
  explode: number // 0..1 exploded view

  // Graphics
  scan: number // 0..1 sweep position through the airframe
  labels: number // 0..1 annotation opacity
  overlay: number // 0..1 technical graphics opacity
  glow: number // overall line brightness

  // Focus: clicking an annotation dollies the camera onto that part
  focusActive: number // 0 = free orbit, 1 = looking at the focused part
  focusX: number
  focusY: number
  focusZ: number
  focusDistance: number
}

export const INITIAL_RIG: HologramRig = {
  camAzimuth: 2.55,
  camElevation: 0.26,
  camDistance: 16.5,
  camTargetY: -0.35,
  camTargetZ: 0,
  camShiftX: 0,

  yaw: -0.15,
  pitch: 0.03,
  roll: -0.07,
  posY: 0.1,

  rafale: 1,
  apache: 0,
  mq9: 0,
  spread: 0,

  canopy: 0,
  gear: 0,
  rotor: 0,
  propeller: 0,
  sensor: 0,
  explode: 0,

  scan: 0.2,
  labels: 0,
  overlay: 1,
  glow: 1,

  focusActive: 0,
  focusX: 0,
  focusY: 0,
  focusZ: 0,
  focusDistance: 8,
}

export interface StageModel {
  model: HologramModel
  overlay: HologramOverlay
}

/** Where each airframe sits when the exploded line-up is shown. */
const SPREAD_X: Record<string, number> = { rafale: -11.5, apache: 0, mq9: 11.5 }
const SPREAD_SCALE = 0.6

/** Rafale landing gear: two meshes, only one of them shown at a time. */
const GEAR_SWAP: Record<string, { up: string; down: string }> = {
  rafale: { up: 'gear-retracted', down: 'gear-deployed' },
}
const GEAR_SWITCH = 0.32

/** Canopy travel in canonical units (aft along +Z, slightly up). */
const CANOPY_TRAVEL = new THREE.Vector3(0, 0.32, 1.05)

const _target = new THREE.Vector3()
const _shift = new THREE.Vector3()
const _scanWorld = new THREE.Vector3()

/** Half-height of the scan glow band, in world units. */
const SCAN_BAND = 0.9

export interface ApplyOptions {
  /** Seconds since the stage started, for continuous motion. */
  time: number
  /** Seconds since the previous frame (rotation integration). */
  delta: number
}

/**
 * Push rig values into the scene graph. Continuous mechanisms (rotors, the
 * propeller, the scanning ruler) are integrated from `delta`, so they keep
 * moving between scroll positions instead of freezing.
 */
export function applyRig(stage: StageModel[], rig: HologramRig, camera: THREE.PerspectiveCamera, options: ApplyOptions) {
  const { time, delta } = options

  for (const { model, overlay } of stage) {
    const presence = rig[model.id as 'rafale' | 'apache' | 'mq9'] ?? 0
    const active = presence > 0.01
    model.root.visible = active
    overlay.group.visible = active && rig.overlay > 0.02
    if (!active) continue

    // --- placement ---------------------------------------------------------
    const spread = rig.spread
    model.root.position.x = (SPREAD_X[model.id] ?? 0) * spread
    const scale = 1 + (SPREAD_SCALE - 1) * spread
    model.root.scale.setScalar(scale)

    // --- attitude ----------------------------------------------------------
    model.stage.rotation.order = 'YXZ'
    model.stage.rotation.set(
      rig.pitch + Math.sin(time * 0.31 + model.root.position.x) * 0.012,
      rig.yaw + spread * time * 0.05,
      rig.roll,
    )
    model.stage.position.y = rig.posY + Math.sin(time * 0.8) * 0.04

    // --- fade --------------------------------------------------------------
    const brightness = presence * rig.glow * (0.55 + 0.45 * rig.overlay)
    for (const layer of model.fade) layer.material.opacity = layer.base * brightness
    for (const layer of overlay.fade) layer.material.opacity = layer.base * presence * rig.overlay * rig.glow

    // --- exploded view + mechanisms ---------------------------------------
    for (const part of model.parts) {
      part.object.position.copy(part.rest).addScaledVector(part.explode, rig.explode)
    }

    const canopy = model.parts.find((part) => part.name === 'canopy')
    if (canopy) canopy.object.position.addScaledVector(CANOPY_TRAVEL, rig.canopy)

    const gear = GEAR_SWAP[model.id]
    if (gear) {
      const down = rig.gear >= GEAR_SWITCH
      const up = model.parts.find((part) => part.name === gear.up)
      const deployed = model.parts.find((part) => part.name === gear.down)
      if (up) up.object.visible = !down
      if (deployed) deployed.object.visible = down
    }

    for (const spin of model.spins) {
      const speed = rig[spin.key as keyof HologramRig] as number
      spin.pivot.rotation[spin.axis] += delta * spin.speed * speed
    }

    // --- rotation indicator + scan ----------------------------------------
    const primary = model.spins[0]
    if (overlay.ring && primary) {
      const speed = rig[primary.key as keyof HologramRig] as number
      overlay.ring.rotation.z += delta * primary.speed * speed * 0.6
    }

    // The scan runs bottom-to-top through the airframe, on the line-up too.
    const scanT = THREE.MathUtils.clamp(rig.scan, 0, 1)
    const halfY = model.size.y * 0.5 * scale
    overlay.scan.position.y = THREE.MathUtils.lerp(-halfY - 1.1, halfY + 1.1, scanT)

    // --- glow: hand every shader the ruler's current world height ----------
    model.root.updateMatrixWorld(true)
    overlay.scan.getWorldPosition(_scanWorld)
    const intensity = rig.glow * presence
    for (const material of model.glowMaterials) {
      updateGlow(material, time, _scanWorld.y, SCAN_BAND, intensity)
    }
    for (const material of overlay.glowMaterials) {
      updateGlow(material, time, _scanWorld.y, SCAN_BAND, intensity * 0.8)
    }
  }

  // --- camera --------------------------------------------------------------
  const focus = THREE.MathUtils.clamp(rig.focusActive * (1 - rig.spread), 0, 1)
  const aspect = camera.aspect
  const fit = THREE.MathUtils.clamp(1.45 / aspect, 1, 2.6)
  const wide = THREE.MathUtils.smoothstep(aspect, 0.8, 1.2)
  const distance = THREE.MathUtils.lerp(
    rig.camDistance * fit * (1 + 0.35 * rig.spread),
    rig.focusDistance * fit,
    focus,
  )
  const shiftX = rig.camShiftX * wide * (1 - rig.spread) * (1 - focus)
  const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const baseTargetY = rig.camTargetY - (1 - wide) * 0.14 * visibleHeight
  const targetY = THREE.MathUtils.lerp(baseTargetY, rig.focusY, focus)
  const targetZ = THREE.MathUtils.lerp(rig.camTargetZ, rig.focusZ, focus)
  const elevation = rig.camElevation + focus * 0.14

  _target.set(rig.focusX * focus, targetY, targetZ)
  const cosEl = Math.cos(elevation)
  camera.position.set(
    _target.x + Math.sin(rig.camAzimuth) * cosEl * distance,
    _target.y + Math.sin(elevation) * distance,
    _target.z + Math.cos(rig.camAzimuth) * cosEl * distance,
  )

  // Screen-space horizontal shift: slide camera and target along the camera's
  // right vector so the airframe moves sideways without re-aiming.
  _shift.set(Math.cos(rig.camAzimuth), 0, -Math.sin(rig.camAzimuth)).multiplyScalar(-shiftX)
  camera.position.add(_shift)
  _target.add(_shift)
  camera.lookAt(_target)
}

/** World position of an annotation anchor (follows explode and spin). */
export function anchorPosition(model: HologramModel, part: HologramPartLike, out: THREE.Vector3): THREE.Vector3 {
  out.copy(part.center)
  const offset = part.object.position.clone().sub(part.rest)
  out.add(offset)
  return out.applyMatrix4(model.stage.matrixWorld)
}

/** Minimal shape anchorPosition needs, so callers can pass a plain object. */
export interface HologramPartLike {
  center: THREE.Vector3
  rest: THREE.Vector3
  object: THREE.Object3D
}
