import { animate, onScroll, stagger } from 'animejs'
import { useEffect, useRef } from 'react'
import type { Chapter } from '../data/chapters'
import { MODEL_BY_ID } from '../data/models'

interface ChapterBlockProps {
  chapter: Chapter
  index: number
}

/** Placement of the sticky panel; the airframe is framed on the other side. */
// Side padding keeps panels clear of the HUD tapes (speed left, altitude right).
const ALIGN: Record<Chapter['align'], string> = {
  left: 'md:items-center md:justify-start md:px-24 xl:pl-28',
  right: 'md:items-center md:justify-end md:px-24 xl:pr-44',
  center: 'md:items-end md:justify-center md:pb-24 md:px-24 xl:px-36',
}

/**
 * One scroll section. Its height is `span` viewports and the copy panel is
 * sticky, so the text holds still while the airframe goes through its beats
 * (assembled -> exploded -> callouts) behind and beside it.
 */
export function ChapterBlock({ chapter, index }: ChapterBlockProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const reveal = animate(el.querySelectorAll('[data-reveal]'), {
      opacity: [0, 1],
      y: [18, 0],
      delay: stagger(60),
      duration: 620,
      ease: 'outCubic',
      autoplay: onScroll({
        target: el,
        enter: '80% top', // section top passes 80% of the viewport
        leave: '20% bottom', // section bottom passes 20% of the viewport
        sync: 'play reverse',
      }),
    })
    return () => {
      reveal.revert()
    }
  }, [])

  const model = chapter.model ? MODEL_BY_ID[chapter.model] : null
  const wide = Boolean(chapter.waypoints)
  // Phones: a tall dossier panel can't be sticky - it would cover the airframe
  // for the whole section, and anything taller than the screen is clipped for
  // good (the flight plan). There the copy scrolls in normal flow at the top
  // of the section, then leaves the screen to the exploded view. One-screen
  // sections (hero, contact) keep the sticky panel at the bottom.
  const mobileLayout = chapter.span > 1 ? 'items-start pt-24 pb-10' : 'sticky h-svh items-end pb-16'

  return (
    <section
      ref={ref}
      id={chapter.id}
      aria-labelledby={`${chapter.id}-title`}
      style={{ height: `${chapter.span * 100}svh` }}
      className="pointer-events-none relative"
    >
      {/* The sticky layer spans the viewport but must not swallow clicks
          meant for the callout chips underneath - only the panel is live. */}
      <div
        className={`pointer-events-none top-0 flex justify-center px-5 sm:px-10 md:sticky md:h-svh md:pt-0 md:pb-0 ${mobileLayout} ${ALIGN[chapter.align]}`}
      >
        <div
          id={`panel-${chapter.id}`}
          className={`panel pointer-events-auto w-full ${wide ? 'max-w-[58rem]' : 'max-w-[30rem]'}`}
        >
          {/* Dossier header bar */}
          <div data-reveal className="tag -mx-7 -mt-7 mb-6 flex items-center justify-between gap-4 border-b border-chalk/10 px-7 py-2.5 text-[10px]">
            <span className="truncate text-chalk">
              [{chapter.code}] <span className="text-mist">{chapter.eyebrow}</span>
            </span>
            {model && <span className="hidden shrink-0 whitespace-nowrap text-steel sm:inline">{model.code}</span>}
          </div>

          <h2
            id={`${chapter.id}-title`}
            data-reveal
            className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.01em] text-chalk text-balance sm:text-[2.1rem] lg:text-[2.4rem]"
          >
            {chapter.title}
          </h2>

          <p data-reveal className={`mt-5 text-[15px] leading-[1.65] text-fog sm:text-base ${wide ? 'max-w-[44rem]' : ''}`}>
            {chapter.body}
          </p>

          {chapter.waypoints && <FlightPlan waypoints={chapter.waypoints} />}

          {chapter.roles && (
            <dl data-reveal className="mt-7 space-y-3 border-l border-steel/50 pl-4 font-mono text-[12px] tracking-[0.04em]">
              {chapter.roles.map((role) => (
                <div key={`${role.title}-${role.org}`}>
                  <dt className="text-[13px] font-medium tracking-[0.06em] text-chalk uppercase">{role.title}</dt>
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
              className={`mt-6 border-l border-steel/50 pl-4 font-mono text-[12px] tracking-[0.03em] text-mist ${
                wide ? 'grid gap-x-8 gap-y-1.5 sm:grid-cols-3' : 'space-y-1.5'
              }`}
            >
              {chapter.stack.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          {index === 0 && (
            <p data-reveal className="tag mt-8 flex items-center gap-3 text-steel">
              <span className="inline-block h-px w-8 bg-steel" />
              Scroll · 3 dossiers techniques
            </p>
          )}

          {chapter.id === 'contact' && (
            <div data-reveal className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:lucas.audoubert@edu.devinci.fr"
                className="pointer-events-auto border border-chalk bg-chalk px-6 py-3 font-mono text-[11px] tracking-[0.18em] text-ink uppercase transition-colors hover:bg-transparent hover:text-chalk"
              >
                lucas.audoubert@edu.devinci.fr
              </a>
              <a
                href="https://github.com/LucasAudoubert"
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto border border-steel px-6 py-3 font-mono text-[11px] tracking-[0.18em] text-chalk uppercase transition-colors hover:border-chalk"
              >
                GitHub
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Career as a flight plan: waypoints on a route line, like a nav display. */
function FlightPlan({ waypoints }: { waypoints: NonNullable<Chapter['waypoints']> }) {
  return (
    <ol data-reveal className="relative mt-8 grid gap-6 sm:grid-cols-5 sm:gap-3">
      {/* Route line */}
      <span aria-hidden="true" className="absolute top-[7px] right-[10%] left-[10%] hidden h-px bg-chalk/35 sm:block" />
      {waypoints.map((waypoint, index) => {
        const last = index === waypoints.length - 1
        return (
          <li key={waypoint.code} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 size-3.5 shrink-0 rotate-45 border sm:mt-0 ${
                last ? 'border-chalk bg-chalk shadow-[0_0_12px_rgba(255,255,255,0.6)]' : 'border-chalk bg-ink'
              }`}
            />
            <span className="flex flex-col gap-0.5 sm:mt-3">
              <span className="font-mono text-[10px] tracking-[0.2em] text-steel">
                {waypoint.code} · {waypoint.year}
              </span>
              <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-chalk uppercase">{waypoint.title}</span>
              <span className="text-[12px] leading-snug text-mist">{waypoint.org}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
