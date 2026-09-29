import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export interface JetScene {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Resize the drawing buffer to the canvas' CSS box. */
  resize(width: number, height: number): void
  dispose(): void
}

/** Cap the device pixel ratio - 3x panels burn GPU for no visible gain here. */
const MAX_PIXEL_RATIO = 1.75

/**
 * Creates the renderer, camera, lights and a PMREM environment for metallic
 * reflections. The canvas is transparent so the *static* CSS backdrop shows
 * through - only the aircraft moves, never the background.
 */
export function createJetScene(canvas: HTMLCanvasElement): JetScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  camera.position.set(6, 3, 8)

  // --- Lighting: a cool key, warm-ish fill from below, and a hard rim -----
  const hemi = new THREE.HemisphereLight(0xe6e9ef, 0x15161a, 0.9)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 8, 4)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xb8c0cf, 1.1)
  rim.position.set(-7, 2.5, -6)
  scene.add(rim)

  // --- Environment map: one-time PMREM bake, zero per-frame cost ----------
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTexture
  scene.environmentIntensity = 0.55
  pmrem.dispose()

  const resize = (width: number, height: number) => {
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // FOV stays fixed; portrait framing is handled by pulling the camera back
    // in applyRig() so perspective never looks distorted.
    camera.updateProjectionMatrix()
  }

  const dispose = () => {
    envTexture.dispose()
    // Note: no forceContextLoss() - React StrictMode remounts reuse the same
    // <canvas>, and a forcibly lost context would leave it black.
    renderer.dispose()
  }

  return { renderer, scene, camera, resize, dispose }
}
