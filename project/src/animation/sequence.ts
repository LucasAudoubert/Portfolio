import { createTimeline, onScroll, type Timeline } from 'animejs'
import { CHAPTERS } from '../data/chapters'
import type { HologramRig } from '../three/hologram/rig'

/** Timeline time per chapter. Arbitrary - scroll drives the clock. */
const STEP = 1000

export interface ScrollTimelineOptions {
  /** Called whenever the rig changes, so the canvas can re-render on demand. */
  onUpdate: () => void
  /** Skip inertial smoothing for users who prefer reduced motion. */
  reducedMotion: boolean
}

/**
 * Builds ONE Anime.js timeline that scrubs the whole page.
 *
 *   scroll 0 ............................................ max scroll
 *   pose[0] --> pose[1] --> pose[2] --> ... --> pose[N-1]
 *
 * Chapter i sits in the middle of the viewport at scrollY = i * 100vh, which
 * maps to timeline time i * STEP, so the hologram is exactly in
 * `CHAPTERS[i].pose` while that chapter's copy is centred.
 *
 * A chapter may also declare `milestones`: extra poses reached *inside* its
 * own scroll range (at = 0.5 is halfway to the next chapter). That is how an
 * airframe is shown whole first and then comes apart as the reader continues,
 * instead of arriving already exploded.
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

  // Flatten every pose to the absolute time it must be reached at: the chapter
  // poses at i * STEP, then each milestone at (i + at) * STEP.
  const stops: Array<{ time: number; pose: Partial<HologramRig> }> = []
  CHAPTERS.forEach((chapter, index) => {
    stops.push({ time: index * STEP, pose: chapter.pose })
    for (const milestone of chapter.milestones ?? []) {
      stops.push({ time: (index + milestone.at) * STEP, pose: milestone.pose })
    }
  })
  stops.sort((a, b) => a.time - b.time)

  // One tween per interval, from the previous stop to this one. Segments must
  // never overlap: two tweens writing the same property would fight, and the
  // later one would win with whatever value it captured when it started.
  let cursor = 0
  for (const stop of stops) {
    if (stop.time <= cursor) continue
    tl.add(
      rig,
      { ...stripUndefined(stop.pose), duration: stop.time - cursor },
      cursor,
    )
    cursor = stop.time
  }

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
