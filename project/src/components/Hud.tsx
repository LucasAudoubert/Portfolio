import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'

/** Values pushed by the render loop every frame. */
export interface HudState {
  /** Degrees, 0..360 - where the camera is looking. */
  heading: number
  /** Scroll speed. */
  speed: number
  /** Accumulated scroll distance (moves the speed tape). */
  travel: number
  scan: number
  explode: number
  focused: boolean
}

export interface HudHandle {
  update(state: HudState): void
}

/** The card in the bottom corner: which dossier's facts are on screen. */
export interface HudProfile {
  code: string
  rows: Array<[string, string]>
  /** The 3D maquette on stage, credited discreetly. */
  maquette: string | null
  /** Status strip mode. */
  mode: string
}

interface HudProps {
  ref?: Ref<HudHandle>
  profile: HudProfile
  booted: boolean
  /** Bottom corner for the card: the one the copy panel leaves free. */
  dataSide: 'left' | 'right'
}

/** Heading tape geometry: pixels per degree and visible window width. */
const PX_PER_DEG = 4.2
const HEADING_WINDOW = 440
/** Speed tape: pixels per knot. */
const PX_PER_KT = 2.2

const pad = (value: number, size: number) => String(Math.round(value)).padStart(size, '0')

/**
 * Fighter-style head-up display framing the stage: heading tape, speed tape,
 * system readout, target data and a status strip.
 *
 * Monochrome on purpose (the blueprint palette): a real HUD is green because
 * of the combiner glass, not because green reads as "aviation".
 */
