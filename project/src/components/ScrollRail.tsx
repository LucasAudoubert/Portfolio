import { animate, onScroll, type ScrollObserver } from 'animejs'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { SECTIONS } from '../data/sections'

interface ScrollRailProps {
  scrollTargetRef: RefObject<HTMLElement | null>
}

/**
 * Right-hand navigation rail: a scroll-synced progress line plus one dot per
 * section. The active dot is set by ScrollObserver enter callbacks - each
 * section "owns" the viewport centre while it covers it.
 */
export function ScrollRail({ scrollTargetRef }: ScrollRailProps) {
  const lineRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(SECTIONS[0].id)

  // Progress line: scaleY 0 -> 1 across the whole document, hard-synced.
  useEffect(() => {
    const line = lineRef.current
    const target = scrollTargetRef.current
    if (!line || !target) return

    const progress = animate(line, {
      scaleY: [0, 1],
      ease: 'linear',
      autoplay: onScroll({ target, enter: 'top top', leave: 'bottom bottom', sync: true }),
    })
    return () => {
      progress.revert()
    }
  }, [scrollTargetRef])

  // Active-section tracking.
  useEffect(() => {
    const observers: ScrollObserver[] = SECTIONS.map((s) =>
      onScroll({
        target: `#${s.id}`,
        enter: 'center top', // viewport centre passes the section's top
        leave: 'center bottom', // ...and its bottom
        onEnter: () => setActive(s.id),
      }),
    )
    return () => {
      observers.forEach((o) => o.revert())
    }
  }, [])

  return (
    <nav
      aria-label="Sections"
      className="fixed top-1/2 right-4 z-20 hidden -translate-y-1/2 items-center gap-4 md:flex lg:right-8"
    >
      {/* Track + progress line */}
      <span className="relative block h-48 w-px bg-steel/40">
        <span
          ref={lineRef}
          className="absolute inset-0 origin-top bg-chalk"
          style={{ transform: 'scaleY(0)' }}
        />
      </span>

      <ul className="flex flex-col gap-3">
        {SECTIONS.map((s, i) => {
          const isActive = s.id === active
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-label={`Go to section ${i + 1}: ${s.title}`}
                aria-current={isActive ? 'true' : undefined}
                className={`block size-2 rounded-full transition-all duration-300 ${
                  isActive ? 'scale-125 bg-chalk' : 'bg-steel hover:bg-mist'
                }`}
              />
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
