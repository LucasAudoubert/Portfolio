/**
 * Model preparation pipeline.
 *
 * Turns the raw Sketchfab/OBJ assets in `public/models` into small, canonical
 * GLBs that the portfolio can load without any runtime fix-up:
 *
 *   raw asset            this script                          runtime
 *   ---------            -----------                          -------
 *   textures + PBR  ->   stripped (a wireframe needs no surface)
 *   object numbers  ->   semantic part names (airframe, rotor, canopy...)
 *   mixed axes      ->   nose -Z / up +Y, 10 units long, centred on origin
 *   node transforms ->   baked into the vertices, flat identity hierarchy
 *   dense mesh      ->   welded + simplified to a triangle budget
 *   ~3-6 MB         ->   POSITION-only, quantised + meshopt (~100-250 kB)
 *
 * Parts the runtime animates but that ship welded into a bigger mesh (the
 * Apache's rotor blades, for instance) are carved out here, so the runtime
 * never has to touch vertex data.
 *
 * Usage:  npm run models           (writes into public/models)
 *         npm run models -- --report   (stats only, no writing)
 */
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { clearNodeParent, dedup, meshopt, prune, quantize, simplify, transformMesh, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const REPORT_ONLY = process.argv.includes('--report')
const ROOT = resolve(import.meta.dirname, '..')

/** Canonical frame every model is baked into: nose -Z, up +Y, this long. */
const TARGET_LENGTH = 10

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

const MODELS = [
  {
    id: 'rafale',
    src: 'assets/models-src/dassault_rafale_m_-_fighter_jet_-_free.glb',
    out: 'public/models/rafale.glb',
    /** Source axes: nose along +X, up +Y. */
    forward: '+x',
    /** Triangle budget in the output; 0 keeps the source density. */
    budget: 24000,
    /** Source node name -> part name in the output. */
    rename: {
      'Rafale-airframe_0': 'airframe',
      'Rafale-canopy_1': 'canopy',
      'Rafale-cockpit_2': 'cockpit',
      'Rafale-hud_3': 'hud',
      'Rafale-instrGlass_4': 'instrument-glass',
      'Rafale-landingOff_5': 'gear-retracted',
      'Rafale-landingOn_6': 'gear-deployed',
      'Rafale-landingOnLight_7': 'landing-light',
      'Rafale-Rails_8': 'rails',
      'Rafale-Pods_9': 'pods',
    },
    /**
     * The wings, fin, nozzles and radome are welded into a single airframe
     * mesh. Carved out here so the exploded view can address them - cuts are
     * ordered, each one takes its region out of what is left of `airframe`.
     * Frame: nose -Z, span X (|x| max 3.44), up +Y (y -0.9..2.0).
     */
    splits: [
      { from: 'airframe', into: 'radome', within: (_x, _y, z) => z < -3.55 },
      { from: 'airframe', into: 'wing-right', within: (x, _y, z) => x > 1.6 && z > -2.4 },
      { from: 'airframe', into: 'wing-left', within: (x, _y, z) => x < -1.6 && z > -2.4 },
      // Fin first: it sits above the engine deck, inside the same z slice.
      { from: 'airframe', into: 'fin', within: (_x, y, z) => z > 3.2 && y > 0.5 },
      { from: 'airframe', into: 'engines', within: (_x, _y, z) => z > 3.2 },
    ],
  },
  {
    id: 'apache',
    src: 'assets/models-src/boeing_ah-64d_apache_combat_helicopter.glb',
    out: 'public/models/apache.glb',
    forward: '+x',
    budget: 0, // low-poly and clean already; simplification would eat the blades
    /** The export only numbers its nodes, so the material is the stable key. */
    renameByMaterial: {
      'mat_0-Decal.jpg': 'decals',
      'mat_1-Glass.jpg': 'canopy-glass',
      'mat_2-Alpha.jpg': 'detail',
      'mat_3-Alpha_2.jpg': 'pylons',
      'mat_4-Missile_1.jpg': 'weapons',
      // One material, three assemblies: launcher racks (below), cockpit
      // interior (middle) and the Longbow mast radar (top). Split below.
      'mat_5-Main_Body_1.jpg': 'launchers',
      'mat_6-Main_Body_2.jpg': 'airframe',
    },
    /**
     * Canonical frame: nose -Z, mast axis at x = 0, z = -1.05.
     *
     * The FOUR main rotor blades are welded into the airframe mesh:
     *   - the lateral pair runs along X and droops, tips well below the hub
     *     (the fuselage and stub wings never pass |x| 1.4 above y 0.3);
     *   - the fore/aft pair runs along Z inside the fuselage footprint, in a
     *     thin band (|x| < 0.2, y 0.5..0.8) where nothing else lives once the
     *     tail (z > 3.1) and the mast base are excluded;
     *   - hub/mast head: a short vertical cylinder around the mast axis.
     * The four-blade tail rotor sits on the left of the fin (x < -0.33),
     * centred near y 0.32, z 4.22; the stabilator below it is excluded by y.
     */
    splits: [
      {
        from: 'airframe',
        into: 'rotor',
        within: (x, y, z, _nx, ny) => {
          if (y > 0.3 && Math.abs(x) > 1.5) return true
          if (y > 0.3 && Math.abs(x) > 1.25 && Math.abs(ny) > 0.55) return true
          if (Math.abs(x) < 0.2 && y > 0.5 && y < 0.8 && z < 3.1 && Math.abs(z + 1.05) > 0.45) return true
          return y > 0.6 && Math.hypot(x, z + 1.05) < 0.9
        },
      },
      {
        from: 'airframe',
        into: 'tail-rotor',
        within: (x, y, z) => x < -0.33 && z > 3.5 && y > -0.35 && Math.hypot(y - 0.32, z - 4.22) < 0.78,
      },
      { from: 'launchers', into: 'mast-radar', within: (_x, y) => y > 0.7 },
      { from: 'launchers', into: 'cockpit', within: (x, y) => y > -0.42 && Math.abs(x) < 0.45 },
    ],
  },
  {
    id: 'mq9',
    src: 'assets/models-src/MQ-9.obj',
    out: 'public/models/mq9.glb',
    /**
     * Source axes: nose along -X, up +Y, wings along Z. (The ailerons are
     * long along Z and the propeller disc lies in the YZ plane - an earlier
     * '+z' guess baked the drone sideways.)
     */
    forward: '-x',
    budget: 26000,
    /** OBJ group names are already semantic; the runner kebab-cases them. */
    rename: {},
  },
]

// ---------------------------------------------------------------------------
// OBJ -> Document
// ---------------------------------------------------------------------------

/** Parses a Wavefront OBJ (positions + triangles, grouped) into a Document. */
function objToDocument(text, name) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const positions = []
  const groups = new Map()
  let current = 'default'

  const addTriangle = (group, a, b, c) => {
    let list = groups.get(group)
    if (!list) groups.set(group, (list = []))
    list.push(a, b, c)
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/)
      positions.push(Number(parts[1]), Number(parts[2]), Number(parts[3]))
    } else if (line.startsWith('g ') || line.startsWith('o ')) {
      current = line.slice(2).trim() || 'default'
    } else if (line.startsWith('f ')) {
      const refs = line
        .split(/\s+/)
        .slice(1)
        .map((token) => {
          const index = Number(token.split('/')[0])
          return index < 0 ? positions.length / 3 + index : index - 1
        })
      for (let i = 2; i < refs.length; i++) addTriangle(current, refs[0], refs[i - 1], refs[i])
    }
  }

  const position = doc
    .createAccessor('POSITION')
    .setType('VEC3')
    .setArray(new Float32Array(positions))
    .setBuffer(buffer)

  const scene = doc.createScene(name)
  for (const [group, indices] of groups) {
    const indexBuffer = doc
      .createAccessor(`${group}-indices`)
      .setType('SCALAR')
      .setArray(new Uint32Array(indices))
      .setBuffer(buffer)
    const primitive = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indexBuffer)
    const mesh = doc.createMesh(group).addPrimitive(primitive)
    scene.addChild(doc.createNode(group).setMesh(mesh))
  }
  return doc
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Placeholder names that Sketchfab exports put on the actual mesh nodes. */
const GENERIC_NAME = /^(Object_\d+|Object\d+|\d+|mesh(_\d+)?)$/i
/** Nodes that only exist to carry a transform or a scene. */
const WRAPPER_NAME = /^(root|GLTF_SceneRootNode|Sketchfab_model|Scene|.*_Scene|__parts)$/i

