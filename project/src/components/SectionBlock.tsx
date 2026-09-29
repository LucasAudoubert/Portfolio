import { animate, onScroll, stagger } from 'animejs'
import { useEffect, useRef } from 'react'
import type { Section } from '../data/sections'

interface SectionBlockProps {
  section: Section
  index: number
}

/** Tailwind placement so the copy never sits on top of the aircraft. */
const ALIGN: Record<Section['align'], string> = {
  left: 'md:content-center md:justify-items-start md:text-left',
  right: 'md:content-center md:justify-items-end md:text-left',
  center: 'md:content-end md:justify-items-center md:text-center md:pb-28',
}

/**
 * One full-viewport scroll stop. The copy fades/slides in when the section
 * enters the viewport and reverses when it leaves - driven by Anime.js's
 * ScrollObserver, no IntersectionObserver boilerplate.
 */
export function SectionBlock({ section, index }: SectionBlockProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveal = animate(el.querySelectorAll('[data-reveal]'), {
      opacity: [0, 1],
      y: [28, 0],
      delay: stagger(90),
      duration: 700,
      ease: 'outCubic',
      autoplay: onScroll({
        target: el,
        enter: '80% top', // section is 20% into view from the bottom
        leave: '20% bottom', // section is 80% scrolled out the top
        sync: 'play reverse',
      }),
    })

    return () => {
      reveal.revert()
    }
  }, [])

  return (
    <section
      ref={ref}
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className={`grid min-h-svh content-end overflow-x-clip px-6 pb-20 sm:px-12 lg:px-24 ${ALIGN[section.align]}`}
    >
      <div className="relative isolate max-w-md">
        {/* Soft scrim keeps the copy legible if the airframe drifts behind it
            on narrow viewports. A radial gradient (no filter) is essentially
            free to composite while scrolling. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-20 -inset-y-14 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(10_10_11/0.9)_0%,rgb(10_10_11/0.6)_45%,transparent_75%)]"
        />
        <p data-reveal className="font-mono text-xs tracking-[0.3em] text-mist/70 uppercase">
          {section.eyebrow}
        </p>
        <h2
          id={`${section.id}-title`}
          data-reveal
          className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-chalk text-balance sm:text-5xl lg:text-6xl"
        >
          {section.title}
        </h2>
        <p data-reveal className="mt-6 text-base leading-relaxed text-mist sm:text-lg">
          {section.body}
        </p>

        {index === 0 && (
          <p data-reveal className="mt-10 font-mono text-xs tracking-widest text-steel uppercase">
            Scroll to explore
          </p>
        )}

        {section.id === 'contact' && (
          <div data-reveal className="mt-8 flex flex-wrap gap-3 md:justify-center">
            <a
              href="mailto:hello@example.com"
              className="rounded-full bg-chalk px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-white"
            >
              Get in touch
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-steel px-6 py-3 text-sm font-medium text-chalk transition-colors hover:border-chalk"
            >
              GitHub
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
