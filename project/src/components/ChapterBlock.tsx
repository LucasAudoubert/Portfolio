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
  center: 'md:content-end md:justify-items-center md:text-center md:pb-24',
}

/**
 * One full-viewport scroll stop.
 *
 * The copy sits on an opaque technical plate (`.panel`): the wireframe is
 * dense and bright, so a translucent scrim was not enough to keep text
 * readable. The reveal animation is driven by Anime.js's ScrollObserver - no
 * IntersectionObserver boilerplate.
 */
export function ChapterBlock({ chapter, index }: ChapterBlockProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveal = animate(el.querySelectorAll('[data-reveal]'), {
      opacity: [0, 1],
      y: [22, 0],
      delay: stagger(70),
      duration: 680,
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
      className={`grid min-h-svh content-end overflow-x-clip px-5 pb-16 sm:px-10 md:pb-20 lg:px-20 ${ALIGN[chapter.align]}`}
    >
      <div className="panel w-full max-w-[30rem]">
        <p data-reveal className="tag text-mist">
          {chapter.eyebrow}
        </p>

        <h2
          id={`${chapter.id}-title`}
          data-reveal
          className="mt-4 text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.01em] text-chalk text-balance sm:text-[2.1rem] lg:text-[2.4rem]"
        >
          {chapter.title}
        </h2>

        <p data-reveal className="mt-5 text-[15px] leading-[1.65] text-fog sm:text-base">
          {chapter.body}
        </p>

        {chapter.roles && (
          <dl
            data-reveal
            className="mt-7 space-y-3 border-l border-steel/50 pl-4 font-mono text-[12px] tracking-[0.04em]"
          >
            {chapter.roles.map((role) => (
              <div key={`${role.title}-${role.org}`}>
                <dt className="text-[13px] font-medium tracking-[0.06em] text-chalk uppercase">
                  {role.title}
                </dt>
                <dd className="mt-0.5 text-mist">
                  {role.org}
                  <span className="text-steel"> · {role.period}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {chapter.stack && (
          <ul
            data-reveal
            className="mt-6 space-y-1.5 border-l border-steel/50 pl-4 font-mono text-[12px] tracking-[0.03em] text-mist"
          >
            {chapter.stack.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {index === 0 && (
          <p data-reveal className="tag mt-8 text-steel">
            Scroll to explore
          </p>
        )}

        {chapter.id === 'contact' && (
          <div data-reveal className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:lucas.audoubert@edu.devinci.fr"
              className="border border-chalk bg-chalk px-6 py-3 font-mono text-[11px] tracking-[0.18em] text-ink uppercase transition-colors hover:bg-transparent hover:text-chalk"
            >
              lucas.audoubert@edu.devinci.fr
            </a>
            <a
              href="https://github.com/LucasAudoubert"
              target="_blank"
              rel="noreferrer"
              className="border border-steel px-6 py-3 font-mono text-[11px] tracking-[0.18em] text-chalk uppercase transition-colors hover:border-chalk"
            >
              GitHub
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
