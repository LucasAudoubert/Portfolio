/**
 * Everything the viewer needs about one 3D model: how it explodes, what spins,
 * and which callouts are pinned to it.
 *
 * The models are study maquettes. Their callouts deliberately name SKILLS and
 * TOOLS, not aircraft parts: the exploded diagram is a map of how the work in
 * that dossier is put together.
 *
 * Coordinates are the canonical frame produced by `npm run models`
 * (see tools/optimize-models.mjs):
 *
 *     nose -Z · up +Y · span X · longest side 10 units · centred on origin
 *
 * Part names are the node names in the processed GLBs - check them with the
 * inspector (inspector.html) before adding an entry; a typo silently leaves a
 * part where it is.
 */

export type ModelId = 'rafale' | 'apache' | 'mq9'

/** Rig channel that drives a rotating part. */
export type SpinChannel = 'rotor' | 'propeller' | 'sensor'

export interface Reference {
  /** Skill or tool, technical style. */
  text: string
  /** Technology stack behind it. */
  value?: string
  /** Part the leader line points at. */
  anchor: string
}

export interface SpinConfig {
  parts: string[]
  /** Part whose bounding-box centre is the hub (the rotation axis). */
  pivot: string
  axis: 'x' | 'y' | 'z'
  /** Radians per second at rig speed 1. */
  speed: number
  key: SpinChannel
}

export interface ModelConfig {
  id: ModelId
  /** File in public/models (built by npm run models). */
  url: string
  /** Name of the 3D maquette, shown as a discreet credit. */
  name: string
  /** Short designator for the target box. */
  code: string
  /**
   * Exploded-view offset per part, canonical units. The X component means
   * OUTBOARD: it is mirrored by the side the part sits on, so a pair of wings
   * share one value and move apart symmetrically.
   */
  explode: Record<string, [number, number, number]>
  spins?: SpinConfig[]
  /** Callouts drawn on the exploded view (order = callout index). */
  references: Reference[]
}

