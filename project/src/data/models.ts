/**
 * Everything the viewer needs to know about one airframe: where it sits in the
 * exploded view, which part spins, and which annotations are pinned to it.
 *
 * Coordinates are the canonical frame produced by `npm run models`
 * (see tools/optimize-models.mjs):
 *
 *     nose -Z · up +Y · span X · 10 units long · centred on origin
 */

export type ModelId = 'rafale' | 'apache' | 'mq9'

/** Rig channel that drives a rotating part; declared here to keep the data
 *  file independent from the 3D module. */
export type SpinChannel = 'rotor' | 'propeller' | 'sensor'

export interface Reference {
  /** Label text, upper case technical style. */
  text: string
  /** Secondary readout shown after the label. */
  value?: string
  /** Part name to anchor to, or an explicit canonical-space position. */
  anchor: string | [number, number, number]
}

export interface ModelConfig {
  id: ModelId
  /** File in public/models (built by npm run models). */
  url: string
  name: string
  /** Serial shown in the HUD block. */
  serial: string
  /** Technical readout under the HUD title. */
  specs: Array<[string, string]>
  /** Datasheet line for the dimension bracket. */
  dimension: string
  /** Exploded-view offset per part (canonical units). */
  explode: Record<string, [number, number, number]>
  /**
   * Parts that rotate continuously - a rotor, a propeller, a sensor turret.
   * `key` is the rig channel driving the speed; the pivot is the combined
   * centre of those parts, found at load time.
   */
  spins?: Array<{ parts: string[]; axis: 'x' | 'y' | 'z'; speed: number; key: SpinChannel }>
  /** Annotations pinned to parts of this airframe. */
  references: Reference[]
  /** Licence line, shown because the model is not ours. */
  credit: string
}

