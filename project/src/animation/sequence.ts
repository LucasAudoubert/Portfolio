import { createTimeline, onScroll, type Timeline } from 'animejs'
import { CHAPTERS } from '../data/chapters'
import type { HologramRig } from '../three/hologram/rig'

/** Timeline time per chapter transition. Arbitrary - scroll drives the clock. */
const STEP = 1000

export interface ScrollTimelineOptions {
  /** Called whenever the rig changes, so the canvas can re-render on demand. */
  onUpdate: () => void
  /** Skip inertial smoothing for users who prefer reduced motion. */
  reducedMotion: boolean
}

/**
 * Builds ONE Anime.js timeline that scrubs the whole page:
 *
 *   scroll 0 ............................................ max scroll
 *   pose[0] --> pose[1] --> pose[2] --> ... --> pose[N-1]
 *
 * Chapter i sits in the middle of the viewport at scrollY = i * 100vh, which
 * maps to timeline time i * STEP, so the hologram is exactly in
 * `CHAPTERS[i].pose` while that chapter's copy is centred.
 *
 * `sync: 0.55` lerps the timeline toward the real scroll position each tick,
 * which reads as inertia without a single custom scroll listener.
 */
export function createScrollTimeline(
  rig: HologramRig,
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
  CHAPTERS.slice(1).forEach((chapter, i) => {
    tl.add(rig, stripUndefined(chapter.pose), i * STEP)
  })

  return tl
}

/** `Partial<HologramRig>` -> plain numeric record (Anime.js rejects undefined). */
function stripUndefined(pose: Partial<HologramRig>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(pose)) {
    if (typeof value === 'number') out[key] = value
  }
  return out
}
