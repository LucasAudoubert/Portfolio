import { createTimeline, onScroll, type Timeline } from 'animejs'
import { CHAPTERS, chapterLayout, type Chapter } from '../data/chapters'
import type { HologramRig } from '../three/hologram/rig'

/** Timeline time per viewport height of scroll. Arbitrary - scroll drives the clock. */
export const STEP = 1000

/**
 * Hand-off between two airframes, in viewport heights before the next
 * section reaches the top of the viewport:
 *
 *   -0.80  callouts gone, outgoing airframe still fully printed
 *   -0.42  outgoing airframe erased (reveal cut swept down)
 *   -0.40  stage empty: mechanisms snap to the next arrival pose
 *    0.00  incoming airframe fully printed (reveal cut swept up)
 *
 * At no point are two airframes on stage together.
 */
const HANDOFF_OUT = 0.8
const HANDOFF_ERASED = 0.42
const HANDOFF_RESET = 0.4

export interface ScrollTimelineOptions {
  onUpdate: () => void
  reducedMotion: boolean
}

type Stop = { time: number; pose: Partial<HologramRig> }

/** Mechanism channels that are reset (not animated) while the stage is empty. */
const SNAP_KEYS = ['explode', 'labels', 'canopy', 'gear', 'yaw', 'pitch', 'roll', 'posY'] as const

function snapPose(chapter: Chapter): Partial<HologramRig> {
  const out: Partial<HologramRig> = {}
  for (const key of SNAP_KEYS) {
    const value = chapter.pose[key]
    if (typeof value === 'number') out[key] = value
  }
  return out
}

/** Every pose the rig must reach, at absolute timeline times. */
export function buildStops(): Stop[] {
  const { starts } = chapterLayout()
  const stops: Stop[] = []

  CHAPTERS.forEach((chapter, index) => {
    const start = starts[index]
    const previous = CHAPTERS[index - 1]

    if (previous && previous.model !== chapter.model) {
      if (previous.model) {
        stops.push({ time: start - HANDOFF_OUT, pose: { labels: 0, [previous.model]: 1 } })
      }
      const erased: Partial<HologramRig> = {}
      if (previous.model) erased[previous.model] = 0
      if (chapter.model) erased[chapter.model] = 0
      stops.push({ time: start - HANDOFF_ERASED, pose: erased })
      stops.push({ time: start - HANDOFF_RESET, pose: snapPose(chapter) })
    }

    stops.push({ time: start, pose: chapter.pose })

    for (const milestone of chapter.milestones ?? []) {
      if (import.meta.env.DEV && milestone.at > chapter.span - HANDOFF_OUT) {
        console.warn(`[sequence] ${chapter.id}: milestone at ${milestone.at} overlaps the hand-off`)
      }
      stops.push({ time: start + milestone.at, pose: milestone.pose })
    }
  })

  return stops.sort((a, b) => a.time - b.time)
}

/**
 * ONE Anime.js timeline scrubbed by the whole page. Time is measured in
 * viewport heights scrolled (x STEP): a section whose top reaches the top of
 * the viewport is at `start * STEP`.
 *
 * Segments are strictly sequential - each stop tweens from the previous stop
 * to itself. Two tweens writing the same property at the same time would
 * fight, and the later one would win with a stale start value.
 */
export function createScrollTimeline(
  rig: HologramRig,
  scrollTarget: HTMLElement,
  { onUpdate, reducedMotion }: ScrollTimelineOptions,
): Timeline {
  const tl = createTimeline({
    autoplay: onScroll({
      target: scrollTarget,
      enter: 'top top',
      leave: 'bottom bottom',
      sync: reducedMotion ? true : 0.6,
    }),
    defaults: { ease: 'inOutSine' },
    onUpdate,
  })

  let cursor = 0
  for (const stop of buildStops()) {
    if (stop.time <= cursor) continue
    const values = numeric(stop.pose)
    if (Object.keys(values).length === 0) continue
    tl.add(rig, { ...values, duration: (stop.time - cursor) * STEP }, cursor * STEP)
    cursor = stop.time
  }

  // The scroll range is (total - 1) viewport heights; make the timeline match
  // it exactly so `top top -> bottom bottom` maps 1:1 onto section starts.
  const { total } = chapterLayout()
  const end = (total - 1) * STEP
  if (cursor * STEP < end) tl.add(rig, { glow: rig.glow, duration: end - cursor * STEP }, cursor * STEP)

  return tl
}

function numeric(pose: Partial<HologramRig>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(pose)) {
    if (typeof value === 'number') out[key] = value
  }
  return out
}