export const MODELS: ModelConfig[] = [
  {
    id: 'rafale',
    url: 'models/rafale.glb',
    name: 'Dassault Rafale M',
    serial: 'AIRFRAME / 001',
    specs: [
      ['CLASS', 'MULTIROLE'],
      ['PARTS', '10'],
      ['SPAN', '6.90'],
      ['LENGTH', '10.00'],
    ],
    dimension: 'SPAN 6.90 / L 10.00',
    explode: {
      canopy: [0, 1.25, 0.45],
      cockpit: [0, 0.85, 0.2],
      hud: [0, 1.5, -0.75],
      'instrument-glass': [0, 1.9, -1.0],
      'gear-deployed': [0, -1.35, 0],
      'gear-retracted': [0, -1.35, 0],
      'landing-light': [0, -1.8, 0],
      rails: [0, -0.85, 0.75],
      pods: [0, -1.2, 0.35],
    },
    references: [
      { text: 'Radome', value: '01', anchor: 'airframe' },
      { text: 'Verrière', value: '02', anchor: 'canopy' },
      { text: 'HUD', value: '03', anchor: 'hud' },
      { text: 'Pylônes', value: '04', anchor: 'rails' },
      { text: 'Train', value: '05', anchor: 'gear-deployed' },
    ],
    credit: 'Sketchfab · CC BY 4.0',
  },
  {
    id: 'apache',
    url: 'models/apache.glb',
    name: 'Boeing AH-64D Apache',
    serial: 'AIRFRAME / 002',
    specs: [
      ['CLASS', 'ATTACK'],
      ['PARTS', '08'],
      ['ROTOR', '2 BLADES'],
      ['LENGTH', '10.00'],
    ],
    dimension: 'ROTOR D 7.84',
    explode: {
      rotor: [0, 2.4, 0],
      'canopy-glass': [0, 1.8, -0.5],
      tail: [0, 0.5, 1.7],
      weapons: [1.7, -0.9, 0],
      pylons: [1.3, -0.55, 0],
      decals: [0, 0.4, 0],
    },
    spins: [{ parts: ['rotor'], axis: 'y', speed: 0.55, key: 'rotor' }],
    references: [
      { text: 'Rotor principal', value: 'RPM 289', anchor: 'rotor' },
      { text: 'Verrière', value: 'TANDEM', anchor: 'canopy-glass' },
      { text: 'Points d’emport', value: 'HELLFIRE ×8', anchor: 'weapons' },
      { text: 'Dérive', value: 'ANTI-TORQUE', anchor: 'tail' },
    ],
    credit: 'Sketchfab · CC BY 4.0',
  },
  {
    id: 'mq9',
    url: 'models/mq9.glb',
    name: 'General Atomics MQ-9',
    serial: 'AIRFRAME / 003',
    specs: [
      ['CLASS', 'ISR / UCAV'],
      ['PARTS', '39'],
      ['SPAN', '5.70'],
      ['LENGTH', '10.00'],
    ],
    dimension: 'SPAN 5.70 / L 10.00',
    explode: {
      propeller: [0, 0.9, 2.6],
      blades: [0, 0.9, 2.6],
      sensor: [0, -1.6, -0.7],
      'sensor-mount-1': [0, -1.1, -0.45],
      'sensor-mount-2': [0, -1.1, -0.45],
      'wheel-l': [0, -1.8, 0],
      'wheel-r': [0, -1.8, 0],
      'wheel-nose': [0, -1.8, 0],
      'strut-l': [0, -1.5, 0],
      'strut-r': [0, -1.5, 0],
      'strut-1n': [0, -1.5, 0],
      'strut-2n': [0, -1.5, 0],
      'scissor-1n': [0, -1.5, 0],
      'scissor-2n': [0, -1.5, 0],
      'jaw-n': [0, -1.5, 0],
      'h-stabilizer-l': [1.9, 0, 0.2],
      'h-stabilizer-r': [1.9, 0, 0.2],
      vstabilizer: [0, 1.5, 0.35],
      rudder: [0, 2.0, 0.85],
      'elevator-l': [1.9, 0.35, 0.45],
      'elevator-r': [1.9, 0.35, 0.45],
      'aileron-l': [1.7, -0.25, 0.1],
      'aileron-r': [1.7, -0.25, 0.1],
      'flap-l1': [1.3, 0.1, 0.7],
      'flap-r1': [1.3, 0.1, 0.7],
      'flap-l2': [1.0, 0.1, 0.9],
      'flap-r2': [1.0, 0.1, 0.9],
      'hellfire-pylon-l': [1.6, -1.1, 0.25],
      'hellfire-pylon-r': [1.6, -1.1, 0.25],
      'pylon-l1': [1.4, -0.75, 0.15],
      'pylon-r1': [1.4, -0.75, 0.15],
      'pylon-l2': [1.2, -0.75, 0.4],
      'pylon-r2': [1.2, -0.75, 0.4],
      engine: [0, 1.1, 1.3],
      'gearbox-f': [0, 0.7, 0.9],
      'gearbox-b': [0, 0.7, 1.1],
      antennas: [0, 1.3, 0],
      lights: [0, -0.7, 0],
    },
    spins: [
      { parts: ['propeller', 'blades'], axis: 'z', speed: 1.6, key: 'propeller' },
      { parts: ['sensor', 'sensor-mount-1', 'sensor-mount-2'], axis: 'y', speed: 0.45, key: 'sensor' },
    ],
    references: [
      { text: 'Hélice', value: 'PUSHER', anchor: 'propeller' },
      { text: 'Tourelle MTS-B', value: 'EO/IR', anchor: 'sensor' },
      { text: 'Hélice / pale', value: 'COMPOSITE', anchor: 'blades' },
      { text: 'Dérive', value: 'V-TAIL', anchor: 'vstabilizer' },
      { text: 'Train', value: '3 POINTS', anchor: 'wheel-l' },
      { text: 'Antennes', value: 'SATCOM', anchor: 'antennas' },
    ],
    credit: 'Sketchfab · CC BY 4.0',
  },
]

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<ModelId, ModelConfig>
