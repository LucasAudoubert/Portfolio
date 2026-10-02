import type { HologramRig } from '../three/hologram/rig'
import type { ModelId } from './models'

/** A project: professional, academic or personal. */
export interface Project {
  name: string
  /** Context and dates, e.g. "Pro · 2026". */
  kind: string
  detail: string
}

/** One step of the career timeline (model-free chapter). */
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
 * tall and its copy is sticky, so the subject can go through three beats while
 * the text stays put: arrival -> exploded -> callouts.
 *
 * `pose` is the rig state when the section's top reaches the top of the
 * viewport. `milestones` are extra poses inside the section, `at` measured in
 * viewport heights from that point (must stay below span - 0.8: the last 0.8
 * screen belongs to the hand-off to the next maquette).
 */
export interface Chapter {
  id: string
  /** Index code shown in the panel header and on the waypoint tape. */
  code: string
  eyebrow: string
  title: string
  body: string
  /** Dates / context shown on the right of the panel header. */
  period?: string
  stack?: string[]
  projects?: Project[]
  waypoints?: Waypoint[]
  /** Rows for the HUD "fiche" card. */
  profile?: Array<[string, string]>
  /** Shows the tech-stack carousel. */
  carousel?: boolean
  /** Mode shown in the HUD status strip. */
  mode?: 'PROJET' | 'PARCOURS' | 'STACK' | 'CONTACT'
  align: 'left' | 'right' | 'center'
  span: number
  model: ModelId | null
  pose: Partial<HologramRig>
  milestones?: Array<{ at: number; pose: Partial<HologramRig> }>
}

/** Mechanism channels every arrival pose resets, so nothing leaks between sections. */
const REST = { explode: 0, labels: 0, canopy: 0, gear: 0, rotor: 0, propeller: 0, sensor: 0, focusActive: 0 }