export const MODELS: ModelConfig[] = [
  {
    id: 'rafale',
    url: 'models/rafale.glb',
    name: 'Dassault Rafale M',
    code: 'RFL-M',
    explode: {
      radome: [0, 0, -2.1],
      canopy: [0, 1.95, -0.15],
      cockpit: [0, 1.0, -0.15],
      hud: [0, 1.5, -0.9],
      'wing-left': [2.1, 0, 0.35],
      'wing-right': [2.1, 0, 0.35],
      fin: [0, 1.75, 0.65],
      engines: [0, 0, 2.2],
      rails: [0, -0.95, 0.1],
      pods: [0, -1.9, 0.2],
      'gear-deployed': [0, -1.45, 0],
      'gear-retracted': [0, -1.45, 0],
      'landing-light': [0, -1.45, 0],
    },
    references: [
      { text: 'API & services', value: 'Node · REST', anchor: 'radome' },
      { text: 'Interface', value: 'React · design system', anchor: 'canopy' },
      { text: 'Expérience utilisateur', value: 'Parcours · a11y', anchor: 'cockpit' },
      { text: 'Données', value: 'PostgreSQL · MongoDB', anchor: 'engines' },
      { text: 'Qualité', value: 'Tests · revue de code', anchor: 'fin' },
      { text: 'Temps réel', value: 'WebSocket · files', anchor: 'wing-right' },
      { text: 'Intégrations', value: 'Paiement · e-mail', anchor: 'pods' },
      { text: 'Déploiement', value: 'Docker · CI/CD', anchor: 'gear-deployed' },
    ],
  },
  {
    id: 'mq9',
    url: 'models/mq9.glb',
    name: 'General Atomics MQ-9',
    code: 'MQ-9B',
    explode: {
      // Propulsion goes aft along the thrust line.
      propeller: [0, 0, 1.5],
      blades: [0, 0, 1.5],
      engine: [0, 0.75, 0.75],
      'gear-box-b': [0, 0.55, 0.45],
      'gear-box-f': [0, 0.55, 0.15],
      // Sensors drop below the nose.
      sensor: [0, -1.2, -0.35],
      'sensor-mount1': [0, -0.75, -0.25],
      'sensor-mount2': [0, -0.75, -0.25],
      antennas: [0, 0.75, -0.1],
      lights: [0, 0.35, 0],
      // Control surfaces leave the trailing edge.
      'aileron-l': [0.25, 0, 0.8],
      'aileron-r': [0.25, 0, 0.8],
      'flap-l1': [0, 0, 0.75],
      'flap-r1': [0, 0, 0.75],
      'flap-l2': [0, 0, 0.75],
      'flap-r2': [0, 0, 0.75],
      // V-tail and ventral fin.
      'hstabilizer-l': [0.45, 0.75, 0.55],
      'hstabilizer-r': [0.45, 0.75, 0.55],
      'elevator-l': [0.65, 1.05, 0.95],
      'elevator-r': [0.65, 1.05, 0.95],
      vstabilizer: [0, -0.85, 0.55],
      rudder: [0, -1.15, 0.9],
      // Stores under the wings.
      'pylon-l1': [0, -0.75, 0],
      'pylon-r1': [0, -0.75, 0],
      'pylon-l2': [0, -0.75, 0],
      'pylon-r2': [0, -0.75, 0],
      'hellfire-pylon-l': [0, -1.15, 0],
      'hellfire-pylon-r': [0, -1.15, 0],
      // Landing gear: struts first, wheels below them.
      'strut-l': [0.25, -1.1, 0],
      'strut-r': [0.25, -1.1, 0],
      'wheel-l': [0.3, -1.6, 0],
      'wheel-r': [0.3, -1.6, 0],
      'strut1-n': [0, -1.1, -0.2],
      'strut2-n': [0, -1.1, -0.2],
      'scissor1-n': [0, -1.1, -0.2],
      'scissor2-n': [0, -1.1, -0.2],
      'jaw-n': [0, -1.1, -0.2],
      'wheel-n': [0, -1.6, -0.2],
    },
    spins: [
      { parts: ['propeller', 'blades'], pivot: 'propeller', axis: 'z', speed: 9, key: 'propeller' },
      { parts: ['sensor'], pivot: 'sensor', axis: 'y', speed: 0.6, key: 'sensor' },
    ],
    references: [
      { text: 'Authentification', value: 'OAuth · JWT', anchor: 'sensor' },
      { text: 'Surface d’attaque', value: 'API · réseau', anchor: 'antennas' },
      { text: 'Chiffrement', value: 'TLS · secrets', anchor: 'engine' },
      { text: 'Gestion des accès', value: 'RBAC · IAM', anchor: 'blades' },
      { text: 'Durcissement', value: 'OWASP · en-têtes', anchor: 'elevator-r' },
      { text: 'Journalisation', value: 'Logs · audit', anchor: 'aileron-l' },
      { text: 'Détection', value: 'SIEM · alertes', anchor: 'hellfire-pylon-r' },
      { text: 'Revue & dépendances', value: 'SAST · audit', anchor: 'wheel-l' },
    ],
  },
  {
    id: 'apache',
    url: 'models/apache.glb',
    name: 'Boeing AH-64D Apache',
    code: 'AH-64D',
    explode: {
      // The rotor and the radar stack straight up the mast.
      rotor: [0, 2.1, 0],
      'mast-radar': [0, 3.2, 0],
      'canopy-glass': [0, 1.35, 0],
      cockpit: [0, 0.7, -0.15],
      // The tail rotor slides out along its own shaft (to the left).
      'tail-rotor': [1.1, 0, 0],
      launchers: [0, -0.95, 0],
      weapons: [0, -1.75, -0.2],
      pylons: [0, -0.5, 0],
    },
    spins: [
      { parts: ['rotor'], pivot: 'rotor', axis: 'y', speed: 2.4, key: 'rotor' },
      { parts: ['tail-rotor'], pivot: 'tail-rotor', axis: 'x', speed: 10, key: 'rotor' },
    ],
    references: [
      { text: 'Veille & benchmarks', value: 'PoC · état de l’art', anchor: 'mast-radar' },
      { text: 'Orchestration', value: 'Agents · outils', anchor: 'rotor' },
      { text: 'Interface IA', value: 'Chat · restitution', anchor: 'canopy-glass' },
      { text: 'Contexte & prompt', value: 'RAG · embeddings', anchor: 'cockpit' },
      { text: 'Ingestion', value: 'OCR · prétraitement', anchor: 'tail-rotor' },
      { text: 'Modèles', value: 'LLM · vision', anchor: 'launchers' },
      { text: 'Évaluation', value: 'Métriques · garde-fous', anchor: 'weapons' },
    ],
  },
]

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<ModelId, ModelConfig>
