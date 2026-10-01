import { animate, onScroll, stagger } from 'animejs'
import { useEffect, useRef } from 'react'
import type { Chapter } from '../data/chapters'

interface ChapterBlockProps {
  chapter: Chapter
  index: number
}

/** Tailwind placement so the copy never sits on top of the airframe. */
const ALIGN: Record<Chapter['align'], string> = {
  left: 'md:content-center md:justify-items-start md:text-left',
  right: 'md:content-center md:justify-items-end md:text-left',
  center: 'md:content-end md:justify-items-center md:text-center md:pb-28',
}

/**
 * One full-viewport scroll stop. The copy fades/slides in when the chapter
 * enters the viewport and reverses when it leaves - driven by Anime.js's
 * ScrollObserver, no IntersectionObserver boilerplate.
 */
export function ChapterBlock({ chapter, index }: ChapterBlockProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveal = animate(el.querySelectorAll('[data-reveal]'), {
      opacity: [0, 1],
      y: [24, 0],
      delay: stagger(80),
      duration: 700,
      ease: 'outCubic',
      autoplay: onScroll({
        target: el,
        enter: '80% top', // chapter is 20% into view from the bottom
        leave: '20% bottom', // chapter is 80% scrolled out the top
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
      id={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
      className={`grid min-h-svh content-end overflow-x-clip px-6 pb-20 sm:px-12 lg:px-24 ${ALIGN[chapter.align]}`}
    >
      <div className="relative isolate max-w-md">
        {/* Soft scrim keeps the copy legible where the wireframe drifts behind
            it. A radial gradient (no filter) is essentially free while scrolling. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-20 -inset-y-14 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(6_6_7/0.92)_0%,rgb(6_6_7/0.65)_45%,transparent_78%)]"
        />
        <p
          data-reveal
          className="flex items-center gap-3 font-mono text-[11px] tracking-[0.3em] text-mist/70 uppercase"
        >
          <span className="inline-block h-px w-8 bg-steel md:hidden lg:inline-block" />
          {chapter.eyebrow}
        </p>
        <h2
          id={`${chapter.id}-title`}
          data-reveal
          className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-chalk text-balance sm:text-5xl lg:text-6xl"
        >
          {chapter.title}
        </h2>
        <p data-reveal className="mt-6 text-base leading-relaxed text-mist sm:text-lg">
          {chapter.body}
        </p>

        {chapter.stack && (
          <ul
            data-reveal
            className="mt-8 space-y-2 border-l border-steel/60 pl-4 font-mono text-[11px] tracking-[0.14em] text-mist/80 uppercase"
          >
            {chapter.stack.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {index === 0 && (
          <p data-reveal className="mt-10 font-mono text-xs tracking-widest text-steel uppercase">
            Scroll to explore
          </p>
        )}

        {chapter.id === 'contact' && (
          <div data-reveal className="mt-9 flex flex-wrap gap-3 md:justify-center">
            <a
              href="mailto:lucas.audoubert@edu.devinci.fr"
              className="rounded-none border border-chalk bg-chalk px-6 py-3 font-mono text-[11px] tracking-[0.2em] text-ink uppercase transition-colors hover:bg-transparent hover:text-chalk"
            >
              Écrire
            </a>
            <a
              href="https://github.com/LucasAudoubert"
              target="_blank"
              rel="noreferrer"
              className="rounded-none border border-steel px-6 py-3 font-mono text-[11px] tracking-[0.2em] text-chalk uppercase transition-colors hover:border-chalk"
            >
              GitHub
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
