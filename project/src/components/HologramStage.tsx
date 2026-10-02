import { animate } from 'animejs'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { createScrollTimeline } from '../animation/sequence'
import { CHAPTERS, chapterLayout } from '../data/chapters'
import { MODELS, type ModelId, type Reference } from '../data/models'
import { loadHologramModel, type HologramModel } from '../three/hologram/model'
import { createHologramOverlay } from '../three/hologram/overlay'
import { INITIAL_RIG, applyRig, partWorld, revealOf, type HologramRig, type StageModel } from '../three/hologram/rig'
import { createHologramScene } from '../three/hologram/scene'
import { Hud, type HudHandle, type HudProfile } from './Hud'

interface HologramStageProps {
  /** The tall scrolling element whose scroll position drives the sequence. */
  scrollTargetRef: RefObject<HTMLElement | null>
}

/** Callout chip size (px) and the vertical gap kept between two chips. */
const CHIP_WIDTH = 204
const CHIP_GAP = 46
/**
 * Callouts need room: panel + airframe + a chip column. Below this width
 * (tablets, 1024 landscape) they would sit on the airframe and the HUD data,
 * so only the target box is drawn.
 */
const CALLOUT_MIN_WIDTH = 1180

const referenceKey = (reference: Reference) => `${reference.anchor}:${reference.text}`

/**
 * Fixed, full-viewport layer: the WebGL hologram, the exploded-view callouts
 * (SVG leader lines + HTML chips), the target designator box and the HUD.
 *
 * Everything imperative (Three.js + Anime.js + the render loop) lives inside
 * one effect so React only owns the DOM. The effect is fully reversible, which
 * keeps StrictMode's mount -> unmount -> mount cycle safe.
 */
