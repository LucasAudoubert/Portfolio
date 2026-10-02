import { animate, onScroll, type ScrollObserver } from 'animejs'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { CHAPTERS, chapterLayout } from '../data/chapters'

interface ScrollRailProps {
  scrollTargetRef: RefObject<HTMLElement | null>
}

/** Tape height in px. */
const TAPE = 320

/**
 * Right-hand navigation as an altitude tape: one waypoint per section placed
 * at its real scroll position, and a caret with an ALT readout riding the
 * page progress. Still plain links underneath, so it stays navigable.
 */
export function ScrollRail({ scrollTargetRef }: ScrollRailProps) {
  const caretRef = useRef<HTMLDivElement>(null)
  const altRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(CHAPTERS[0].id)

  const { starts, total } = chapterLayout()
  const range = Math.max(1, total - 1)

  useEffect(() => {
    const target = scrollTargetRef.current
    if (!target) return
    const state = { progress: 0 }
    const tracker = animate(state, {
      progress: [0, 1],
      ease: 'linear',
      autoplay: onScroll({ target, enter: 'top top', leave: 'bottom bottom', sync: true }),
      onUpdate: () => {
        if (caretRef.current) caretRef.current.style.transform = `translate3d(0, ${(state.progress * TAPE).toFixed(1)}px, 0)`
        if (altRef.current) altRef.current.textContent = String(Math.round(2000 + state.progress * 38000)).padStart(5, '0')
      },
    })
    return () => {
      tracker.revert()
    }
  }, [scrollTargetRef])

  useEffect(() => {
    const observers: ScrollObserver[] = CHAPTERS.map((chapter) =>
      onScroll({
        target: `#${chapter.id}`,
        enter: 'center top',
        leave: 'center bottom',
        onEnter: () => setActive(chapter.id),
        onEnterBackward: () => setActive(chapter.id),
      }),
    )
    return () => {
      observers.forEach((observer) => observer.revert())
    }
  }, [])

  return (
    <nav
      aria-label="Sections"
      className="fixed top-1/2 right-5 z-20 hidden -translate-y-1/2 md:block lg:right-8"
      style={{ height: TAPE }}
    >
      {/* Tape spine + graduations */}
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-fog/35" />
      {Array.from({ length: 33 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute right-0 h-px bg-fog/40 ${i % 4 === 0 ? 'w-3' : 'w-1.5'}`}
          style={{ top: (i / 32) * TAPE }}
        />
      ))}

      {/* Waypoints */}
      <ul>
        {CHAPTERS.map((chapter, index) => {
          const isActive = chapter.id === active
          return (
            <li
              key={chapter.id}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: Math.min(1, starts[index] / range) * TAPE }}
            >
              <a
                href={`#${chapter.id}`}
                aria-label={`Aller à la section ${chapter.code} : ${chapter.title}`}
                aria-current={isActive ? 'true' : undefined}
                className="group flex items-center gap-2 pr-4"
              >
                <span
                  className={`font-mono text-[10px] tracking-[0.18em] transition-colors ${
                    isActive ? 'text-chalk' : 'text-steel group-hover:text-fog'
                  }`}
                >
                  WP{chapter.code}
                </span>
                <span
                  className={`block size-2 rotate-45 border transition-all ${
                    isActive ? 'border-chalk bg-chalk' : 'border-fog/60 bg-ink group-hover:border-chalk'
                  }`}
                />
              </a>
            </li>
          )
        })}
      </ul>

      {/* Caret + altitude readout */}
      <div ref={caretRef} aria-hidden="true" className="absolute top-0 right-0 will-change-transform">
        <div className="absolute top-0 right-[1px] h-0 w-0 -translate-y-1/2 border-y-[5px] border-r-[7px] border-y-transparent border-r-chalk" />
        <div className="absolute top-0 right-3 -translate-y-1/2 border border-chalk/70 bg-ink/90 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-chalk">
          ALT <span ref={altRef}>02000</span>
        </div>
      </div>
    </nav>
  )
}