/**
 * Bakes every node's world transform into its geometry and rebuilds a flat,
 * temporary hierarchy: one node per part under a holding root. Returns the
 * holding root and the parts as { name, mesh, node }.
 *
 * Parts are named after the closest meaningful ancestor: Sketchfab wraps each
 * real part in a node like `Rafale-airframe_0` whose child mesh is just
 * `Object_4`, so the parent's name is the one worth keeping.
 */
function bakeParts(doc) {
  const sources = doc.getRoot().listScenes()
  const holding = doc.createNode('__parts')

  const parts = []
  const baked = new Set()

  const visit = (node, inherited) => {
    const own = node.getName() ?? ''
    const semantic = !own || GENERIC_NAME.test(own) || WRAPPER_NAME.test(own) ? inherited : own
    const mesh = node.getMesh()
    if (mesh) {
      if (!baked.has(mesh)) {
        baked.add(mesh)
        transformMesh(mesh, node.getWorldMatrix())
        parts.push({ name: semantic || own || 'part', mesh, node: null })
      }
      node.setMesh(null)
    }
    for (const child of [...node.listChildren()]) visit(child, semantic)
  }
  for (const scene of sources) {
    for (const child of [...scene.listChildren()]) visit(child, '')
  }

  // Re-home the meshes under the holding root, then drop the source tree.
  for (const part of parts) {
    part.node = doc.createNode(part.name).setMesh(part.mesh)
    holding.addChild(part.node)
  }
  sources.forEach((scene) => scene.dispose())
  doc.getRoot()
    .listNodes()
    .filter((node) => node !== holding && !parts.some((part) => part.node === node))
    .forEach((node) => node.dispose())

  const output = doc.createScene('scene')
  output.addChild(holding)
  return { parts, holding, output }
}

