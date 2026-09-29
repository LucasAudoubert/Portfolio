import * as THREE from 'three'
import type { JetModel } from './loadSu35'

/**
 * The "rig" is a plain object of numbers. Anime.js tweens THIS object (cheap,
 * no Three.js setters involved) and `applyRig` maps the values onto the scene
 * once per rendered frame.
 *
 * Declared as a `type` (not `interface`) so it satisfies Anime.js's
 * `Record<string, any>` target constraint via the implicit index signature.
 */
export type JetRig = {
  // Aircraft attitude (radians) and offset
  yaw: number
  pitch: number
  roll: number
  posY: number

  // Camera orbit around the aircraft
  camAzimuth: number // radians around Y; 0 = behind the tail, PI = nose-on
  camElevation: number // radians above the horizon
  camDistance: number
  camTargetY: number // look-at offset
  camTargetZ: number
  camShiftX: number // screen-space: + moves the aircraft right, leaving room for copy on the left

  // Mechanisms
  canopy: number // 0 = closed, 1 = slid fully aft
  gear: number // 0 = retracted, 1 = down and locked
  leFlap: number // 0..1 leading-edge flap droop
  flap: number // 0..1 flaperon droop
  stab: number // -1..1 stabilator, + = trailing edge down
  rudder: number // -1..1 rudder, + = trailing edge right
  flex: number // 0..1 wing aeroelastic bend
  explode: number // 0..1 exploded view
  afterburner: number // 0..1 plume length & brightness
}

export const INITIAL_RIG: JetRig = {
  yaw: 0,
  pitch: 0.04,
  roll: -0.12,
  posY: 0,

  camAzimuth: 2.35,
  camElevation: 0.3,
  camDistance: 19.5,
  camTargetY: -1.55,
  camTargetZ: 0,
  camShiftX: 0,

  canopy: 0,
  gear: 0,
  leFlap: 0,
  flap: 0,
  stab: 0,
  rudder: 0,
  flex: 0,
  explode: 0,
  afterburner: 0.15,
}

/** Gear legs swing down between these rig values. */
const GEAR_SWING_START = 0.3
const GEAR_SWING_END = 0.95

// Scratch objects reused every frame to avoid garbage
const _target = new THREE.Vector3()
const _shift = new THREE.Vector3()

/**
 * Push rig values into the scene graph. `idle` is a small time-based offset
 * (hover bob, plume flicker) layered on top so the jet never feels frozen
 * between scrolls.
 */
export function applyRig(
  model: JetModel,
  rig: JetRig,
  camera: THREE.PerspectiveCamera,
  idle: { bob: number; sway: number; pulse: number },
) {
  const { root } = model

  // Attitude - Euler order YXZ = yaw, then pitch, then roll (aircraft-friendly)
  root.rotation.order = 'YXZ'
  root.rotation.set(rig.pitch + idle.sway * 0.5, rig.yaw, rig.roll + idle.sway)
  root.position.y = rig.posY + idle.bob

  // --- control surfaces, wing flex and the exploded view ------------------
  // (a single pass over the airframe's vertex data; skipped when unchanged)
  model.surfaces.apply({
    leFlap: rig.leFlap,
    flap: rig.flap,
    stab: rig.stab,
    rudder: rig.rudder,
    flex: rig.flex,
    explode: rig.explode,
  })

  // --- landing gear: doors open, then the legs swing down -----------------
  const airborne = rig.gear < GEAR_SWING_START
  model.gearRetracted.visible = airborne
  model.gearDeployed.visible = !airborne
  const deploy = THREE.MathUtils.smoothstep(rig.gear, GEAR_SWING_START, GEAR_SWING_END)
  model.gearSurfaces.apply({ gearRetract: 1 - deploy, explode: 0 })
  if (model.gearLight) model.gearLight.visible = rig.gear > GEAR_SWING_START
  if (model.landingLightMaterial) {
    model.landingLightMaterial.emissiveIntensity = 0.1 + rig.gear * 2.9
  }

  // --- canopy: slide aft along the rails (+ exploded offset) --------------
  const canopyK = THREE.MathUtils.smoothstep(rig.canopy, 0, 1)
  model.canopy.position
    .copy(model.canopyRest)
    .addScaledVector(model.canopyDelta, canopyK)
    .addScaledVector(model.canopyExplode, rig.explode)

  // --- whole-node parts that move apart in the exploded view -------------
  for (const part of model.explodeNodes) {
    part.node.position.copy(part.rest).addScaledVector(part.offset, rig.explode)
  }

  // --- afterburners -------------------------------------------------------
  const flame = rig.afterburner * (0.85 + idle.pulse * 0.3)
  model.plumeMaterial.opacity = flame * 0.95
  for (const plume of model.plumes) {
    plume.visible = flame > 0.02
    plume.scale.set(0.72 + flame * 0.36, 0.72 + flame * 0.36, 0.22 + flame * 1.25)
  }

  // --- label anchors that follow the exploded view -----------------------
  for (const label of model.labels) {
    if (!label.rest || !label.offset) continue
    label.marker.position.copy(label.rest).addScaledVector(label.offset, rig.explode)
  }

  // --- Responsive framing ------------------------------------------------
  // Portrait viewports can't fit a 10-unit airframe at the authored distance.
  // Pull the camera back (keeps perspective natural, unlike widening the FOV),
  // fade out the side shift (copy sits below the jet on phones) and lift the
  // aircraft toward the top of the screen.
  const aspect = camera.aspect
  const fit = THREE.MathUtils.clamp(1.45 / aspect, 1, 2.6)
  const wide = THREE.MathUtils.smoothstep(aspect, 0.8, 1.2) // 0 = portrait, 1 = landscape
  const distance = rig.camDistance * fit
  const shiftX = rig.camShiftX * wide
  const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const targetY = rig.camTargetY - (1 - wide) * 0.14 * visibleHeight

  // Camera orbit around the look-at point
  _target.set(0, targetY, rig.camTargetZ)
  const cosEl = Math.cos(rig.camElevation)
  camera.position.set(
    _target.x + Math.sin(rig.camAzimuth) * cosEl * distance,
    _target.y + Math.sin(rig.camElevation) * distance,
    _target.z + Math.cos(rig.camAzimuth) * cosEl * distance,
  )

  // Screen-space horizontal shift: slide camera AND target along the camera's
  // right vector so the aircraft moves sideways in frame without re-aiming.
  // right = (cos az, 0, -sin az) for a camera orbiting at azimuth `az`.
  _shift.set(Math.cos(rig.camAzimuth), 0, -Math.sin(rig.camAzimuth)).multiplyScalar(-shiftX)
  camera.position.add(_shift)
  _target.add(_shift)
  camera.lookAt(_target)
}
