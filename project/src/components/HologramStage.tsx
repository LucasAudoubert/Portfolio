import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { createScrollTimeline } from '../animation/sequence'
import { CHAPTERS } from '../data/chapters'
import { MODELS, type ModelId, type Reference } from '../data/models'
import { loadHologramModel, type HologramModel } from '../three/hologram/model'
import { createHologramOverlay } from '../three/hologram/overlay'
import { INITIAL_RIG, anchorPosition, applyRig, type HologramRig, type StageModel } from '../three/hologram/rig'
import { createHologramScene } from '../three/hologram/scene'

interface HologramStageProps {
  /** The tall scrolling element whose scroll position drives the sequence. */
  scrollTargetRef: RefObject<HTMLElement | null>
}

/**
 * Where the copy sits for each layout. Annotations that would land inside the
 * copy's half of the viewport are hidden rather than drawn on top of it.
 */
const COPY_ZONE: Record<string, (x: number, y: number, width: number, height: number) => boolean> = {
  left: (x, _y, width) => x < width * 0.44,
  right: (x, _y, width) => x > width * 0.56,
  center: (_x, y, _width, height) => y > height * 0.52,
}

/**
 * Fixed, full-viewport WebGL layer: the hologram plus its HTML annotations.
 *
 * Everything imperative (Three.js + Anime.js + the render loop) lives inside
 * one effect so React only owns the canvas, the labels and the readouts. The
 * effect is fully reversible, which keeps StrictMode's mount -> unmount ->
 * mount cycle safe.
 */