/** Rewrites every mesh into canonical space: nose -Z, up +Y, TARGET_LENGTH. */
function normalize(parts, forward) {
  const axisIndex = { x: 0, y: 1, z: 2 }[forward[1]]
  const sign = forward[0] === '+' ? 1 : -1

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const p = [0, 0, 0]
  for (const { mesh } of parts) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, p)
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k]
          if (p[k] > max[k]) max[k] = p[k]
        }
      }
    }
  }

  const size = max.map((v, i) => v - min[i])
  const center = max.map((v, i) => (v + min[i]) / 2)
  const scale = TARGET_LENGTH / Math.max(...size)

  // Yaw that maps the source forward axis onto -Z.
  let yaw = 0
  if (axisIndex === 0) yaw = sign > 0 ? Math.PI / 2 : -Math.PI / 2
  else if (axisIndex === 2) yaw = sign > 0 ? Math.PI : 0
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)

  const outMin = [Infinity, Infinity, Infinity]
  const outMax = [-Infinity, -Infinity, -Infinity]
  for (const { mesh } of parts) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      const array = position.getArray()
      for (let i = 0; i < position.getCount(); i++) {
        const x = (array[i * 3] - center[0]) * scale
        const y = (array[i * 3 + 1] - center[1]) * scale
        const z = (array[i * 3 + 2] - center[2]) * scale
        array[i * 3] = x * cos + z * sin
        array[i * 3 + 1] = y
        array[i * 3 + 2] = -x * sin + z * cos
        const q = [array[i * 3], array[i * 3 + 1], array[i * 3 + 2]]
        for (let k = 0; k < 3; k++) {
          if (q[k] < outMin[k]) outMin[k] = q[k]
          if (q[k] > outMax[k]) outMax[k] = q[k]
        }
      }
      position.setArray(array)
    }
  }

  return { size: outMax.map((v, i) => v - outMin[i]), yaw }
}