export function HologramStage({ scrollTargetRef }: HologramStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HudHandle>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const boxStateRef = useRef<HTMLSpanElement>(null)
  const boxRangeRef = useRef<HTMLSpanElement>(null)
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())
  const leaderRefs = useRef(new Map<string, SVGPathElement>())
  const dotRefs = useRef(new Map<string, SVGGElement>())
  const focusApiRef = useRef<((reference: Reference) => void) | null>(null)

  const [progress, setProgress] = useState<number | null>(0)
  const [booted, setBooted] = useState(false)
  /** Airframe actually on stage - drives the callouts and target data. */
  const [displayModel, setDisplayModel] = useState<ModelId | null>('rafale')
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [dataSide, setDataSide] = useState<'left' | 'right'>('left')
  const [profileIndex, setProfileIndex] = useState(0)

  const shown = displayModel ? MODELS.find((model) => model.id === displayModel)! : null
  const chapter = CHAPTERS[profileIndex]
  const profile: HudProfile = {
    code: `${chapter.code} · ${chapter.eyebrow.replace(/^\d+\s·\s/, '').toUpperCase()}`,
    rows: chapter.profile ?? [],
    maquette: shown?.name ?? null,
    mode: chapter.mode ?? (chapter.model ? 'PROJET' : 'PARCOURS'),
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const scrollTarget = scrollTargetRef.current
    const host = canvas?.parentElement
    if (!canvas || !scrollTarget || !host) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hologram = createHologramScene(canvas)

    const rig: HologramRig = { ...INITIAL_RIG, ...CHAPTERS[0].pose }
    const timeline = createScrollTimeline(rig, scrollTarget, { onUpdate: () => undefined, reducedMotion })
    const { starts } = chapterLayout()

    // --- sizing ------------------------------------------------------------
    let viewWidth = host.clientWidth
    let viewHeight = host.clientHeight
    const resizeObserver = new ResizeObserver(([entry]) => {
      viewWidth = entry.contentRect.width
      viewHeight = entry.contentRect.height
      hologram.resize(viewWidth, viewHeight)
    })
    resizeObserver.observe(host)

    // --- models ------------------------------------------------------------
    let stage: StageModel[] = []
    let disposed = false
    const byId = new Map<ModelId, HologramModel>()
    const boot = { value: reducedMotion ? 1 : 0 }
    let bootAnimation: { revert: () => void } | null = null
    let loaded = 0

    Promise.all(
      MODELS.map(async (config) => {
        const model = await loadHologramModel(config)
        if (disposed) {
          model.dispose()
          return
        }
        const overlay = createHologramOverlay(model)
        model.stage.add(overlay.group)
        hologram.scene.add(model.root)
        byId.set(config.id, model)
        stage.push({ model, overlay })
        loaded++
        setProgress(Math.round((loaded / MODELS.length) * 100))
      }),
    )
      .then(() => {
        if (disposed) return
        setProgress(null)
        setBooted(true)
        // System boot: the first airframe is printed bottom-up by the reveal cut.
        bootAnimation = animate(boot, { value: 1, duration: reducedMotion ? 0 : 1900, ease: 'inOutQuad', delay: 150 })
      })
      .catch((error: unknown) => {
        console.error('Failed to load a hologram model', error)
        if (!disposed) setProgress(null)
      })

    // --- focus on a callout -------------------------------------------------
    // Clicking a chip dollies the camera onto that part; scrolling releases it.
    let shownModel: ModelId | null = 'rafale'
    let references: Reference[] = MODELS[0].references
    const focus = { value: 0, intent: false, key: null as string | null }
    let focusAnimation: { revert: () => void } | null = null
    let restingScrollY = window.scrollY

    const tweenFocus = (to: number, duration: number) => {
      focusAnimation?.revert()
      focusAnimation = animate(focus, {
        value: to,
        duration,
        ease: 'inOutSine',
        onUpdate: () => {
          rig.focusActive = focus.value
        },
      })
    }

    const unfocus = () => {
      if (!focus.intent) return
      focus.intent = false
      focus.key = null
      setFocusedKey(null)
      tweenFocus(0, 550)
    }

    focusApiRef.current = (reference) => {
      const model = shownModel ? byId.get(shownModel) : null
      const part = model?.parts.find((candidate) => candidate.name === reference.anchor)
      if (!model || !part) return
      const key = referenceKey(reference)
      if (focus.key === key) {
        unfocus()
        return
      }
      // World position: the stage carries attitude (yaw, pitch, bob).
      const target = partWorld(model, part, new THREE.Vector3())
      rig.focusX = target.x
      rig.focusY = target.y
      rig.focusZ = target.z
      rig.focusRadius = part.radius
      // Close enough to read the part, far enough to keep the airframe legible.
      rig.focusDistance = THREE.MathUtils.clamp(part.radius * 3.4 + 9, 12, 24)
      focus.intent = true
      focus.key = key
      restingScrollY = window.scrollY
      setFocusedKey(key)
      tweenFocus(1, 900)
    }

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__hologram = {
        rig,
        timeline,
        boot,
        get models() {
          return stage
        },
      }
    }

    // --- per-frame helpers -------------------------------------------------
    const projected = new THREE.Vector3()
    const world = new THREE.Vector3()
    const corner = new THREE.Vector3()
    const toScreen = (point: THREE.Vector3) => {
      projected.copy(point).project(hologram.camera)
      return {
        x: (projected.x * 0.5 + 0.5) * viewWidth,
        y: (-projected.y * 0.5 + 0.5) * viewHeight,
        behind: projected.z > 1,
      }
    }

    /** Screen-space bounds of the airframe as it currently stands (exploded or not). */
    const screenBounds = (model: HologramModel) => {
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const part of model.parts) {
        if (!part.object.visible) continue
        const dx = part.current.x - part.center.x
        const dy = part.current.y - part.center.y
        const dz = part.current.z - part.center.z
        for (let i = 0; i < 8; i++) {
          corner.set(
            (i & 1 ? part.box.max.x : part.box.min.x) + dx,
            (i & 2 ? part.box.max.y : part.box.min.y) + dy,
            (i & 4 ? part.box.max.z : part.box.min.z) + dz,
          )
          corner.applyMatrix4(model.stage.matrixWorld)
          const p = toScreen(corner)
          if (p.behind) continue
          x0 = Math.min(x0, p.x)
          y0 = Math.min(y0, p.y)
          x1 = Math.max(x1, p.x)
          y1 = Math.max(y1, p.y)
        }
      }
      return { x0, y0, x1, y1 }
    }

    /** The free side of the viewport, next to the current chapter's panel. */
    let panelAlign: string = CHAPTERS[0].align
    let profileSeen = 0
    const freeZone = (scrollUnits: number) => {
      let index = 0
      for (let i = 0; i < starts.length; i++) if (scrollUnits >= starts[i] - 0.5) index = i
      const chapter = CHAPTERS[index]
      if (index !== profileSeen) {
        profileSeen = index
        setProfileIndex(index)
      }
      if (chapter.align !== panelAlign) {
        panelAlign = chapter.align
        setDataSide(chapter.align === 'left' ? 'right' : 'left')
      }
      const panel = document.getElementById(`panel-${chapter.id}`)?.getBoundingClientRect()
      // Keep clear of the HUD tapes: speed on the left (xl+), altitude /
      // waypoints and the SYS readout on the right (md+).
      const left = viewWidth >= 1280 ? 96 : 32
      const right = viewWidth >= 768 ? 140 : 32
      if (panel && chapter.align === 'right') return { x0: left, x1: panel.left - 28 }
      if (panel && chapter.align === 'left') return { x0: panel.right + 28, x1: viewWidth - right }
      return { x0: left, x1: viewWidth - right }
    }

    const hideCallouts = () => {
      for (const chip of chipRefs.current.values()) chip.style.opacity = '0'
      for (const leader of leaderRefs.current.values()) leader.style.opacity = '0'
      for (const dot of dotRefs.current.values()) dot.style.opacity = '0'
    }

    /**
     * Exploded-view callouts. Anchors are split into a left and a right
     * column at the edges of the free zone, sorted by height and spread so
     * chips never overlap; each gets an elbow leader line. `rig.labels`
     * draws them one after another: line first, then the chip.
     */
    type Zone = { x0: number; x1: number }
    type Bounds = { x0: number; y0: number; x1: number; y1: number }

    const placeCallouts = (model: HologramModel, zone: Zone, bounds: Bounds) => {
      const amount = rig.labels
      if (amount < 0.01 || viewWidth < CALLOUT_MIN_WIDTH) {
        hideCallouts()
        return
      }
      const top = 120
      const bottom = viewHeight - 70
      const middle = Number.isFinite(bounds.x0) ? (bounds.x0 + bounds.x1) / 2 : (zone.x0 + zone.x1) / 2
      // Columns hug the airframe's silhouette, but never leave the free zone.
      const leftX = Number.isFinite(bounds.x0)
        ? THREE.MathUtils.clamp(bounds.x0 - CHIP_WIDTH - 24, zone.x0, zone.x1 - CHIP_WIDTH)
        : zone.x0
      const rightX = Number.isFinite(bounds.x1)
        ? THREE.MathUtils.clamp(bounds.x1 + 24, zone.x0, zone.x1 - CHIP_WIDTH)
        : zone.x1 - CHIP_WIDTH

      type Entry = { key: string; ax: number; ay: number; order: number; side: 'left' | 'right'; y: number }
      const entries: Entry[] = []
      references.forEach((reference, order) => {
        const part = model.parts.find((candidate) => candidate.name === reference.anchor)
        if (!part || !part.object.visible) return
        const p = toScreen(partWorld(model, part, world))
        if (p.behind) return
        entries.push({ key: referenceKey(reference), ax: p.x, ay: p.y, order, side: p.x < middle ? 'left' : 'right', y: 0 })
      })

      // Two columns only if both fit beside the airframe; otherwise one
      // column on the roomier (outer) side - chips must never sit on the
      // airframe they describe.
      const need = CHIP_WIDTH + 24
      const roomLeft = Number.isFinite(bounds.x0) ? bounds.x0 - zone.x0 : Infinity
      const roomRight = Number.isFinite(bounds.x1) ? zone.x1 - bounds.x1 : Infinity
      if (roomLeft < need || roomRight < need) {
        const side = roomLeft >= roomRight ? 'left' : 'right'
        for (const entry of entries) entry.side = side
      } else {
        const count = (side: Entry['side']) => entries.filter((entry) => entry.side === side).length
        const limit = Math.ceil(entries.length / 2) + 1
        for (const side of ['left', 'right'] as const) {
          while (count(side) > limit) {
            const other = side === 'left' ? 'right' : 'left'
            const candidates = entries.filter((entry) => entry.side === side)
            candidates.sort((a, b) => Math.abs(a.ax - middle) - Math.abs(b.ax - middle))
            candidates[0].side = other
          }
        }
      }

      // The HUD target-data block sits in a bottom corner: a column that
      // shares its x-range stops above it instead of running over it.
      const data = document.getElementById('hud-target-data')?.getBoundingClientRect()
      const columnBottom = (x: number) =>
        data && data.height > 0 && x < data.right + 12 && x + CHIP_WIDTH > data.left - 12
          ? Math.min(bottom, data.top - 26)
          : bottom

      for (const side of ['left', 'right'] as const) {
        const column = entries.filter((entry) => entry.side === side).sort((a, b) => a.ay - b.ay)
        let cursor = top
        for (const entry of column) {
          entry.y = Math.max(entry.ay, cursor)
          cursor = entry.y + CHIP_GAP
        }
        // Push back up if the column ran past the bottom.
        let floor = columnBottom(side === 'left' ? leftX : rightX)
        for (let i = column.length - 1; i >= 0; i--) {
          column[i].y = Math.min(column[i].y, floor)
          floor = column[i].y - CHIP_GAP
        }
      }

      const steps = references.length + 1.5
      const seen = new Set<string>()
      for (const entry of entries) {
        seen.add(entry.key)
        const chip = chipRefs.current.get(entry.key)
        const leader = leaderRefs.current.get(entry.key)
        const dot = dotRefs.current.get(entry.key)
        if (!chip || !leader || !dot) continue

        const t = THREE.MathUtils.clamp(amount * steps - entry.order, 0, 1)
        // While a part is framed, the other callouts step back: their
        // anchors fly off-screen with the dolly and the lines would clutter.
        const dim = focus.key && focus.key !== entry.key ? rig.focusActive : 0
        const left = entry.side === 'left'
        const chipX = left ? leftX : rightX
        const edgeX = left ? leftX + CHIP_WIDTH : rightX
        const elbowX = left ? Math.max(edgeX + 28, Math.min(entry.ax - 18, edgeX + 120)) : Math.min(edgeX - 28, Math.max(entry.ax + 18, edgeX - 120))

        const d = `M${entry.ax.toFixed(1)},${entry.ay.toFixed(1)} L${elbowX.toFixed(1)},${entry.y.toFixed(1)} L${edgeX.toFixed(1)},${entry.y.toFixed(1)}`
        const length = Math.hypot(elbowX - entry.ax, entry.y - entry.ay) + Math.abs(edgeX - elbowX)
        leader.setAttribute('d', d)
        leader.style.strokeDasharray = `${length.toFixed(1)}`
        leader.style.strokeDashoffset = `${(length * (1 - THREE.MathUtils.smoothstep(t, 0, 0.6))).toFixed(1)}`
        leader.style.opacity = t > 0 ? String(1 - dim) : '0'

        dot.setAttribute('transform', `translate(${entry.ax.toFixed(1)},${entry.ay.toFixed(1)})`)
        dot.style.opacity = String(THREE.MathUtils.smoothstep(t, 0, 0.25) * (1 - dim))

        const chipT = THREE.MathUtils.smoothstep(t, 0.5, 1)
        chip.style.opacity = String(chipT * (1 - 0.65 * dim))
        chip.style.pointerEvents = chipT > 0.5 ? 'auto' : 'none'
        chip.style.transform = `translate3d(${(chipX + (left ? -8 : 8) * (1 - chipT)).toFixed(1)}px, ${(entry.y - 18).toFixed(1)}px, 0)`
      }
      for (const [key, chip] of chipRefs.current) {
        if (seen.has(key)) continue
        chip.style.opacity = '0'
        leaderRefs.current.get(key)?.style.setProperty('opacity', '0')
        dotRefs.current.get(key)?.style.setProperty('opacity', '0')
      }
    }

    /** Target designator: corner brackets around the airframe, "printing" on lock. */
    let lockStart = performance.now()
    const placeTargetBox = (model: HologramModel | null, reveal: number, now: number, zone: Zone, b: Bounds) => {
      const box = boxRef.current
      if (!box) return
      if (!model || reveal < 0.05 || !Number.isFinite(b.x0)) {
        box.style.opacity = '0'
        return
      }
      const lock = THREE.MathUtils.clamp((now - lockStart) / 700, 0, 1)
      const grow = 1 + 0.18 * (1 - lock) * (1 - lock)
      const padding = 22
      // Clamp to the free zone: the brackets never disappear under the panel.
      const x0 = Math.max(b.x0 - padding, zone.x0 - 12)
      const x1 = Math.min(b.x1 + padding, zone.x1 + 12)
      const y0 = Math.max(b.y0 - padding, 104)
      const y1 = Math.min(b.y1 + padding, viewHeight - 40)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const w = (x1 - x0) * grow
      const h = (y1 - y0) * grow
      // Steps aside while a part is framed: the dolly makes it oversized.
      const framed = 1 - THREE.MathUtils.smoothstep(rig.focusActive, 0, 0.6)
      box.style.opacity = String(THREE.MathUtils.smoothstep(reveal, 0.5, 1) * (1 - 0.45 * rig.labels) * framed)
      box.style.transform = `translate3d(${(cx - w / 2).toFixed(1)}px, ${(cy - h / 2).toFixed(1)}px, 0)`
      box.style.width = `${w.toFixed(1)}px`
      box.style.height = `${h.toFixed(1)}px`
      if (boxStateRef.current) boxStateRef.current.textContent = lock < 1 ? '…' : 'PRÊT'
      if (boxRangeRef.current) boxRangeRef.current.textContent = hologram.camera.position.length().toFixed(1)
    }

    // --- render loop -------------------------------------------------------
    let frame = 0
    let previous = performance.now()
    const start = previous
    let lastScroll = window.scrollY
    let speed = 0
    let travel = 0

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const scrollY = window.scrollY
      const scrollUnits = scrollY / Math.max(1, window.innerHeight)
      const moved = scrollY - lastScroll
      lastScroll = scrollY
      travel += moved
      // Time-based smoothing: decays the same at 30 or 144 fps.
      const instant = Math.min(1200, (Math.abs(moved) / Math.max(delta, 1e-3)) * 0.3)
      speed += (instant - speed) * (1 - Math.exp(-delta * 5))

      // The airframe on stage is decided by the rig, not by the scroll
      // position, so callouts and target data switch exactly with the reveal.
      let dominant: ModelId | null = null
      let best = 0.02
      for (const config of MODELS) {
        const value = revealOf(rig, config.id, boot.value)
        if (value > best) {
          best = value
          dominant = config.id
        }
      }
      if (dominant !== shownModel) {
        shownModel = dominant
        references = dominant ? MODELS.find((model) => model.id === dominant)!.references : []
        lockStart = now
        setDisplayModel(dominant)
        unfocus()
      }
      if (focus.intent && Math.abs(scrollY - restingScrollY) > 8) unfocus()

      applyRig(stage, rig, hologram.camera, { time: (now - start) / 1000, delta, boot: boot.value })
      hologram.renderer.render(hologram.scene, hologram.camera)

      const model = shownModel ? (byId.get(shownModel) ?? null) : null
      const zone = freeZone(scrollUnits)
      const bounds = model ? screenBounds(model) : { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
      if (model) placeCallouts(model, zone, bounds)
      else hideCallouts()
      placeTargetBox(model, best, now, zone, bounds)

      hudRef.current?.update({
        heading: (rig.camAzimuth * 180) / Math.PI + 180,
        speed: Math.min(999, speed),
        travel,
        scan: rig.scan,
        explode: rig.explode,
        focused: focus.intent,
      })
    }
    frame = requestAnimationFrame(loop)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      timeline.revert()
      bootAnimation?.revert()
      focusAnimation?.revert()
      for (const { model, overlay } of stage) {
        hologram.scene.remove(model.root)
        overlay.dispose()
        model.dispose()
      }
      stage = []
      byId.clear()
      hologram.dispose()
    }
  }, [scrollTargetRef])

  const references = shown?.references ?? []

  return (
    <>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

      {/* Leader lines + anchor markers */}
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {references.map((reference) => {
          const key = referenceKey(reference)
          return (
            <g key={key}>
              <path
                ref={(element) => {
                  if (element) leaderRefs.current.set(key, element)
                  else leaderRefs.current.delete(key)
                }}
                fill="none"
                stroke="rgb(245 246 248 / 0.75)"
                strokeWidth={1}
                style={{ opacity: 0 }}
              />
              <g
                ref={(element) => {
                  if (element) dotRefs.current.set(key, element)
                  else dotRefs.current.delete(key)
                }}
                style={{ opacity: 0 }}
              >
                <circle r={7} fill="none" stroke="rgb(245 246 248 / 0.45)" strokeWidth={1} />
                <circle r={2.2} fill="rgb(245 246 248)" />
              </g>
            </g>
          )
        })}
      </svg>

      {/* Callout chips (clickable: frame the part) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {references.map((reference, index) => {
          const key = referenceKey(reference)
          const focused = focusedKey === key
          return (
            <button
              key={key}
              type="button"
              aria-label={`Cadrer : ${reference.text}`}
              onClick={() => focusApiRef.current?.(reference)}
              ref={(element) => {
                if (element) chipRefs.current.set(key, element)
                else chipRefs.current.delete(key)
              }}
              style={{ width: CHIP_WIDTH, opacity: 0 }}
              className={`absolute top-0 left-0 flex cursor-crosshair items-stretch border text-left transition-colors will-change-transform ${
                focused ? 'border-chalk bg-graphite' : 'border-chalk/25 bg-ink/90 hover:border-chalk/70'
              }`}
            >
              <span className="flex w-8 shrink-0 items-center justify-center border-r border-chalk/25 font-mono text-[10px] tracking-[0.06em] text-fog">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-col justify-center px-2.5 py-1.5 leading-tight">
                <span className="truncate font-mono text-[11px] font-medium tracking-[0.08em] text-white uppercase">
                  {reference.text}
                </span>
                {reference.value && (
                  <span className="truncate font-mono text-[10px] tracking-[0.08em] text-mist">{reference.value}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Target designator box */}
      <div
        ref={boxRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform"
      >
        {['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((corner) => (
          <span key={corner} className={`absolute size-5 border-chalk/80 ${corner}`} />
        ))}
        {shown && (
          <>
            <span className="tag absolute -top-6 left-0 text-[10px] whitespace-nowrap text-fog">
              MAQUETTE <span className="text-chalk">{shown.code}</span>
            </span>
            <span className="tag absolute -top-6 right-0 text-[10px] text-chalk">
              <span ref={boxStateRef}>…</span>
            </span>
            <span className="tag absolute -bottom-6 right-0 text-[10px] whitespace-nowrap text-mist">
              DIST <span ref={boxRangeRef} className="text-fog">00.0</span>
            </span>
          </>
        )}
      </div>

      {/* Portalled so the HUD sits above the copy panels (this layer is z-0). */}
      {createPortal(<Hud ref={hudRef} profile={profile} booted={booted} dataSide={dataSide} />, document.body)}

      <p
        aria-live="polite"
        className={`tag absolute inset-x-0 top-1/2 text-center text-fog transition-opacity duration-700 ${
          progress === null ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {progress && progress > 0 ? `Chargement des maquettes · ${progress}%` : 'Chargement des maquettes'}
      </p>
    </>
  )
}