export function Hud({ ref, profile, booted, dataSide }: HudProps) {
  const headingStrip = useRef<HTMLDivElement>(null)
  const headingValue = useRef<HTMLSpanElement>(null)
  const speedStrip = useRef<HTMLDivElement>(null)
  const speedValue = useRef<HTMLSpanElement>(null)
  const sysRef = useRef<HTMLPreElement>(null)
  const [clock, setClock] = useState(() => utc())

  useImperativeHandle(
    ref,
    () => ({
      update(state) {
        const heading = ((state.heading % 360) + 360) % 360
        if (headingStrip.current) {
          const x = HEADING_WINDOW / 2 - (heading + 180) * PX_PER_DEG
          headingStrip.current.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`
        }
        if (headingValue.current) headingValue.current.textContent = pad(heading, 3)

        if (speedStrip.current) {
          const y = (state.travel * PX_PER_KT) % (PX_PER_KT * 50)
          speedStrip.current.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`
        }
        if (speedValue.current) speedValue.current.textContent = pad(state.speed, 3)

        if (sysRef.current) {
          sysRef.current.textContent = [
            `BALAYAGE  ${pad(state.scan * 100, 3)}%`,
            `ÉCLATÉ    ${pad(state.explode * 100, 3)}%`,
            state.focused ? 'CAMERA    CADRÉE' : 'CAMERA    LIBRE',
          ].join('\n')
        }
      },
    }),
    [],
  )

  useEffect(() => {
    const id = window.setInterval(() => setClock(utc()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Heading ticks: -180..540 so any heading has a full window on both sides.
  const headingTicks = useMemo(() => {
    const ticks: Array<{ deg: number; major: boolean; label: string | null }> = []
    for (let deg = -180; deg <= 540; deg += 5) {
      const wrapped = ((deg % 360) + 360) % 360
      const major = wrapped % 10 === 0
      const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[wrapped] ?? null
      ticks.push({ deg, major, label: major ? (cardinal ?? pad(wrapped / 10, 2)) : null })
    }
    return ticks
  }, [])

  const speedTicks = useMemo(() => Array.from({ length: 23 }, (_, i) => i), [])

  return (
    // z-5: above the hologram, BELOW the copy panels (z-10) - a panel scrolling
    // past occludes the HUD instead of text being drawn over text.
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[5] transition-opacity duration-1000 ${booted ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* --- heading tape ------------------------------------------------- */}
      <div className="absolute top-[60px] left-1/2 hidden -translate-x-1/2 md:block" style={{ width: HEADING_WINDOW }}>
        <div className="relative h-[30px] overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]">
          <div ref={headingStrip} className="absolute top-0 left-0 h-full will-change-transform">
            {headingTicks.map((tick) => (
              <span
                key={tick.deg}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: (tick.deg + 180) * PX_PER_DEG }}
              >
                <span className={`w-px bg-fog/80 ${tick.major ? 'h-2.5' : 'h-1.5'}`} />
                {tick.label && (
                  <span className="mt-0.5 font-mono text-[10px] leading-none tracking-[0.08em] text-fog">
                    {tick.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
        {/* caret + readout */}
        <div className="absolute -top-[2px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-chalk" />
        <div className="absolute top-[34px] left-1/2 -translate-x-1/2 border border-chalk/70 bg-ink/80 px-2 py-0.5 font-mono text-[11px] tracking-[0.18em] text-chalk">
          VUE <span ref={headingValue}>000</span>
        </div>
      </div>

      {/* --- speed tape (left) ------------------------------------------- */}
      <div className="absolute top-1/2 left-5 hidden h-[260px] w-[54px] -translate-y-1/2 xl:block">
        <div className="absolute inset-0 overflow-hidden border-r border-fog/40 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
          <div ref={speedStrip} className="absolute inset-x-0 -top-[110px] will-change-transform">
            {speedTicks.map((i) => (
              <span
                key={i}
                className={`absolute right-0 h-px bg-fog/70 ${i % 5 === 0 ? 'w-4' : 'w-2'}`}
                style={{ top: i * PX_PER_KT * 10 }}
              />
            ))}
          </div>
        </div>
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 border border-chalk/70 bg-ink/90 px-1.5 py-0.5 font-mono text-[11px] text-chalk">
          <span ref={speedValue}>000</span>
        </div>
        <p className="tag absolute -top-6 left-0 text-[10px] whitespace-nowrap text-mist">DÉFILEMENT</p>
      </div>

      {/* --- system readout (top right) ---------------------------------- */}
      <pre
        ref={sysRef}
        className="absolute top-24 right-6 hidden font-mono text-[11px] leading-[1.85] tracking-[0.16em] text-fog/90 md:block lg:right-14"
      />

      {/* --- target data (bottom corner left free by the panel) ---------- */}
      {/* id: the callout columns read its box to stop above it. */}
      <div
        id="hud-target-data"
        className={`tag absolute hidden tracking-[0.16em] md:block ${
          dataSide === 'left' ? 'bottom-6 left-6 lg:left-20' : 'right-6 bottom-20 text-right lg:right-14 [&_dl]:justify-end'
        }`}
      >
        <p className="text-[10px] text-steel">FICHE</p>
        <p className="mt-1.5 text-[12px] text-chalk">{profile.code}</p>
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[11px]">
          {profile.rows.map(([key, value]) => (
            <div key={key} className={`grid gap-x-3 ${dataSide === 'right' ? 'grid-cols-[1fr_auto]' : 'grid-cols-[auto_1fr]'}`}>
              <dt className="text-steel">{key}</dt>
              <dd className="text-fog/90">{value}</dd>
            </div>
          ))}
        </dl>
        {profile.maquette && <p className="mt-3 text-[10px] text-steel/80">Maquette 3D · {profile.maquette}</p>}
      </div>

      {/* --- status strip (bottom right) --------------------------------- */}
      <div className="tag absolute right-6 bottom-6 hidden flex-col items-end gap-1 text-[10px] tracking-[0.2em] md:flex lg:right-14">
        <p className="text-fog/90">
          MODE <span className="text-chalk">{profile.mode}</span>
          <span className="text-steel"> · </span>STATUT <span className="text-chalk">NOMINAL</span>
        </p>
        <p className="text-mist">UTC {clock}</p>
      </div>
    </div>
  )
}

function utc() {
  return new Date().toISOString().slice(11, 19)
}
