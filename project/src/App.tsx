import { lazy, Suspense, useRef } from 'react'
import { ScrollRail } from './components/ScrollRail'
import { ChapterBlock } from './components/ChapterBlock'
import { CHAPTERS } from './data/chapters'

// Three.js is ~150 kB gzipped. Loading it lazily lets the copy paint first;
// the hologram fades in a moment later without blocking the initial render.
const HologramStage = lazy(() =>
  import('./components/HologramStage').then((m) => ({ default: m.HologramStage })),
)

/**
 * Page composition - three stacked layers:
 *
 *   z -10  static blueprint backdrop (fixed; never repaints on scroll)
 *   z   0  the hologram canvas (fixed & centred; only the airframes move)
 *   z  10  scrolling copy that drives the sequence
 */
export default function App() {
  // The <main> element's height defines the scroll range Anime.js maps to the
  // hologram timeline. The ref is attached before effects run, so the stage can
  // read it safely on mount.
  const mainRef = useRef<HTMLElement>(null)

  return (
    <>
      {/* Blueprint backdrop: grid + vignette, both static */}
      <div aria-hidden="true" className="bg-grid pointer-events-none fixed inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(6_6_7/0.85)_100%)]"
      />
      {/* Corner brackets: the drawing frame */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-4 z-30 hidden md:block">
        {[
          'top-0 left-0 border-t border-l',
          'top-0 right-0 border-t border-r',
          'bottom-0 left-0 border-b border-l',
          'bottom-0 right-0 border-b border-r',
        ].map((corner) => (
          <span key={corner} className={`absolute size-4 border-steel/50 ${corner}`} />
        ))}
      </div>

      <div className="pointer-events-none fixed inset-0 z-0">
        <Suspense fallback={null}>
          <HologramStage scrollTargetRef={mainRef} />
        </Suspense>
      </div>

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-20">
        <a href="#hero" className="tag text-chalk transition-colors hover:text-white">
          Lucas Audoubert
          <span className="text-steel"> / Portfolio</span>
        </a>
        <nav className="flex items-center gap-7">
          <a
            href="https://github.com/LucasAudoubert/Portfolio"
            target="_blank"
            rel="noreferrer"
            className="tag hidden text-mist transition-colors hover:text-chalk sm:block"
          >
            GitHub
          </a>
          <a href="#contact" className="tag text-mist transition-colors hover:text-chalk">
            Contact
          </a>
        </nav>
      </header>

      {/* pointer-events-none: <main> spans the whole page above the stage, so it
          would swallow clicks meant for the callout chips. Only the panels opt
          back in (pointer-events-auto in ChapterBlock).
          z-3 sits above the hologram but BELOW the HUD (z-5), so a panel
          scrolling past occludes the HUD rather than stacking over it. */}
      <main ref={mainRef} className="pointer-events-none relative z-[3]">
        {CHAPTERS.map((chapter, index) => (
          <ChapterBlock key={chapter.id} chapter={chapter} index={index} />
        ))}
      </main>

      <ScrollRail scrollTargetRef={mainRef} />
    </>
  )
}
