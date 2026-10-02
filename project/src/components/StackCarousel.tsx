import type { CSSProperties } from 'react'
import { STACK, STACK_COUNT, type StackItem } from '../data/stack'

/**
 * The stack, as a two-row marquee running in opposite directions.
 *
 * Every icon is a coloured brand SVG forced to white (`brightness(0)
 * invert(1)`) so the carousel stays inside the monochrome palette. Each row is
 * duplicated once and translated by -50% on a loop, which makes the wrap
 * seamless without measuring anything in JS.
 *
 * The animation is pure CSS: it costs nothing while the page scrolls, and it
 * stops for `prefers-reduced-motion` (the CSS is in index.css).
 */
export function StackCarousel() {
  return (
    <div data-reveal className="mt-7 space-y-6">
      {STACK.map((row, index) => (
        <div key={row.label}>
          <p className="tag mb-2.5 flex items-center gap-3 text-[10px] text-steel">
            <span className="inline-block h-px w-5 bg-steel" />
            {row.label}
            <span className="text-steel/70">{String(row.items.length).padStart(2, '0')}</span>
          </p>
          <Marquee items={row.items} reverse={index === 1} seconds={index === 0 ? 46 : 54} />
        </div>
      ))}
    </div>
  )
}

interface MarqueeProps {
  items: StackItem[]
  /** Second row travels the other way. */
  reverse?: boolean
  seconds: number
}

function Marquee({ items, reverse, seconds }: MarqueeProps) {
  return (
    <div className="stack-marquee relative overflow-hidden border-y border-chalk/10 py-3">
      <div
        className="stack-marquee__track flex w-max"
        style={{ '--marquee-duration': `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' } as CSSProperties}
      >
        {/* Duplicated set: the loop is seamless over exactly 50% of the track. */}
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-stretch">
            {items.map((item) => (
              <li key={`${copy}-${item.name}`} className="group flex w-[104px] shrink-0 flex-col items-center gap-2">
                {/* Chip plate: gives dark icons a surface to sit on and keeps
                    the row on the panel's grid. Icons stay desaturated until
                    hovered - a wall of brand colours would fight the palette,
                    but flattening them to plain white loses their glyphs. */}
                <span className="flex size-11 items-center justify-center border border-chalk/10 bg-chalk/[0.04] transition-colors duration-300 group-hover:border-chalk/40 group-hover:bg-chalk/[0.09]">
                  <img
                    src={`${import.meta.env.BASE_URL}stack/${item.icon}`}
                    alt={copy === 0 ? item.name : ''}
                    width={26}
                    height={26}
                    loading="lazy"
                    decoding="async"
                    className="h-[26px] w-[26px] opacity-70 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0 group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.35)]"
                  />
                </span>
                <span className="font-mono text-[10px] tracking-[0.12em] whitespace-nowrap text-steel uppercase transition-colors group-hover:text-chalk">
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      {/* Edge fades so icons enter and leave the frame instead of being cut. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent"
      />
    </div>
  )
}

/** Caption shown under the carousel. */
export function StackCaption() {
  return (
    <p className="tag mt-5 text-[10px] text-steel">
      {STACK_COUNT} technologies · survolez pour mettre en pause
    </p>
  )
}