/** Splits one part's triangles into a new part using a canonical-space test. */
function splitPart(doc, parts, holding, split) {
  const source = parts.find((part) => part.name === split.from)
  if (!source) throw new Error(`split: part "${split.from}" not found`)

  const kept = []
  const taken = []
  const p = [0, 0, 0]
  const a = [0, 0, 0]
  const b = [0, 0, 0]
  const c = [0, 0, 0]
  for (const primitive of source.mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    const indices = primitive.getIndices().getArray()
    const keep = []
    const take = []
    for (let i = 0; i < indices.length; i += 3) {
      position.getElement(indices[i], a)
      position.getElement(indices[i + 1], b)
      position.getElement(indices[i + 2], c)
      const cx = (a[0] + b[0] + c[0]) / 3
      const cy = (a[1] + b[1] + c[1]) / 3
      const cz = (a[2] + b[2] + c[2]) / 3
      // Geometric normal, so parts can be told apart by their orientation
      // (rotor blades lie flat, the tail fin stands upright).
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const uz = b[2] - a[2]
      const vx = c[0] - a[0]
      const vy = c[1] - a[1]
      const vz = c[2] - a[2]
      let nx = uy * vz - uz * vy
      let ny = uz * vx - ux * vz
      let nz = ux * vy - uy * vx
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      const target = split.within(cx, cy, cz, nx, ny, nz) ? take : keep
      target.push(indices[i], indices[i + 1], indices[i + 2])
    }
    if (keep.length) kept.push({ primitive, indices: new Uint32Array(keep) })
    if (take.length) taken.push({ primitive, indices: new Uint32Array(take) })
  }

  if (!taken.length || !kept.length) {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const primitive of source.mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      const q = [0, 0, 0]
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, q)
        for (let k = 0; k < 3; k++) {
          if (q[k] < min[k]) min[k] = q[k]
          if (q[k] > max[k]) max[k] = q[k]
        }
      }
    }
    const detail = `"${split.from}" bounds x[${min[0].toFixed(2)}..${max[0].toFixed(2)}] y[${min[1].toFixed(2)}..${max[1].toFixed(2)}] z[${min[2].toFixed(2)}..${max[2].toFixed(2)}], kept ${kept.length} prims, taken ${taken.length}`
    throw new Error(`split: "${split.from}" -> "${split.into}" impossible (${detail})`)
  }

  const rebuild = (name, groups) => {
    const mesh = doc.createMesh(name)
    for (const { primitive, indices } of groups) {
      const indexBuffer = doc
        .createAccessor(`${name}-indices`)
        .setType('SCALAR')
        .setArray(indices)
        .setBuffer(doc.getRoot().listBuffers()[0])
      mesh.addPrimitive(
        doc.createPrimitive().setAttribute('POSITION', primitive.getAttribute('POSITION')).setIndices(indexBuffer),
      )
    }
    return mesh
  }

  source.mesh.dispose()
  source.mesh = rebuild(split.from, kept)
  source.node.setMesh(source.mesh)

  const takenMesh = rebuild(split.into, taken)
  const takenNode = doc.createNode(split.into).setMesh(takenMesh)
  holding.addChild(takenNode)
  parts.push({ name: split.into, mesh: takenMesh, node: takenNode })
}

/** Renames the part nodes and moves them under the flat output root. */
function emitParts(doc, parts, holding, output, rootName) {
  const root = doc.createNode(rootName)
  output.addChild(root)

  const used = new Set()
  for (const part of parts) {
    const base = kebab(part.name)
    let name = base
    let n = 2
    while (used.has(name)) name = `${base}-${n++}`
    used.add(name)
    part.node.setName(name)
    clearNodeParent(part.node)
    root.addChild(part.node)
  }
  holding.dispose()
  return root
}

