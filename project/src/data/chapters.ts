import type { HologramRig } from '../three/hologram/rig'
import type { ModelId } from './models'

/** A position held, rendered as a technical row under the chapter copy. */
export interface Role {
  title: string
  org: string
  period: string
}

/**
 * One full-viewport scroll stop.
 *
 * `pose` is the rig state the hologram should hold while that section sits in
 * the middle of the viewport; Anime.js tweens between consecutive poses as the
 * reader scrolls. `model` is the airframe the camera is inspecting, which is
 * also the model whose annotations are shown.
 */
export interface Chapter {
  id: string
  /** Small monospace line above the title. */
  eyebrow: string
  title: string
  body: string
  /** Lines rendered as a technical list (stack, tools, constraints). */
  stack?: string[]
  /** Positions rendered as a compact table. */
  roles?: Role[]
  align: 'left' | 'right' | 'center'
  /** Airframe in focus for this stop (drives annotations). */
  model: ModelId
  pose: Partial<HologramRig>
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'hero',
    eyebrow: 'Lucas Audoubert · portfolio 2026',
    title: 'Systèmes à l’état brut.',
    body: 'Développeur full-stack et chef de projet digital. Trois appareils, un même langage : des lignes, des mesures, un système lisible — et testable.',
    stack: [
      'Full-stack · IA · Cybersécurité',
      'Alternance 12 mois — septembre 2026',
      '3 semaines entreprise / 1 semaine école',
    ],
    align: 'center',
    model: 'rafale',
    pose: {
      rafale: 1,
      apache: 0,
      mq9: 0,
      spread: 0,
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
      labels: 0,
      overlay: 1,
      glow: 1,
    },
  },
  {
    id: 'fullstack',
    eyebrow: '01 / Full-stack',
    title: 'Du prototype au poste de pilotage.',
    body: 'Chez Green Finance : conception des moteurs de calcul — projection de flux de trésorerie, intérêts composés, échéanciers d’amortissement — et des simulations multi-scénarios qui les exploitent en temps réel. Architecture, choix techniques, workflow Git, collaboration design et déploiement ensuite.',
    stack: [
      'TypeScript · React · Next.js · Vue · Nuxt',
      'Node · Express · Python · Java · Spring Boot',
      'PostgreSQL · MongoDB · Docker · Jest',
    ],
    roles: [
      { title: 'Lead developer · solution integration', org: 'Green Finance', period: '2026' },
      { title: 'Développeur full-stack', org: 'Indépendant', period: '2024 — aujourd’hui' },
    ],
    align: 'right',
    model: 'rafale',
    pose: {
      rafale: 1,
      apache: 0,
      mq9: 0,
      spread: 0,
      yaw: 0.05,
      pitch: 0.02,
      roll: 0,
      posY: 0,
      camAzimuth: 3.6,
      camElevation: 0.38,
      camDistance: 16.2,
      camTargetY: -0.7,
      camTargetZ: -1.6,
      camShiftX: -1.9,
      canopy: 1,
      gear: 0.35,
      explode: 0.24,
      scan: 0.55,
      labels: 1,
      overlay: 1,
      glow: 1.05,
    },
  },
  {
    id: 'security',
    eyebrow: '02 / Cybersécurité',
    title: 'Observer avant de défendre.',
    body: 'Sécurité applicative : authentification et gestion des accès, durcissement, revue de code, secrets. À la rentrée, le Master IA & Cybersécurité prend le relais. Le capteur tourne pendant que le balayage traverse la cellule.',
    stack: [
      'Auth · JWT · gestion des accès',
      'Sécurité applicative · durcissement · secrets',
      'Docker · Postman · PowerShell',
    ],
    roles: [{ title: 'Master IA & Cybersécurité', org: 'IIM — Pôle Léonard-de-Vinci', period: '2026 —' }],
    align: 'left',
    model: 'mq9',
    pose: {
      rafale: 0,
      apache: 0,
      mq9: 1,
      spread: 0,
      yaw: -0.2,
      pitch: 0.01,
      roll: 0.04,
      posY: 0,
      camAzimuth: 5.5,
      camElevation: 0.28,
      camDistance: 17,
      camTargetY: -0.95,
      camTargetZ: -0.4,
      camShiftX: 1.35,
      sensor: 1,
      propeller: 1,
      scan: 1,
      explode: 0.15,
      labels: 1,
      overlay: 1,
      glow: 1,
    },
  },
  {
    id: 'ai',
    eyebrow: '03 / Intelligence artificielle',
    title: 'Faire tourner le système.',
    body: 'Intégration d’IA en production : OCR, LLM, RAG, agents et MCP. Un modèle ne vaut que s’il tourne, se mesure et se surveille. Le rotor s’emballe, les pales sortent de la cellule et chaque sous-ensemble devient addressable.',
    stack: ['OCR · LLM · RAG · MCP · LoRa', 'Vision · détection · segmentation', 'Inférence · coûts · observabilité'],
    roles: [{ title: 'Major de promotion — 3ᵉ année', org: 'IIM', period: '2024 — 2026' }],
    align: 'right',
    model: 'apache',
    pose: {
      rafale: 0,
      apache: 1,
      mq9: 0,
      spread: 0,
      yaw: 0.18,
      pitch: 0.04,
      roll: 0.06,
      posY: 0,
      camAzimuth: 4.35,
      camElevation: 0.32,
      camDistance: 16.5,
      camTargetY: -0.95,
      camTargetZ: 0.2,
      camShiftX: -1.3,
      rotor: 1,
      explode: 0.4,
      scan: 0.4,
      labels: 1,
      overlay: 1,
      glow: 1.05,
    },
  },
  {
    id: 'architecture',
    eyebrow: '04 / Pilotage',
    title: 'Tout, à plat.',
    body: 'Chef de projet digital : équipes pluridisciplinaires — dev, design, marketing —, planning Gantt, backlog ClickUp, suivi GitHub Projects et engagement de délais. La vue éclatée raconte la même discipline : chaque sous-ensemble est un module indépendant.',
    stack: [
      'Pilotage transverse · interface client',
      'Gantt · ClickUp · GitHub Issues / Projects',
      'Agile · Scrum · qualité de livraison',
    ],
    roles: [
      { title: 'Chef de projet digital', org: 'IIM — Bourse au projet / Culture du mouvement', period: '2025 — 2026' },
      { title: 'Électrotechnicien', org: 'Faymonville — Luxembourg', period: '2022 — 2023' },
    ],
    align: 'center',
    model: 'mq9',
    pose: {
      rafale: 1,
      apache: 1,
      mq9: 1,
      spread: 1,
      yaw: 0,
      pitch: 0,
      roll: 0,
      posY: 0,
      camAzimuth: 0.5,
      camElevation: 0.3,
      camDistance: 30,
      camTargetY: -2.3,
      camTargetZ: 0,
      camShiftX: 0,
      rotor: 0.25,
      propeller: 0.25,
      explode: 1,
      scan: 0.2,
      labels: 0,
      overlay: 0.75,
      glow: 1,
    },
  },
  {
    id: 'contact',
    eyebrow: '05 / Contact',
    title: 'Parlons de votre système.',
    body: 'Alternance de 12 mois à partir de septembre 2026 (3 semaines en entreprise / 1 semaine à l’école), missions freelance et postes à temps plein. Dites-moi ce qu’il faut faire décoller.',
    stack: ['Français · Anglais B2 · Russe (notions)', 'Astronomie · aéronautique · spéléologie'],
    align: 'center',
    model: 'rafale',
    pose: {
      rafale: 1,
      apache: 1,
      mq9: 1,
      spread: 1,
      yaw: 0,
      pitch: 0,
      roll: 0,
      posY: 0,
      camAzimuth: 0.05,
      camElevation: 0.2,
      camDistance: 30,
      camTargetY: -1.6,
      camTargetZ: 0,
      camShiftX: 0,
      rotor: 0.1,
      propeller: 0.1,
      explode: 0.15,
      scan: 0.1,
      labels: 0,
      overlay: 0.5,
      glow: 0.95,
    },
  },
]