export function HologramStage({ scrollTargetRef }: HologramStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef(new Map<string, HTMLDivElement>())
  const readoutRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState<number | null>(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const active = CHAPTERS[activeIndex]
  const activeModel = MODELS.find((model) => model.id === active.model)!

  useEffect(() => {
    const canvas = canvasRef.current
    const scrollTarget = scrollTargetRef.current
    const host = canvas?.parentElement
    if (!canvas || !scrollTarget || !host) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // --- scene -------------------------------------------------------------
    const hologram = createHologramScene(canvas)

    const rig: HologramRig = { ...INITIAL_RIG, ...CHAPTERS[0].pose }
    let dirty = true
    const markDirty = () => {
      dirty = true
    }
    const timeline = createScrollTimeline(rig, scrollTarget, { onUpdate: markDirty, reducedMotion })

    // --- sizing ------------------------------------------------------------
    let viewWidth = host.clientWidth
    let viewHeight = host.clientHeight
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      viewWidth = width
      viewHeight = height
      hologram.resize(width, height)
      markDirty()
    })
    resizeObserver.observe(host)

    // --- models ------------------------------------------------------------
    let stage: StageModel[] = []
    let disposed = false
    let lastPercent = -1

    const byId = new Map<ModelId, HologramModel>()

    Promise.all(
      MODELS.map(async (config, index) => {
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
        const percent = Math.round(((index + 1) / MODELS.length) * 100)
        if (percent !== lastPercent) {
          lastPercent = percent
          setProgress(percent)
        }
      }),
    )
      .then(() => {
        if (!disposed) setProgress(null)
      })
      .catch((error: unknown) => {
        console.error('Failed to load a hologram model', error)
        if (!disposed) setProgress(null)
      })

    // --- render loop -------------------------------------------------------
    const projected = new THREE.Vector3()
    const anchor = new THREE.Vector3()
    let frame = 0
    let previous = performance.now()
    const start = previous
    let labelsShown = 0
    let chapterSeen = -1

    /** Places the DOM annotations for the chapter currently in view. */
    const placeLabels = () => {
      const opacity = rig.labels
      if (Math.abs(opacity - labelsShown) > 0.02) {
        labelsShown = opacity
        for (const element of labelRefs.current.values()) element.style.opacity = String(opacity)
      }
      if (opacity < 0.05) return

      const model = byId.get(CHAPTERS[currentChapter]?.model ?? 'rafale')
      if (!model || !model.root.visible) return
      if (!activeReferences.length) return

      const inCopyZone = COPY_ZONE[CHAPTERS[currentChapter]?.align ?? 'center']
      const placed: Array<{ x: number; y: number }> = []
      const entries = activeReferences
        .map((reference) => {
          const element = labelRefs.current.get(referenceKey(reference))
          if (!element) return null
          if (typeof reference.anchor === 'string') {
            const part = model.parts.find((candidate) => candidate.name === reference.anchor)
            if (!part) return null
            anchorPosition(model, part, anchor)
          } else {
            anchor.set(...reference.anchor).applyMatrix4(model.stage.matrixWorld)
          }
          projected.copy(anchor).project(hologram.camera)
          if (projected.z > 1) return { element, x: NaN, y: NaN }
          return {
            element,
            x: (projected.x * 0.5 + 0.5) * viewWidth,
            y: (-projected.y * 0.5 + 0.5) * viewHeight,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => a.y - b.y)

      for (const entry of entries) {
        // The copy owns one side of the layout; an annotation that would land
        // on top of it is simply not drawn this frame.
        const hidden = Number.isNaN(entry.x) || inCopyZone(entry.x, entry.y, viewWidth, viewHeight)
        entry.element.style.visibility = hidden ? 'hidden' : 'visible'
        if (hidden) continue

        let y = entry.y
        for (let step = 0; step < 8; step++) {
          const clash = placed.some(
            (other) => Math.abs(other.x - entry.x) < 210 && Math.abs(other.y - y) < 22,
          )
          if (!clash) break
          y += 23
        }
        placed.push({ x: entry.x, y })
        entry.element.dataset.flip = entry.x > viewWidth * 0.5 ? '1' : '0'
        entry.element.style.transform = `translate3d(${entry.x}px, ${y}px, 0) translateY(-50%)`
      }
    }

    let currentChapter = 0
    let activeReferences: Reference[] = []

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now

      // Chapter tracking is cheap and independent from the timeline easing.
      const range = scrollTarget.scrollHeight - window.innerHeight
      const progress = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0
      const index = Math.round(progress * (CHAPTERS.length - 1))
      if (index !== chapterSeen) {
        chapterSeen = index
        currentChapter = index
        activeReferences = MODELS.find((model) => model.id === CHAPTERS[index].model)!.references
        setActiveIndex(index)
      }

      if (!reducedMotion) dirty = true
      if (!dirty && stage.length === 0) return
      dirty = false

      applyRig(stage, rig, hologram.camera, { time: (now - start) / 1000, delta })
      hologram.renderer.render(hologram.scene, hologram.camera)
      placeLabels()

      // Live readout: written straight to the DOM to avoid re-rendering React
      // sixty times a second.
      const readout = readoutRef.current
      if (readout) {
        const model = byId.get(CHAPTERS[currentChapter]?.model ?? 'rafale')
        const spin = model?.spins[0]
        const rpm = spin ? Math.round(rig[spin.key as keyof HologramRig] * spin.speed * 955) : 0
        readout.textContent = [
          `SCAN   ${String(Math.round(rig.scan * 100)).padStart(3, '0')}%`,
          spin ? `${spin.key === 'sensor' ? 'TURRET' : 'DRIVE '} ${String(rpm).padStart(4, '0')} RPM` : 'DRIVE   ---- RPM',
          `EXPL   ${String(Math.round(rig.explode * 100)).padStart(3, '0')}%`,
        ].join('\n')
      }
    }
    frame = requestAnimationFrame(loop)

    // --- teardown ----------------------------------------------------------
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      timeline.revert()
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

  return (
    <>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

      {/* Annotations: positioned every frame from their 3D anchors */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {activeModel.references.map((reference) => (
          <div
            key={referenceKey(reference)}
            ref={(element) => {
              if (element) labelRefs.current.set(referenceKey(reference), element)
              else labelRefs.current.delete(referenceKey(reference))
            }}
            data-flip="0"
            className="group absolute top-0 left-0 opacity-0 transition-opacity duration-500 will-change-transform"
          >
            <div className="flex items-center gap-2 group-data-[flip=1]:flex-row-reverse">
              <span className="size-1.5 shrink-0 rotate-45 bg-chalk shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
              <span className="h-px w-6 shrink-0 bg-steel/80 sm:w-10" />
              <span className="flex flex-col leading-tight whitespace-nowrap [text-shadow:0_1px_6px_rgba(0,0,0,0.95)]">
                <span className="font-mono text-[10px] tracking-[0.22em] text-chalk uppercase">
                  {reference.text}
                </span>
                {reference.value && (
                  <span className="font-mono text-[9px] tracking-[0.18em] text-mist/80 uppercase">
                    {reference.value}
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Live technical readout */}
      <div
        ref={readoutRef}
        className="pointer-events-none fixed top-20 right-6 hidden font-mono text-[10px] leading-relaxed tracking-[0.18em] whitespace-pre text-mist/80 uppercase md:block lg:right-10"
      />

      {/* Datasheet for the airframe in focus */}
      <div className="pointer-events-none fixed bottom-6 left-6 hidden font-mono text-[10px] tracking-[0.18em] text-mist/70 uppercase sm:left-12 md:block lg:left-24">
        <p className="text-chalk">{activeModel.serial}</p>
        <p className="mt-1">{activeModel.name}</p>
        <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
          {activeModel.specs.map(([key, value]) => (
            <div key={key} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-steel">{key}</dt>
              <dd className="text-mist/80">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 font-mono text-[9px] tracking-[0.14em] whitespace-nowrap text-steel/70">
          {activeModel.credit}
        </p>
      </div>

      <p
        aria-live="polite"
        className={`absolute inset-x-0 bottom-10 text-center font-mono text-xs tracking-[0.3em] text-steel uppercase transition-opacity duration-700 ${
          progress === null ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {progress && progress > 0 ? `Loading airframes ${progress}%` : 'Loading airframes'}
      </p>
    </>
  )
}

function referenceKey(reference: Reference) {
  return `${reference.text}-${reference.value ?? ''}`
}