function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

function triangleCount(parts) {
  return parts.reduce(
    (sum, { mesh }) =>
      sum + mesh.listPrimitives().reduce((s, p) => s + Math.floor((p.getIndices()?.getCount() ?? 0) / 3), 0),
    0,
  )
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

await MeshoptEncoder.ready
await MeshoptSimplifier.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptEncoder })
const rows = []

for (const model of MODELS) {
  const src = resolve(ROOT, model.src)
  const before = statSync(src).size
  const isObj = src.toLowerCase().endsWith('.obj')
  const doc = isObj ? objToDocument(readFileSync(src, 'utf8'), model.id) : await io.read(src)

  // 1. Semantic names, while the source hierarchy is still around. ---------
  if (model.renameByMaterial) {
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh()
      if (!mesh) continue
      const material = mesh.listPrimitives()[0]?.getMaterial()?.getName()
      const target = model.renameByMaterial[material]
      if (target) node.setName(target)
    }
  }
  if (model.rename) {
    for (const node of doc.getRoot().listNodes()) {
      const target = model.rename[node.getName() ?? '']
      if (target) node.setName(target)
    }
  }

  // 2. A wireframe needs geometry only. -------------------------------------
  for (const texture of doc.getRoot().listTextures()) texture.dispose()
  for (const material of doc.getRoot().listMaterials()) material.dispose()
  for (const extension of doc.getRoot().listExtensionsUsed()) {
    if (extension.extensionName.includes('Materials') || extension.extensionName.includes('Texture')) extension.dispose()
  }

  // 3. Bake transforms, drop everything but POSITION. -----------------------
  const { parts, holding, output } = bakeParts(doc)
  for (const { mesh } of parts) {
    for (const primitive of mesh.listPrimitives()) {
      for (const semantic of ['NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) {
        if (primitive.getAttribute(semantic)) primitive.setAttribute(semantic, null)
      }
    }
  }

  // 4. Clean, then meet the triangle budget. --------------------------------
  const beforeTris = triangleCount(parts)
  await doc.transform(weld(), dedup(), prune())
  const weldedTris = triangleCount(parts)
  if (model.budget && weldedTris > model.budget) {
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: model.budget / weldedTris, error: 0.004 }),
    )
  }

  // 5. Canonical frame, then carve the parts the runtime animates. ----------
  const frame = normalize(parts, model.forward)
  for (const split of model.splits ?? []) splitPart(doc, parts, holding, split)
  emitParts(doc, parts, holding, output, model.id)

  // 6. Compress and write. ---------------------------------------------------
  await doc.transform(weld(), dedup(), prune())
  await doc.transform(quantize({ pattern: /POSITION/, quantizePosition: 14 }))
  await doc.transform(meshopt({ encoder: MeshoptEncoder }))

  const out = resolve(ROOT, model.out)
  if (!REPORT_ONLY) await io.write(out, doc)
  const after = REPORT_ONLY ? 0 : statSync(out).size

  rows.push({
    model: model.id,
    parts: parts.length,
    beforeTris,
    afterTris: triangleCount(parts),
    beforeMB: before / 1e6,
    afterKB: after / 1e3,
    size: frame.size.map((v) => v.toFixed(1)).join('x'),
    out: model.out.split('/').pop(),
  })
}

const pad = (v, n) => String(v).padStart(n)
console.log('\n  model     parts   tris in -> out      source MB -> out KB   canonical      file')
console.log('  ' + '-'.repeat(84))
for (const r of rows) {
  console.log(
    `  ${r.model.padEnd(9)} ${pad(r.parts, 3)}   ${pad(r.beforeTris, 7)} -> ${pad(r.afterTris, 6)}   ${pad(r.beforeMB.toFixed(2), 9)} -> ${pad(r.afterKB.toFixed(0), 7)}   ${r.size.padEnd(14)} ${r.out}`,
  )
}
console.log('')
