import * as THREE from 'three'

/**
 * Glow shader for the hologram.
 *
 * Every line and every point runs through this material, which does three
 * things a stock LineBasicMaterial cannot:
 *
 *   1. scan response - elements within `uScanWidth` of the sweeping ruler
 *      light up, so the scan reads as energy travelling through the airframe;
 *   2. a slow shimmer that drifts along the model, keeping the wireframe alive
 *      when nothing else moves;
 *   3. depth attenuation, so the far side of the airframe sinks instead of
 *      competing with the near side.
 *
 * It is deliberately a shading trick rather than a bloom pass: a full-screen
 * blur on a transparent canvas both costs more and washes the blueprint look
 * out. The scan band is evaluated in WORLD space, which means the glow follows
 * the airframe when the camera orbits or the model spreads out.
 */

export interface GlowUniforms {
  uOpacity: { value: number }
  /** Extra brightness inside the scan band. */
  uGlow: { value: number }
  /** World-space Y of the scanning ruler. */
  uScanY: { value: number }
  /** Half-height of the scan band, world units. */
  uScanWidth: { value: number }
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

/** Varyings shared by every vertex stage. */
const VARYINGS = /* glsl */ `
  varying float vWorldY;
  varying float vDepth;
`

const LINE_VERTEX = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldY = world.y;
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
    vWorldY = world.y;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * mv;
  }
`

/** Shared tail of the fragment stage: scan band + shimmer + depth fade. */
const FRAGMENT_HEAD = /* glsl */ `
  uniform float uOpacity;
  uniform float uGlow;
  uniform float uScanY;
  uniform float uScanWidth;
  uniform float uTime;
  uniform vec3 uColor;
  varying float vWorldY;
  varying float vDepth;

  float hologramAmount(float worldY, float depth) {
    // Energy rising through the model as the ruler passes.
    float band = 1.0 - smoothstep(0.0, uScanWidth, abs(worldY - uScanY));
    // Slow travelling shimmer so the wire never looks frozen.
    float shimmer = 0.5 + 0.5 * sin(uTime * 1.7 - worldY * 2.3);
    // Far geometry sinks; the near silhouette stays crisp.
    float depthFade = clamp(1.0 - (depth - 12.0) / 55.0, 0.45, 1.0);
    return uOpacity * depthFade * (1.0 + uGlow * (band * 3.2 + shimmer * 0.16));
  }
`

const LINE_FRAGMENT = /* glsl */ `
  ${FRAGMENT_HEAD}
  void main() {
    gl_FragColor = vec4(uColor, clamp(hologramAmount(vWorldY, vDepth), 0.0, 1.0));
  }
`

const POINT_FRAGMENT = /* glsl */ `
  ${FRAGMENT_HEAD}
  uniform float uSize;
  void main() {
    // Soft round dot instead of the default square sprite.
    vec2 offset = gl_PointCoord - 0.5;
    float radius = dot(offset, offset);
    if (radius > 0.25) discard;
    float soft = smoothstep(0.25, 0.02, radius);
    gl_FragColor = vec4(uColor, clamp(hologramAmount(vWorldY, vDepth) * soft, 0.0, 1.0));
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
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xffffff) },
  }
}

/** White line material with a scan-reactive glow. */
export function createGlowLineMaterial(baseOpacity: number): GlowMaterial {
  const uniforms = baseUniforms(baseOpacity)
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as UniformMap,
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
  }) as GlowMaterial
  material.glow = uniforms
  material.baseOpacity = baseOpacity
  return material
}

/** Round point sprite sharing the same glow behaviour. */
export function createGlowPointMaterial(baseOpacity: number, size: number): GlowMaterial {
  const uniforms = baseUniforms(baseOpacity)
  uniforms.uSize = { value: size }
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as UniformMap,
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
  }) as GlowMaterial
  material.glow = uniforms
  material.baseOpacity = baseOpacity
  return material
}

/** Pushes the shared glow inputs (called once per frame, per airframe). */
export function updateGlow(material: GlowMaterial, time: number, scanY: number, width: number, glow: number) {
  material.glow.uTime.value = time
  material.glow.uScanY.value = scanY
  material.glow.uScanWidth.value = width
  material.glow.uGlow.value = glow
}
