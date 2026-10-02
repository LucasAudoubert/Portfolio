import * as THREE from 'three'
import { partExplode, type HologramModel, type HologramPart } from './model'
import type { HologramOverlay } from './overlay'
import { updateGlow, type GlowFrame } from './materials'

/**
 * The rig is a flat object of numbers. Anime.js tweens THIS (cheap, no Three.js
 * setters involved) and `applyRig` pushes the values into the scene once per
 * rendered frame.
 *
 * Declared as a `type` (not an interface) so it satisfies Anime.js's
 * `Record<string, any>` target constraint via the implicit index signature.
 */
export type HologramRig = {
  // Camera orbit around the subject
  camAzimuth: number // radians around Y; 0 = behind the tail, PI = nose-on
  camElevation: number
  camDistance: number
  camTargetY: number
  camTargetZ: number
  camShiftX: number // screen-space: + moves the airframe right
  /** Portrait screens only: lifts the airframe above a bottom-docked panel (0 = centred). */
  mobileLift: number

  // Attitude of the airframe
  yaw: number
  pitch: number
  roll: number
  posY: number

  // Reveal per airframe (0 = not printed, 1 = fully on stage). The sequence
  // never lets two of them be above 0 at the same time.
  rafale: number
  apache: number
  mq9: number

  // Mechanisms
  canopy: number
  gear: number
  rotor: number
  propeller: number
  sensor: number
  explode: number

  // Graphics
  scan: number // 0..1 sweep position through the airframe
  labels: number // 0..1 callouts drawn (staggered, one after another)
  overlay: number // 0..1 technical graphics opacity
  glow: number

  // Focus: clicking a callout dollies the camera onto that part
  focusActive: number
  focusX: number
  focusY: number
  focusZ: number
  focusDistance: number
  /** Radius of the framed part; everything beyond it recedes while focused. */
  focusRadius: number
}

export const INITIAL_RIG: HologramRig = {
  camAzimuth: 2.55,
  camElevation: 0.26,
  camDistance: 16.5,
  camTargetY: -0.35,
  camTargetZ: 0,
  camShiftX: 0,
  mobileLift: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
  posY: 0,
  rafale: 1,
  apache: 0,
  mq9: 0,
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
  focusRadius: 1,
}

export interface StageModel {
  model: HologramModel
  overlay: HologramOverlay
}

/** Rafale landing gear: two meshes, only one of them shown at a time. */
const GEAR_SWAP: Record<string, { up: string; down: string }> = {
  rafale: { up: 'gear-retracted', down: 'gear-deployed' },
}
const GEAR_SWITCH = 0.32

/** Canopy travel in canonical units (aft along +Z, slightly up). */
const CANOPY_TRAVEL = new THREE.Vector3(0, 0.32, 1.05)

/** Half-height of the scan glow band, in world units. */
const SCAN_BAND = 0.9

const _target = new THREE.Vector3()
const _shift = new THREE.Vector3()
const _scanWorld = new THREE.Vector3()
const _offset = new THREE.Vector3()
const frame: GlowFrame = {
  time: 0,
  scanY: 0,
  scanWidth: SCAN_BAND,
  glow: 1,
  opacity: 1,
  cutY: 999,
  cutGlow: 0,
  focusCenter: new THREE.Vector3(),
  focusRadius: 1,
  focusDim: 0,
}

export interface ApplyOptions {
  /** Seconds since the stage started, for continuous motion. */
  time: number
  /** Seconds since the previous frame (rotation integration). */
  delta: number
  /** 0..1 one-off intro: multiplies every reveal on first load. */
  boot: number
}

/** Reveal of one airframe, combined with the boot intro. */
export function revealOf(rig: HologramRig, id: string, boot: number): number {
  return THREE.MathUtils.clamp((rig[id as 'rafale'] ?? 0) * boot, 0, 1)
}

