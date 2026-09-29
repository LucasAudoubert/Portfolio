import { createTimeline, onScroll, type Timeline } from 'animejs'
import { SECTIONS } from '../data/sections'
import type { JetRig } from '../three/rig'

/** Timeline time per section transition. Arbitrary - scroll drives the clock. */
const STEP = 1000

export interface ScrollTimelineOptions {
  /** Called every time the rig changes so the canvas can re-render on demand. */
  onUpdate: () => void
  /** Skip the inertial smoothing for users who prefer reduced motion. */
  reducedMotion: boolean
}

/**
 * Builds ONE Anime.js timeline that scrubs the whole page:
 *
 *   scroll 0 ............................................ max scroll
 *   pose[0] --> pose[1] --> pose[2] --> ... --> pose[N-1]
 *
 * Section i is centred in the viewport at scrollY = i * 100vh, which maps to
 * timeline time i * STEP, so the aircraft is exactly in `SECTIONS[i].pose`
 * when the reader is looking at that section's copy.
 *
 * `sync: 0.55` lerps the timeline toward the real scroll position each tick,
 * giving the aircraft inertia without any custom scroll listeners.
 */
export function createScrollTimeline(
  rig: JetRig,
  scrollTarget: HTMLElement,
  { onUpdate, reducedMotion }: ScrollTimelineOptions,
): Timeline {
  const tl = createTimeline({
    autoplay: onScroll({
      target: scrollTarget,
      // '<container threshold> <target threshold>'
      enter: 'top top', // scrollY = 0
      leave: 'bottom bottom', // scrollY = max
      sync: reducedMotion ? true : 0.55,
    }),
    defaults: { ease: 'inOutSine', duration: STEP },
    onUpdate,
  })

  // Each .add() tweens only the keys present in the pose; untouched keys hold
  // their previous value. Anime.js resolves each tween's start value from the
  // previous sibling on the same property, so partial poses compose cleanly.
  SECTIONS.slice(1).forEach((section, i) => {
    tl.add(rig, stripUndefined(section.pose), i * STEP)
  })

  return tl
}

/** `Partial<JetRig>` -> plain numeric record (Anime.js rejects `undefined`). */
function stripUndefined(pose: Partial<JetRig>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(pose)) {
    if (typeof value === 'number') out[key] = value
  }
  return out
}
