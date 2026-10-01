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
 * `pose` is the rig state the hologram holds while that section sits in the
 * middle of the viewport; Anime.js tweens between consecutive poses as the
 * reader scrolls. `model` is the airframe on screen - one aircraft per
 * chapter, always.
 *
 * `milestones` add poses *inside* the chapter's own scroll range (at = 0.5 is
 * halfway to the next chapter). That is how an airframe is shown whole on
 * arrival and comes apart as the reader keeps scrolling.
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
  /** Airframe on screen for this stop (drives annotations). */
  model: ModelId
  pose: Partial<HologramRig>
  milestones?: Array<{ at: number; pose: Partial<HologramRig> }>
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
      explode: 0,
      canopy: 0,
      gear: 0,
      rotor: 0,
      propeller: 0,
      sensor: 0,
      scan: 0.2,
      labels: 0,
      overlay: 1,
      glow: 1,
    },
    milestones: [{ at: 0.6, pose: { camAzimuth: 2.95, camDistance: 20.5 } }],
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
      explode: 0,
      rotor: 0,
      propeller: 0,
      sensor: 0,
      scan: 0.55,
      labels: 1,
      overlay: 1,
      glow: 1.05,
    },
    // Continuer a scroller ouvre la cellule : verriere, train, puis sous-ensembles.
    milestones: [
      {
        at: 0.55,
        pose: { explode: 0.55, camDistance: 20, camTargetY: -0.5, camTargetZ: -0.6, scan: 0.35 },
      },
    ],
  },
  {
    id: 'security',
    eyebrow: '02 / Cybersécurité',
    title: 'Observer avant de défendre.',
    body: 'Sécurité applicative : authentification et gestion des accès, durcissement, revue de code, secrets. À la rentrée, le Master IA & Cybersécurité prend le relais. La tourelle balaie pendant que le scan traverse la cellule — puis les 39 sous-ensembles se séparent.',
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
      rotor: 0,
      explode: 0,
      canopy: 0,
      gear: 0,
      scan: 0.6,
      labels: 1,
      overlay: 1,
      glow: 1,
    },
    milestones: [
      {
        at: 0.55,
        pose: { explode: 1, camDistance: 27, camTargetY: -0.5, camTargetZ: 0.4, camAzimuth: 5.95, scan: 0.25 },
      },
    ],
  },
  {
    id: 'ai',
    eyebrow: '03 / Intelligence artificielle',
    title: 'Faire tourner le système.',
    body: 'Intégration d’IA en production : OCR, LLM, RAG, agents et MCP. Un modèle ne vaut que s’il tourne, se mesure et se surveille. Le rotor s’emballe — puis les pales, l’armement et la dérive sortent de la cellule.',
    stack: ['OCR · LLM · RAG · MCP · LoRa', 'Vision · détection · segmentation', 'Inférence · coûts · observabilité'],
    roles: [{ title: 'Major de promotion — 3ᵉ année', org: 'IIM', period: '2024 — 2026' }],
    align: 'right',
    model: 'apache',
    pose: {
      rafale: 0,
      apache: 1,
      mq9: 0,
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
      propeller: 0,
      sensor: 0,
      explode: 0,
      canopy: 0,
      gear: 0,
      scan: 0.45,
      labels: 1,
      overlay: 1,
      glow: 1.05,
    },
    milestones: [
      {
        at: 0.55,
        pose: { explode: 1, camDistance: 24.5, camTargetY: -0.45, camTargetZ: 0.4, camAzimuth: 4.85, scan: 0.3 },
      },
    ],
  },
  {
    id: 'architecture',
    eyebrow: '04 / Pilotage',
    title: 'Tout, à plat.',
    body: 'Chef de projet digital : équipes pluridisciplinaires — dev, design, marketing —, planning Gantt, backlog ClickUp, suivi GitHub Projects et engagement de délais. Même discipline sur un appareil : chaque sous-ensemble est un module indépendant, adressable et testable.',
    stack: [
      'Pilotage transverse · interface client',
      'Gantt · ClickUp · GitHub Issues / Projects',
      'Agile · Scrum · qualité de livraison',
    ],
    roles: [
      { title: 'Chef de projet digital', org: 'IIM — Bourse au projet / Culture du mouvement', period: '2025 — 2026' },
      { title: 'Électrotechnicien', org: 'Faymonville — Luxembourg', period: '2022 — 2023' },
    ],
    align: 'left',
    model: 'rafale',
    pose: {
      rafale: 1,
      apache: 0,
      mq9: 0,
      yaw: 0,
      pitch: 0.02,
      roll: 0,
      posY: 0,
      camAzimuth: 2,
      camElevation: 0.42,
      camDistance: 30,
      camTargetY: -0.8,
      camTargetZ: 0,
      camShiftX: 1.6,
      explode: 1,
      canopy: 0.25,
      gear: 0.8,
      rotor: 0,
      propeller: 0,
      sensor: 0,
      scan: 0.3,
      labels: 1,
      overlay: 0.9,
      glow: 1,
    },
    // Un tour complet autour des modules, sans que rien ne bouge d'autre.
    milestones: [
      { at: 0.34, pose: { camAzimuth: 3.2 } },
      { at: 0.68, pose: { camAzimuth: 4.4, camDistance: 25.5 } },
    ],
  },
  {
    id: 'contact',
    eyebrow: '05 / Contact',
    title: 'Parlons de votre système.',
    body: 'Alternance de 12 mois à partir de septembre 2026 (3 semaines en entreprise / 1 semaine à l’école), missions freelance et postes à temps plein. Dites-moi ce qu’il faut faire décoller.',
    stack: ['Français · Anglais B2 · Russe (notions)', 'Astronomie · aéronautique · spéléologie'],
    align: 'center',
    model: 'apache',
    pose: {
      rafale: 0,
      apache: 1,
      mq9: 0,
      yaw: -0.12,
      pitch: 0.03,
      roll: -0.05,
      posY: 0.05,
      camAzimuth: 5.2,
      camElevation: 0.2,
      camDistance: 24,
      camTargetY: -2.5,
      camTargetZ: 0,
      camShiftX: 0,
      explode: 0,
      canopy: 0,
      gear: 0,
      rotor: 0.35,
      propeller: 0,
      sensor: 0,
      scan: 0.15,
      labels: 0,
      overlay: 0.5,
      glow: 0.95,
    },
  },
]
