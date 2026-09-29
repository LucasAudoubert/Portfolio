import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { createScrollTimeline } from '../animation/scrollTimeline'
import { createJetScene } from '../three/createScene'
import { loadSu35, type JetModel, type JetLabel } from '../three/loadSu35'
import { INITIAL_RIG, applyRig, type JetRig } from '../three/rig'

interface JetCanvasProps {
  /** The tall scrolling element whose scroll position drives the animation. */
  scrollTargetRef: RefObject<HTMLElement | null>
}

/**
 * Fixed, full-viewport WebGL layer that renders the Su-35, plus the part
 * labels used by the exploded view.
 *
 * Everything imperative (Three.js + Anime.js) lives inside one effect so React
 * only owns the <canvas> and the label elements. The effect is fully
 * reversible, which keeps StrictMode's mount -> unmount -> mount cycle safe.
 */
export function JetCanvas({ scrollTargetRef }: JetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef(new Map<string, HTMLDivElement>())
  const [labels, setLabels] = useState<JetLabel[]>([])
  const [progress, setProgress] = useState<number | null>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const scrollTarget = scrollTargetRef.current
    const host = canvas?.parentElement
    if (!canvas || !scrollTarget || !host) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // --- Scene -----------------------------------------------------------
    const jetScene = createJetScene(canvas)

    // --- Animation state --------------------------------------------------
    const rig: JetRig = { ...INITIAL_RIG }
    let dirty = true
    const markDirty = () => {
      dirty = true
    }

    const timeline = createScrollTimeline(rig, scrollTarget, {
      onUpdate: markDirty,
      reducedMotion,
    })

    // --- Sizing -----------------------------------------------------------
    let viewWidth = host.clientWidth
    let viewHeight = host.clientHeight
    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      viewWidth = width
      viewHeight = height
      jetScene.resize(width, height)
      markDirty()
    })
    resizeObserver.observe(host)

    // --- Model loading ----------------------------------------------------
    let model: JetModel | null = null
    let disposed = false
    let lastPercent = -1

    loadSu35((ratio) => {
      const percent = ratio > 0 ? Math.round(ratio * 100) : 0
      if (disposed || percent === lastPercent) return
      lastPercent = percent
      setProgress(percent)
    })
      .then((loaded) => {
        if (disposed) {
          loaded.dispose()
          return
        }
        model = loaded
        jetScene.scene.add(loaded.root)
        setLabels(loaded.labels)
        setProgress(null)
        markDirty()
      })
      .catch((error: unknown) => {
        console.error('Failed to load the Su-35 model', error)
        if (!disposed) setProgress(null)
      })

    // --- Render loop ------------------------------------------------------
    // Idle hover keeps the jet alive between scrolls. With reduced motion we
    // skip it entirely and only draw when the scroll rig actually changed.
    const idle = { bob: 0, sway: 0, pulse: 0 }
    const projected = new THREE.Vector3()
    let labelsShown = false
    let frame = 0

    /** Positions the DOM labels on their 3D anchors (only while exploded). */
    const projectLabels = (loaded: JetModel) => {
      const show = rig.explode > 0.15
      if (show !== labelsShown) {
        labelsShown = show
        for (const element of labelRefs.current.values()) {
          element.style.opacity = show ? '1' : '0'
        }
      }
      if (!show) return

      // Project every anchor first, then push overlapping labels apart so the
      // part names stay readable in the exploded view.
      const placed: Array<{ x: number; y: number }> = []
      const entries = loaded.labels
        .map((label) => {
          const element = labelRefs.current.get(label.id)
          if (!element) return null
          label.marker.getWorldPosition(projected).project(jetScene.camera)
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
        if (Number.isNaN(entry.x)) {
          entry.element.style.opacity = '0'
          continue
        }
        let y = entry.y
        // Keep labels clear of each other and of the bottom-centred copy.
        const inCopy = () =>
          entry.x > viewWidth * 0.2 &&
          entry.x < viewWidth * 0.8 &&
          y > viewHeight * 0.66
        for (let step = 0; step < 6 && inCopy(); step++) y -= 22
        for (let step = 0; step < 6; step++) {
          const clash = placed.some(
            (other) => Math.abs(other.x - entry.x) < 190 && Math.abs(other.y - y) < 20,
          )
          if (!clash) break
          y += 21
        }
        placed.push({ x: entry.x, y })
        entry.element.dataset.flip = entry.x > viewWidth * 0.55 ? '1' : '0'
        entry.element.style.transform = `translate3d(${entry.x}px, ${y}px, 0) translateY(-50%)`
      }
    }

    if (import.meta.env.DEV) {
      // Dev-only handle for tuning camera framing from the console.
      ;(window as unknown as Record<string, unknown>).__jet = {
        rig,
        camera: jetScene.camera,
        timeline,
        get model() {
          return model
        },
      }
    }

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop)

      if (!reducedMotion) {
        const t = time * 0.001
        idle.bob = Math.sin(t * 0.9) * 0.06
        idle.sway = Math.sin(t * 0.6 + 1.3) * 0.012
        idle.pulse = 0.5 + 0.5 * Math.sin(t * 11.3) * Math.sin(t * 4.1 + 0.7)
        dirty = true
      }

      if (!dirty || !model) return
      dirty = false

      applyRig(model, rig, jetScene.camera, idle)
      jetScene.renderer.render(jetScene.scene, jetScene.camera)
      projectLabels(model)
    }
    frame = requestAnimationFrame(loop)

    // --- Teardown ---------------------------------------------------------
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      timeline.revert() // also reverts the linked ScrollObserver
      if (model) {
        jetScene.scene.remove(model.root)
        model.dispose()
        model = null
      }
      jetScene.dispose()
    }
  }, [scrollTargetRef])

  return (
    <>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />

      {/* Exploded-view part labels (positions written by the render loop) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((label) => (
          <div
            key={label.id}
            ref={(element) => {
              if (element) labelRefs.current.set(label.id, element)
              else labelRefs.current.delete(label.id)
            }}
            data-flip="0"
            className="group absolute top-0 left-0 opacity-0 transition-opacity duration-700 will-change-transform"
          >
            <div className="flex items-center gap-2 group-data-[flip=1]:flex-row-reverse">
              <span className="size-1.5 shrink-0 rounded-full bg-chalk shadow-[0_0_6px_rgba(255,255,255,0.55)]" />
              <span className="h-px w-5 shrink-0 bg-steel shadow-[0_0_4px_rgba(0,0,0,0.9)] sm:w-9" />
              <span className="font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-chalk uppercase [text-shadow:0_1px_4px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.8)]">
                {label.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p
        aria-live="polite"
        className={`absolute inset-x-0 bottom-10 text-center font-mono text-xs tracking-[0.3em] text-steel uppercase transition-opacity duration-700 ${
          progress === null ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {progress && progress > 0 ? `Loading airframe ${progress}%` : 'Loading airframe'}
      </p>
    </>
  )
}
