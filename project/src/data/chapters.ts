import type { HologramRig } from '../three/hologram/rig'
import type { ModelId } from './models'

/** A position held, rendered as a technical row under the chapter copy. */
export interface Role {
  title: string
  org: string
  period: string
}

/** One point of the career "flight plan" (model-free chapter). */
export interface Waypoint {
  code: string
  year: string
  title: string
  org: string
}

/**
 * One scroll section.
 *
 * `span` is the section height in viewport heights. A dossier is ~2.6 screens
 * tall and its copy is sticky, so the airframe can go through three beats
 * while the text stays put: arrival (assembled) -> exploded -> callouts.
 *
 * `pose` is the rig state when the section's top reaches the top of the
 * viewport. `milestones` are extra poses inside the section, `at` measured in
 * viewport heights from that point (must stay below span - 0.8: the last
 * 0.8 screen belongs to the hand-off to the next airframe).
 *
 * `model` is the one airframe on stage for the whole section (or none).
 */
export interface Chapter {
  id: string
  /** Index code shown in the panel header and on the waypoint tape. */
  code: string
  eyebrow: string
  title: string
  body: string
  stack?: string[]
  roles?: Role[]
  waypoints?: Waypoint[]
  align: 'left' | 'right' | 'center'
  span: number
  model: ModelId | null
  pose: Partial<HologramRig>
  milestones?: Array<{ at: number; pose: Partial<HologramRig> }>
}

/**
 * Mechanism channels every arrival pose resets, so nothing leaks between dossiers.
 * mobileLift 0: on phones the dossier copy scrolls away (see ChapterBlock), so
 * the airframe is centred; hero and contact dock their panel at the bottom and
 * lift it.
 */
const REST = { explode: 0, labels: 0, canopy: 0, gear: 0, rotor: 0, propeller: 0, sensor: 0, focusActive: 0, mobileLift: 0 }