export const CHAPTERS: Chapter[] = [
  {
    id: 'hero',
    code: '00',
    eyebrow: 'Portfolio 2026',
    title: 'Développeur full-stack & chef de projet digital.',
    body: '3ᵉ année à l’IIM (Pôle Léonard-de-Vinci), major de promotion, j’intègre à la rentrée un Master IA & Cybersécurité. Développement full-stack, intégration d’IA et sécurité applicative : je cherche une alternance de 12 mois dès septembre 2026.',
    stack: ['Alternance 12 mois — septembre 2026', 'Rythme 3 semaines entreprise / 1 semaine école', 'Full-stack · IA · Cybersécurité'],
    profile: [
      ['FORMATION', 'IIM — 3ᵉ année'],
      ['MENTION', 'Major de promotion'],
      ['SUITE', 'Master IA & Cybersécurité'],
    ],
    align: 'center',
    span: 1,
    model: 'rafale',
    pose: {
      ...REST,
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
    eyebrow: '01 · Développement full-stack',
    title: 'Concevoir, livrer, maintenir.',
    body: 'Chez Green Finance, j’ai conçu les moteurs de calcul — projection de flux de trésorerie, intérêts composés, échéanciers d’amortissement — et les simulations multi-scénarios qui les exploitent en temps réel. À côté, des missions full-stack de bout en bout : architecture, choix techniques, workflow Git, intégration des maquettes et déploiement.',
    period: '2024 — 2026',
    projects: [
      {
        name: 'Green Finance — moteurs de calcul',
        kind: 'Pro · 2026',
        detail: 'Moteurs financiers et simulations multi-scénarios temps réel ; architecture, choix techniques et mise en production.',
      },
      {
        name: 'Applications full-stack',
        kind: 'Pro · 2024 — aujourd’hui',
        detail: 'De la maquette au déploiement : API, bases de données, interfaces responsives, optimisation des performances.',
      },
      {
        name: 'Bourse au projet — IIM',
        kind: 'Académique · 2025 — 2026',
        detail: 'Projet d’équipe pluridisciplinaire : backlog, planning, développement et livraison.',
      },
    ],
    stack: ['TypeScript · React · Next.js · Vue · Nuxt', 'Node · Express · Python · Java · Spring Boot', 'PostgreSQL · MongoDB · Docker · Jest'],
    profile: [
      ['RÔLE', 'Lead developer'],
      ['STRUCTURE', 'Green Finance'],
      ['PÉRIODE', '2026'],
      ['STACK', 'TypeScript · React · Node'],
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
    eyebrow: '02 · Cybersécurité',
    title: 'Sécuriser par défaut.',
    body: 'Authentification, gestion des rôles et des accès, durcissement des API, gestion des secrets, revue de code : la sécurité traitée comme une exigence de conception et non comme une couche ajoutée à la fin. Le Master IA & Cybersécurité approfondit l’audit, la détection et la sécurité des modèles.',
    period: '2025 — 2026',
    projects: [
      {
        name: 'Sécurité applicative',
        kind: 'Pro / Académique · 2025 — 2026',
        detail: 'Authentification et gestion des accès, durcissement des API, gestion des secrets et revue de code.',
      },
      {
        name: 'Préparation Master IA & Cybersécurité',
        kind: 'Académique · 2026 —',
        detail: 'Audit, détection, sécurité des systèmes et des modèles ; bonnes pratiques et conformité.',
      },
    ],
    stack: ['Auth · JWT · gestion des accès', 'Sécurité applicative · durcissement · secrets', 'Docker · Postman · PowerShell'],
    profile: [
      ['FORMATION', 'Master IA & Cybersécurité'],
      ['ÉCOLE', 'IIM — Léonard-de-Vinci'],
      ['DÉBUT', '2026'],
      ['DOMAINE', 'Sécurité applicative'],
    ],
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
    eyebrow: '03 · Intelligence artificielle',
    title: 'De la donnée au service.',
    body: 'Intégration d’IA en production : OCR, LLM, RAG, agents et MCP. Chaînes de traitement évaluées, mesurées et surveillées — un modèle ne vaut que s’il tourne et qu’on sait pourquoi il se trompe.',
    period: '2024 — 2026',
    projects: [
      {
        name: 'Chaînes IA',
        kind: 'Pro / Académique · 2025 — 2026',
        detail: 'OCR, LLM, RAG, agents et MCP : intégration, évaluation, mise en production et suivi des coûts.',
      },
      {
        name: 'Vision & données',
        kind: 'Académique · 2024 — 2026',
        detail: 'Détection et segmentation, préparation des jeux de données, mesure de performance.',
      },
    ],
    stack: ['OCR · LLM · RAG · MCP · LoRa', 'Vision · détection · segmentation', 'Inférence · coûts · observabilité'],
    profile: [
      ['FORMATION', 'IIM — 3ᵉ année'],
      ['MENTION', 'Major de promotion'],
      ['PÉRIODE', '2024 — 2026'],
      ['DOMAINE', 'IA appliquée'],
    ],
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
      { at: 0.8, pose: { explode: 1, rotor: 0.3, camAzimuth: 4.2, camElevation: 0.36, camDistance: 34, camTargetY: 0.5, camTargetZ: 0, camShiftX: -2.9, scan: 0.3 } },
      { at: 1.25, pose: { labels: 1 } },
      { at: 1.75, pose: { camAzimuth: 4.45, scan: 0.7 } },
    ],
  },
  {
    id: 'parcours',
    code: '04',
    eyebrow: '04 · Parcours',
    title: 'Un parcours, des livrables.',
    body: 'Chef de projet digital : équipes pluridisciplinaires — dev, design, marketing —, planning Gantt, backlog ClickUp, suivi GitHub Projects et engagement de délais. Le goût du travail bien cadré vient d’abord des schémas électriques : lire, corriger, documenter.',
    period: '2022 — 2026',
    stack: ['Pilotage transverse · interface client', 'Gantt · ClickUp · GitHub Issues / Projects', 'Agile · Scrum · qualité de livraison'],
    waypoints: [
      { code: '01', year: '2022', title: 'Électrotechnicien', org: 'Faymonville — Luxembourg' },
      { code: '02', year: '2024', title: 'Ingénierie web', org: 'IIM — Pôle Léonard-de-Vinci' },
      { code: '03', year: '2024', title: 'Développeur indépendant', org: 'Missions full-stack' },
      { code: '04', year: '2025', title: 'Chef de projet digital', org: 'Bourse au projet / Culture du mouvement' },
      { code: '05', year: '2026', title: 'Lead developer', org: 'Green Finance' },
      { code: '06', year: '2026', title: 'Master IA & Cybersécurité', org: 'IIM — alternance' },
    ],
    profile: [
      ['RÔLE', 'Chef de projet digital'],
      ['STRUCTURE', 'IIM — Bourse au projet'],
      ['PÉRIODE', '2025 — 2026'],
      ['MÉTHODE', 'Agile · Scrum'],
    ],
    mode: 'PARCOURS',
    align: 'center',
    span: 1.4,
    model: null,
    pose: { ...REST, rafale: 0, apache: 0, mq9: 0, camAzimuth: 2.3, camElevation: 0.22, camDistance: 24, camTargetY: -2.5, camShiftX: 0 },
  },
  {
    id: 'stack',
    code: '05',
    eyebrow: '05 · Stack technique',
    title: 'Les outils du quotidien.',
    body: 'Du prototype à la mise en production : une chaîne d’outils cohérente plutôt qu’une collection d’outils. Front-end, back-end, données et industrialisation.',
    period: '2024 — 2026',
    carousel: true,
    mode: 'STACK',
    profile: [
      ['FRONT-END', 'React · Next · Vue · Nuxt'],
      ['BACK-END', 'Node · Express · Java · Spring'],
      ['DONNÉES', 'PostgreSQL · MongoDB'],
      ['OUTILS', 'Docker · Git · Jest · Figma'],
    ],
    align: 'center',
    span: 1.3,
    model: null,
    pose: { ...REST, rafale: 0, apache: 0, mq9: 0, camAzimuth: 2.35, camElevation: 0.24, camDistance: 26, camTargetY: -2.4, camShiftX: 0 },
  },
  {
    id: 'contact',
    code: '06',
    eyebrow: '06 · Contact',
    title: 'Discutons de vos projets.',
    body: 'Disponible pour une alternance de 12 mois dès septembre 2026, des missions freelance et des postes à temps plein.',
    period: '2026',
    stack: ['Français · Anglais B2 · Russe (notions)', 'Astronomie · aéronautique · spéléologie'],
    profile: [
      ['ALTERNANCE', 'Septembre 2026'],
      ['RYTHME', '3 sem. / 1 sem.'],
      ['FREELANCE', 'Disponible'],
      ['LANGUES', 'FR · EN B2 · RU'],
    ],
    mode: 'CONTACT',
    align: 'center',
    span: 1,
    model: 'rafale',
    pose: {
      ...REST,
      rafale: 1,
      yaw: -0.1,
      pitch: 0.05,
      roll: -0.12,
      posY: 0.1,
      camAzimuth: 2.25,
      camElevation: 0.22,
      camDistance: 27,
      camTargetY: -2.3,
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
