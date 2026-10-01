import * as THREE from 'three'

export interface HologramScene {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Resize the drawing buffer to the canvas' CSS box. */
  resize(width: number, height: number): void
  dispose(): void
}

/**
 * Renderer + camera for the hologram.
 *
 * No lights and no tone mapping on purpose: every element is a flat white line
 * or a white point, so the only thing that shapes the image is line weight and
 * opacity. The canvas is transparent - the near-black backdrop and the grid are
 * static CSS, which keeps scrolling cheap.
 */
export function createHologramScene(canvas: HTMLCanvasElement): HologramScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400)
  camera.position.set(0, 6, 18)

  const resize = (width: number, height: number) => {
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const dispose = () => {
    // No forceContextLoss(): React StrictMode remounts reuse the same canvas.
    renderer.dispose()
  }

  return { renderer, scene, camera, resize, dispose }
}
