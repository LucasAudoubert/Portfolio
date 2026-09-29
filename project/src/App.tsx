import { lazy, Suspense, useRef } from 'react'
import { ScrollRail } from './components/ScrollRail'
import { SectionBlock } from './components/SectionBlock'
import { SECTIONS } from './data/sections'

// Three.js is ~140 kB gzipped. Loading it lazily lets the copy paint first;
// the aircraft fades in a moment later without blocking the initial render.
const JetCanvas = lazy(() =>
  import('./components/JetCanvas').then((m) => ({ default: m.JetCanvas })),
)

/**
 * Page composition - three stacked layers:
 *
 *   z -10  static backdrop (fixed; never repaints on scroll)
 *   z   0  the aircraft canvas (fixed & centred; only the model moves)
 *   z  10  scrolling copy that drives the timeline
 */
export default function App() {
  // The <main> element's height defines the scroll range Anime.js maps to the
  // aircraft timeline. Refs are attached before effects run, so JetCanvas can
  // read it safely on mount.
  const mainRef = useRef<HTMLElement>(null)

  return (
    <>
      <div aria-hidden="true" className="bg-grid pointer-events-none fixed inset-0 -z-10" />

      <div className="pointer-events-none fixed inset-0 z-0">
        <Suspense fallback={null}>
          <JetCanvas scrollTargetRef={mainRef} />
        </Suspense>
      </div>

      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-12 lg:px-24">
        <a href="#hero" className="font-mono text-xs tracking-[0.3em] text-chalk uppercase">
          Flanker<span className="text-steel"> / Portfolio</span>
        </a>
        <a
          href="#contact"
          className="font-mono text-xs tracking-[0.3em] text-mist uppercase transition-colors hover:text-chalk"
        >
          Contact
        </a>
      </header>

      <main ref={mainRef} className="relative z-10">
        {SECTIONS.map((section, index) => (
          <SectionBlock key={section.id} section={section} index={index} />
        ))}
      </main>

      <ScrollRail scrollTargetRef={mainRef} />

      {/* CC BY-NC-SA 4.0 requires attribution for the aircraft model. */}
      <p className="fixed bottom-4 left-6 z-20 font-mono text-[10px] tracking-widest text-steel/70 uppercase sm:left-12 lg:left-24">
        Su-35 model by bohmerang / CC BY-NC-SA 4.0
      </p>
    </>
  )
}
