import * as THREE from 'three'

/**
 * Glow shader for the hologram.
 *
 * Every line and every point runs through this material, which does what a
 * stock LineBasicMaterial cannot:
 *
 *   1. reveal - geometry above a world-space cut plane is discarded, and a
 *      bright band rides on the cut. Driving the plane from bottom to top
 *      "prints" an airframe in; driving it back down erases it. This is how a
 *      model enters and leaves the stage, so two airframes never overlap;
 *   2. scan response - elements near the sweeping ruler light up;
 *   3. a slow shimmer that drifts along the model;
 *   4. depth attenuation, so the far side sinks behind the near silhouette.
 *
 * Note: ShaderMaterial ignores `material.opacity`. Fading MUST go through
 * `uOpacity` (see setGlowOpacity) - an earlier version wrote `.opacity` and
 * the crossfades between airframes silently never happened.
 */

export interface GlowUniforms {
  uOpacity: { value: number }
  /** Extra brightness inside the scan band. */
  uGlow: { value: number }
  /** World-space Y of the scanning ruler. */
  uScanY: { value: number }
  /** Half-height of the scan band, world units. */
  uScanWidth: { value: number }
  /** World-space Y of the reveal cut; geometry above it is not drawn. */
  uCutY: { value: number }
  /** Strength of the bright band riding on the cut (0 when fully revealed). */
  uCutGlow: { value: number }
  /** World-space centre of the framed part (callout focus). */
  uFocusCenter: { value: THREE.Vector3 }
  /** Radius kept at full strength around the focus centre. */
  uFocusRadius: { value: number }
  /** 0..1 how much everything outside the focus sphere recedes. */
  uFocusDim: { value: number }
  uTime: { value: number }
  uColor: { value: THREE.Color }
  uSize?: { value: number }
}

export type GlowMaterial = THREE.ShaderMaterial & {
  /** The same object as `uniforms`, typed. */
  glow: GlowUniforms
  /** Base opacity the rig scales when fading a whole airframe. */
  baseOpacity: number
}

const VARYINGS = /* glsl */ `
  varying vec3 vWorld;
  varying float vDepth;
`

const LINE_VERTEX = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const POINT_VERTEX = /* glsl */ `
  ${VARYINGS}
  uniform float uSize;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * mv;
  }
`

/** Shared fragment logic: reveal cut + scan band + shimmer + depth fade. */
const FRAGMENT_HEAD = /* glsl */ `
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uScanY;
  uniform float uScanWidth;
  uniform float uCutY;
  uniform float uCutGlow;
  uniform vec3 uFocusCenter;
  uniform float uFocusRadius;
  uniform float uFocusDim;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vWorld;
  varying float vDepth;

  float hologramAmount(vec3 worldPos, float depth) {
    float worldY = worldPos.y;
    // Above the cut: not printed yet.
    if (worldY > uCutY) discard;
    // Bright edge just under the cut - the "print head".
    float edge = (1.0 - smoothstep(0.0, 0.16, uCutY - worldY)) * uCutGlow;
    float band = 1.0 - smoothstep(0.0, uScanWidth, abs(worldY - uScanY));
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.7 - worldY * 2.3);
    float depthFade = clamp(1.0 - (depth - 12.0) / 55.0, 0.45, 1.0);
    // Focus: the framed part keeps its strength, the rest of the airframe
    // recedes so the eye lands on the part the callout names.
    float away = smoothstep(uFocusRadius, uFocusRadius * 1.6 + 0.6, distance(worldPos, uFocusCenter));
    float isolate = 1.0 - uFocusDim * 0.82 * away;
    return (uOpacity * depthFade * (1.0 + uGlow * (band * 3.0 + shimmer * 0.16)) + edge * 0.55) * isolate;
  }
`

const LINE_FRAGMENT = /* glsl */ `
  ${FRAGMENT_HEAD}
  void main() {
    gl_FragColor = vec4(uColor, clamp(hologramAmount(vWorld, vDepth), 0.0, 1.0));
  }
`

const POINT_FRAGMENT = /* glsl */ `
  ${FRAGMENT_HEAD}
  uniform float uSize;
  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float radius = dot(offset, offset);
    if (radius > 0.25) discard;
    float soft = smoothstep(0.25, 0.02, radius);
    gl_FragColor = vec4(uColor, clamp(hologramAmount(vWorld, vDepth) * soft, 0.0, 1.0));
  }
`

/** Shape accepted by THREE.ShaderMaterial for its uniform map. */
type UniformMap = Record<string, { value: unknown }>

function baseUniforms(baseOpacity: number): GlowUniforms {
  return {
    uOpacity: { value: baseOpacity },
    uGlow: { value: 1 },
    uScanY: { value: 999 },
    uScanWidth: { value: 0.55 },
    uCutY: { value: 999 },
    uCutGlow: { value: 0 },
    uFocusCenter: { value: new THREE.Vector3() },
    uFocusRadius: { value: 1 },
    uFocusDim: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xffffff) },
  }
}

function build(baseOpacity: number, vertexShader: string, fragmentShader: string, size?: number): GlowMaterial {
  const uniforms = baseUniforms(baseOpacity)
  if (size !== undefined) uniforms.uSize = { value: size }
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as UniformMap,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  }) as GlowMaterial
  material.glow = uniforms
  material.baseOpacity = baseOpacity
  return material
}

/** White line material with reveal, scan glow and depth fade. */
export function createGlowLineMaterial(baseOpacity: number): GlowMaterial {
  return build(baseOpacity, LINE_VERTEX, LINE_FRAGMENT)
}

/** Round point sprite sharing the same behaviour. */
export function createGlowPointMaterial(baseOpacity: number, size: number): GlowMaterial {
  return build(baseOpacity, POINT_VERTEX, POINT_FRAGMENT, size)
}

export interface GlowFrame {
  time: number
  scanY: number
  scanWidth: number
  glow: number
  /** Multiplier on the material's base opacity. */
  opacity: number
  cutY: number
  cutGlow: number
  /** Callout focus: world centre, radius kept bright, 0..1 dimming of the rest. */
  focusCenter: THREE.Vector3
  focusRadius: number
  focusDim: number
}

/** Pushes the per-frame inputs (once per frame, per airframe). */
export function updateGlow(material: GlowMaterial, frame: GlowFrame) {
  const u = material.glow
  u.uTime.value = frame.time
  u.uScanY.value = frame.scanY
  u.uScanWidth.value = frame.scanWidth
  u.uGlow.value = frame.glow
  u.uOpacity.value = material.baseOpacity * frame.opacity
  u.uCutY.value = frame.cutY
  u.uCutGlow.value = frame.cutGlow
  u.uFocusCenter.value.copy(frame.focusCenter)
  u.uFocusRadius.value = frame.focusRadius
  u.uFocusDim.value = frame.focusDim
}