export const CHAPTERS: Chapter[] = [
  {
    id: 'hero',
    code: '00',
    eyebrow: 'Lucas Audoubert · portfolio 2026',
    title: 'Systèmes à l’état brut.',
    body: 'Développeur full-stack et chef de projet digital. Trois appareils, trois dossiers techniques : un même langage — des lignes, des mesures, un système lisible.',
    stack: ['Full-stack · IA · Cybersécurité', 'Alternance 12 mois — septembre 2026', '3 semaines entreprise / 1 semaine école'],
    align: 'center',
    span: 1,
    model: 'rafale',
    pose: {
      ...REST,
      mobileLift: 1,
      rafale: 1,
      apache: 0,
      mq9: 0,
      yaw: -0.15,
      pitch: 0.03,
      roll: -0.07,
      posY: 0.1,
      camAzimuth: 2.55,
      camElevation: 0.24,
      camDistance: 23,
      camTargetY: -1.9,
      camTargetZ: 0,
      camShiftX: 0,
      scan: 0.2,
      overlay: 1,
      glow: 1,
    },
  },
  {
    id: 'fullstack',
    code: '01',
    eyebrow: 'Dossier 01 / Full-stack',
    title: 'Du prototype au poste de pilotage.',
    body: 'Chez Green Finance : conception des moteurs de calcul — projection de flux de trésorerie, intérêts composés, échéanciers d’amortissement — et des simulations multi-scénarios qui les exploitent en temps réel. Architecture, workflow Git, collaboration design, déploiement.',
    stack: ['TypeScript · React · Next.js · Vue · Nuxt', 'Node · Express · Python · Java · Spring Boot', 'PostgreSQL · MongoDB · Docker · Jest'],
    roles: [
      { title: 'Lead developer · solution integration', org: 'Green Finance', period: '2026' },
      { title: 'Développeur full-stack', org: 'Indépendant', period: '2024 — aujourd’hui' },
    ],
    align: 'right',
    span: 2.6,
    model: 'rafale',
    pose: {
      ...REST,
      rafale: 1,
      canopy: 1,
      gear: 1,
      yaw: 0,
      pitch: 0.02,
      roll: 0,
      posY: 0,
      camAzimuth: 3.6,
      camElevation: 0.34,
      camDistance: 18.5,
      camTargetY: -0.5,
      camTargetZ: -0.3,
      camShiftX: -2.2,
      scan: 0.5,
      overlay: 1,
      glow: 1.05,
    },
    milestones: [
      { at: 0.8, pose: { explode: 1, camAzimuth: 3.95, camElevation: 0.5, camDistance: 34, camTargetY: 0.1, camTargetZ: 0, camShiftX: -2.9, scan: 0.35 } },
      { at: 1.25, pose: { labels: 1 } },
      { at: 1.75, pose: { camAzimuth: 4.2, scan: 0.65 } },
    ],
  },
  {
    id: 'security',
    code: '02',
    eyebrow: 'Dossier 02 / Cybersécurité',
    title: 'Observer avant de défendre.',
    body: 'Sécurité applicative : authentification et gestion des accès, durcissement, revue de code, secrets. À la rentrée, le Master IA & Cybersécurité prend le relais. Sur un drone, tout commence par le capteur : collecter la bonne donnée, puis la protéger.',
    stack: ['Auth · JWT · gestion des accès', 'Sécurité applicative · durcissement · secrets', 'Docker · Postman · PowerShell'],
    roles: [{ title: 'Master IA & Cybersécurité', org: 'IIM — Pôle Léonard-de-Vinci', period: '2026 —' }],
    align: 'left',
    span: 2.6,
    model: 'mq9',
    pose: {
      ...REST,
      mq9: 1,
      sensor: 1,
      propeller: 1,
      yaw: 0,
      pitch: 0.02,
      roll: 0.03,
      posY: 0,
      camAzimuth: 2.35,
      camElevation: 0.42,
      camDistance: 21,
      camTargetY: -0.5,
      camTargetZ: 0,
      camShiftX: 2.4,
      scan: 0.6,
      overlay: 1,
      glow: 1,
    },
    milestones: [
      { at: 0.8, pose: { explode: 1, propeller: 0.35, camAzimuth: 2.25, camElevation: 0.5, camDistance: 27, camTargetY: -0.4, camShiftX: 2.4, scan: 0.3 } },
      { at: 1.25, pose: { labels: 1 } },
      { at: 1.75, pose: { camAzimuth: 1.9, scan: 0.7 } },
    ],
  },
  {
    id: 'ai',
    code: '03',
    eyebrow: 'Dossier 03 / IA',
    title: 'Faire tourner le système.',
    body: 'Intégration d’IA en production : OCR, LLM, RAG, agents et MCP. Un modèle ne vaut que s’il tourne, se mesure et se surveille — comme un rotor : quatre pales équilibrées sur un même axe.',
    stack: ['OCR · LLM · RAG · MCP · LoRa', 'Vision · détection · segmentation', 'Inférence · coûts · observabilité'],
    roles: [{ title: 'Major de promotion — 3ᵉ année', org: 'IIM', period: '2024 — 2026' }],
    align: 'right',
    span: 2.6,
    model: 'apache',
    pose: {
      ...REST,
      apache: 1,
      rotor: 1,
      yaw: 0.1,
      pitch: 0.03,
      roll: 0.04,
      posY: 0,
      camAzimuth: 3.9,
      camElevation: 0.28,
      camDistance: 19,
      camTargetY: -0.6,
      camTargetZ: 0.2,
      camShiftX: -2.2,
      scan: 0.45,
      overlay: 1,
      glow: 1.05,
    },
    milestones: [
      { at: 0.8, pose: { explode: 1, rotor: 0.3, camAzimuth: 4.2, camElevation: 0.36, camDistance: 34, camTargetY: 0.5, camTargetZ: 0, camShiftX: -2.3, scan: 0.3 } },
      { at: 1.25, pose: { labels: 1 } },
      { at: 1.75, pose: { camAzimuth: 4.45, scan: 0.7 } },
    ],
  },
  {
    id: 'pilotage',
    code: '04',
    eyebrow: 'Plan de vol / Parcours',
    title: 'Piloter, livrer, recommencer.',
    body: 'Chef de projet digital : équipes pluridisciplinaires — dev, design, marketing —, planning Gantt, backlog ClickUp, suivi GitHub Projects et engagement de délais. Le même goût du système bien câblé, depuis les schémas électriques.',
    stack: ['Pilotage transverse · interface client', 'Gantt · ClickUp · GitHub Issues / Projects', 'Agile · Scrum · qualité de livraison'],
    waypoints: [
      { code: 'WP1', year: '2022', title: 'Électrotechnicien', org: 'Faymonville — Luxembourg' },
      { code: 'WP2', year: '2024', title: 'Ingénierie web', org: 'IIM — Pôle Léonard-de-Vinci' },
      { code: 'WP3', year: '2025', title: 'Chef de projet digital', org: 'Bourse au projet / Culture du mouvement' },
      { code: 'WP4', year: '2026', title: 'Lead developer', org: 'Green Finance' },
      { code: 'WP5', year: '2026', title: 'Master IA & Cyber', org: 'IIM — alternance' },
    ],
    align: 'center',
    span: 1.4,
    model: null,
    pose: { ...REST, rafale: 0, apache: 0, mq9: 0, camAzimuth: 2.3, camElevation: 0.22, camDistance: 24, camTargetY: -2.5, camShiftX: 0 },
  },
  {
    id: 'contact',
    code: '05',
    eyebrow: 'Contact',
    title: 'Parlons de votre système.',
    body: 'Alternance de 12 mois à partir de septembre 2026 (3 semaines en entreprise / 1 semaine à l’école), missions freelance et postes à temps plein. Dites-moi ce qu’il faut faire décoller.',
    stack: ['Français · Anglais B2 · Russe (notions)', 'Astronomie · aéronautique · spéléologie'],
    align: 'center',
    span: 1,
    model: 'rafale',
    pose: {
      ...REST,
      mobileLift: 1.45,
      rafale: 1,
      yaw: -0.1,
      pitch: 0.05,
      roll: -0.12,
      posY: 0.1,
      camAzimuth: 2.2,
      camElevation: 0.2,
      camDistance: 24,
      camTargetY: -2.6,
      camTargetZ: 0,
      camShiftX: 0,
      scan: 0.15,
      overlay: 0.7,
      glow: 1,
    },
  },
]

/** Section starts and total height, in viewport heights. */
export function chapterLayout() {
  const starts: number[] = []
  let total = 0
  for (const chapter of CHAPTERS) {
    starts.push(total)
    total += chapter.span
  }
  return { starts, total }
}