export function applyRig(stage: StageModel[], rig: HologramRig, camera: THREE.PerspectiveCamera, options: ApplyOptions) {
  const { time, delta, boot } = options

  for (const { model, overlay } of stage) {
    const reveal = revealOf(rig, model.id, boot)
    const active = reveal > 0.002
    model.root.visible = active
    overlay.group.visible = active && rig.overlay > 0.02
    if (!active) continue

    // --- attitude ----------------------------------------------------------
    model.stage.rotation.order = 'YXZ'
    model.stage.rotation.set(rig.pitch + Math.sin(time * 0.31) * 0.01, rig.yaw, rig.roll)
    model.stage.position.y = rig.posY + Math.sin(time * 0.8) * 0.035

    // --- exploded view -----------------------------------------------------
    for (const part of model.parts) {
      if (part.spin) continue // moved through its hub below
      const k = partExplode(part, rig.explode)
      part.object.position.copy(part.rest).addScaledVector(part.explode, k)
      part.current.copy(part.center).addScaledVector(part.explode, k)
    }

    const canopy = model.parts.find((part) => part.name === 'canopy')
    if (canopy) {
      const slide = THREE.MathUtils.smoothstep(rig.canopy, 0, 1)
      canopy.object.position.addScaledVector(CANOPY_TRAVEL, slide)
      canopy.current.addScaledVector(CANOPY_TRAVEL, slide)
    }

    const gear = GEAR_SWAP[model.id]
    if (gear) {
      const down = rig.gear >= GEAR_SWITCH || rig.explode > 0.05
      const up = model.parts.find((part) => part.name === gear.up)
      const deployed = model.parts.find((part) => part.name === gear.down)
      if (up) up.object.visible = !down
      if (deployed) deployed.object.visible = down
    }

    // --- spinning groups: the hub carries its parts ------------------------
    for (const spin of model.spins) {
      const hub = model.parts.find((part) => part.spin === spin && part.center.equals(spin.center))
      const k = hub ? partExplode(hub, rig.explode) : rig.explode
      spin.pivot.position.copy(spin.rest).addScaledVector(spin.explode, k)
      const speed = rig[spin.key as keyof HologramRig] as number
      spin.pivot.rotation[spin.axis] += delta * spin.speed * speed
      _offset.copy(spin.explode).multiplyScalar(k)
      for (const part of model.parts) {
        if (part.spin === spin) part.current.copy(part.center).add(_offset)
      }
    }

    // --- rotation indicator rides on the primary hub ------------------------
    const primary = model.spins[0]
    if (overlay.ring && primary) {
      overlay.ring.position.copy(primary.pivot.position)
      const spinner = overlay.ring.getObjectByName('spinner')
      const speed = rig[primary.key as keyof HologramRig] as number
      if (spinner) spinner.rotation.z -= delta * Math.min(primary.speed, 3) * speed * 0.35
    }

    overlay.updateTraces(rig.explode * rig.overlay)

    // --- scan ruler ----------------------------------------------------------
    const scanT = THREE.MathUtils.clamp(rig.scan, 0, 1)
    overlay.scan.position.y = THREE.MathUtils.lerp(model.bounds.min.y - 1.1, model.bounds.max.y + 1.1, scanT)

    // --- glow + reveal cut ---------------------------------------------------
    model.root.updateMatrixWorld(true)
    overlay.scan.getWorldPosition(_scanWorld)
    const base = model.stage.position.y
    const low = base + model.bounds.min.y - model.reach.down * rig.explode - 0.4
    const high = base + model.bounds.max.y + model.reach.up * rig.explode + 0.4
    frame.time = time
    frame.scanY = _scanWorld.y
    frame.cutY = reveal >= 0.999 ? 999 : THREE.MathUtils.lerp(low, high, reveal)
    frame.cutGlow = reveal >= 0.999 ? 0 : THREE.MathUtils.smoothstep(reveal, 0, 0.06)
    frame.opacity = 0.35 + 0.65 * THREE.MathUtils.smoothstep(reveal, 0, 0.5)
    frame.glow = rig.glow
    frame.focusCenter.set(rig.focusX, rig.focusY, rig.focusZ)
    frame.focusRadius = rig.focusRadius
    frame.focusDim = THREE.MathUtils.smoothstep(rig.focusActive, 0, 1)
    for (const material of model.glowMaterials) updateGlow(material, frame)

    const overlayOpacity = frame.opacity * rig.overlay
    frame.glow = rig.glow * 0.8
    frame.opacity = overlayOpacity
    for (const material of overlay.glowMaterials) updateGlow(material, frame)
  }

  // --- camera --------------------------------------------------------------
  const focus = THREE.MathUtils.clamp(rig.focusActive, 0, 1)
  const aspect = camera.aspect
  const fit = THREE.MathUtils.clamp(1.45 / aspect, 1, 2.6)
  const wide = THREE.MathUtils.smoothstep(aspect, 0.8, 1.2)
  const baseDistance = rig.camDistance * fit
  const distance = THREE.MathUtils.lerp(baseDistance, rig.focusDistance * fit, focus)
  // camShiftX is in world units at the pose's distance. Scaling it with the
  // distance keeps the same *screen* offset while the camera dollies in, so
  // the framed part stays in the free zone beside the copy instead of being
  // thrown off the edge of the viewport (a fixed world shift triples on screen
  // at a third of the distance).
  const shiftX = rig.camShiftX * wide * (distance / Math.max(baseDistance, 1e-3)) * (1 + 0.15 * focus)
  const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const baseTargetY = rig.camTargetY - (1 - wide) * 0.14 * rig.mobileLift * visibleHeight
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

/** World position of a part's current centre (follows explode and spin). */
export function partWorld(model: HologramModel, part: HologramPart, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(part.current).applyMatrix4(model.stage.matrixWorld)
}
