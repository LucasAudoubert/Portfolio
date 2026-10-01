/**
 * Dev-only model inspector (served by Vite at /inspector.html).
 *
 * Purpose: look at a raw GLB before it is wired into the portfolio -
 * identify parts, check orientation, triangle density and bounds.
 *
 * Query params:
 *   model=rafale.glb          file in /models
 *   view=paint|wire|solid     per-part colours (default) / wireframe / shaded
 *   show=a,b,c                isolate parts by name (substring, case-insensitive)
 *   hide=a,b,c                hide parts by name
 *   edges=24                  overlay structural edges with this threshold (deg)
 *   az=0.8&el=0.3&dist=1.9    camera (radians, radians, model lengths)
 *   grid=0&axes=0
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const params = new URLSearchParams(location.search)
const modelFile = params.get('model') ?? 'rafale.glb'
const view = params.get('view') ?? 'paint'
const list = (key) =>
  (params.get(key) ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
const only = list('show')
const hidden = list('hide')
const edgesDeg = Number(params.get('edges') ?? 0)
const az = Number(params.get('az') ?? 0.9)
const el = Number(params.get('el') ?? 0.28)
const dist = Number(params.get('dist') ?? 1.9)
const targetLength = Number(params.get('len') ?? 10)
const showGrid = params.get('grid') !== '0'
const showAxes = params.get('axes') === '1'

const legend = document.getElementById('legend')!
const hud = document.getElementById('hud')!
const errBox = document.getElementById('err')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(1)
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.setClearColor(0x0b0c0e, 1)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 5000)

scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.6))
const key = new THREE.DirectionalLight(0xffffff, 2.2)
key.position.set(4, 7, 5)
scene.add(key)

const grid = new THREE.GridHelper(40, 40, 0x2a2d33, 0x1b1d21)
grid.visible = showGrid
scene.add(grid)
const axes = new THREE.AxesHelper(6)
axes.visible = showAxes
scene.add(axes)

const palette = [0xff6b6b, 0x6bd3ff, 0x8dff6b, 0xffd166, 0xc792ff, 0xff9f6b, 0x6bffd0, 0x9aa1ac, 0x4fa3ff, 0xf0f0f0]

/** Wrapper nodes that carry no semantic meaning in Sketchfab exports. */
const WRAPPER = /^(root|GLTF_SceneRootNode|Sketchfab_model|Scene|.*_Scene)$/

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

loader.load(
  `/models/${modelFile}`,
  (gltf) => {
    const model = gltf.scene

    // --- normalize: centre, scale longest side to `targetLength` -----------
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    model.scale.setScalar(targetLength / Math.max(size.x, size.y, size.z))
    model.updateMatrixWorld(true)
    box.setFromObject(model)
    model.position.sub(box.getCenter(new THREE.Vector3()))
    model.updateMatrixWorld(true)

    // --- group meshes into "parts" -----------------------------------------
    const partOf = (mesh: THREE.Mesh): string => {
      const chain: THREE.Object3D[] = []
      for (let node: THREE.Object3D | null = mesh; node && node !== model; node = node.parent) {
        chain.unshift(node)
      }
      let i = 0
      while (i < chain.length - 1) {
        const node = chain[i]
        const isWrapper = WRAPPER.test(node.name)
        const isOnlyChild = node.parent !== null && node.parent.children.length === 1
        const hasMesh = !!(node as THREE.Mesh).isMesh
        if ((isWrapper || isOnlyChild) && !hasMesh) i++
        else break
      }
      return chain[i]?.name || mesh.name || 'unnamed'
    }

    const parts = new Map<string, { tris: number; box: THREE.Box3; meshes: THREE.Mesh[] }>()
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const name = partOf(mesh)
      let entry = parts.get(name)
      if (!entry) {
        entry = { tris: 0, box: new THREE.Box3(), meshes: [] }
        parts.set(name, entry)
      }
      entry.tris += mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3
      entry.box.union(new THREE.Box3().setFromObject(mesh))
      entry.meshes.push(mesh)
    })

    // --- colour / visibility ------------------------------------------------
    const rows: string[] = []
    let index = 0
    for (const [name, entry] of [...parts.entries()].sort((a, b) => b[1].tris - a[1].tris)) {
      const lower = name.toLowerCase()
      const isolated = only.length > 0 && !only.some((s) => lower.includes(s))
      const isHidden = hidden.some((s) => lower.includes(s))
      const color = palette[index++ % palette.length]

      for (const mesh of entry.meshes) {
        mesh.visible = !isolated && !isHidden
        if (view === 'wire') {
          mesh.material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
        } else if (view === 'paint') {
          mesh.material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, metalness: 0.1 })
        } else {
          mesh.material = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.45, metalness: 0.35 })
        }
        if (edgesDeg > 0) {
          const lines = new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, edgesDeg),
            new THREE.LineBasicMaterial({ color: view === 'wire' ? 0xffffff : 0x000000, transparent: true, opacity: view === 'wire' ? 0.85 : 0.4 }),
          )
          mesh.add(lines) // identity local transform: inherits the mesh's matrix
        }
      }

      const s = entry.box.getSize(new THREE.Vector3())
      const dim = isolated || isHidden ? ' class="row dark"' : ' class="row"'
      rows.push(
        `<div${dim}><span class="swatch" style="background:#${color.toString(16).padStart(6, '0')}"></span><span class="label">${name}</span><span>${Math.round(entry.tris)} tris</span><span>${s.x.toFixed(1)}x${s.y.toFixed(1)}x${s.z.toFixed(1)}</span></div>`,
      )
    }

    scene.add(model)

    const total = [...parts.values()].reduce((sum, p) => sum + p.tris, 0)
    legend.innerHTML = `<b>${modelFile} - ${Math.round(total)} tris - ${parts.size} parts</b>${rows.join('')}`

    // --- camera -------------------------------------------------------------
    const all = new THREE.Box3().setFromObject(model)
    const c = all.getCenter(new THREE.Vector3())
    const d = Math.max(all.getSize(new THREE.Vector3()).length(), targetLength) * dist
    camera.position.set(
      c.x + Math.sin(az) * Math.cos(el) * d,
      c.y + Math.sin(el) * d,
      c.z + Math.cos(az) * Math.cos(el) * d,
    )
    camera.lookAt(c)
    hud.textContent = `${modelFile}  az=${az} el=${el} dist=${dist}\nbounds ${all.min.toArray().map((v) => v.toFixed(2))} -> ${all.max.toArray().map((v) => v.toFixed(2))}`
    renderer.render(scene, camera)
    ;(window as unknown as Record<string, unknown>).__ready = true
  },
  undefined,
  (error) => {
    errBox.textContent = String(error)
    ;(window as unknown as Record<string, unknown>).__ready = 'error'
  },
)

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
})
