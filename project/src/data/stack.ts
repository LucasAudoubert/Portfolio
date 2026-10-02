/**
 * The technical stack shown in the carousel.
 *
 * Icons are plain SVG files in `public/stack` (copied from a devicon-style
 * pack); they are rendered monochrome, so any coloured brand icon works.
 * The list mirrors the CV: front-end, back-end and tooling actually used.
 */

export interface StackItem {
  /** Label under the icon. */
  name: string
  /** File in public/stack. */
  icon: string
}

export interface StackRow {
  /** Row caption, e.g. "FRONT-END". */
  label: string
  items: StackItem[]
}

export const STACK: StackRow[] = [
  {
    label: 'Front-end',
    items: [
      { name: 'HTML5', icon: 'html5.svg' },
      { name: 'CSS3', icon: 'css3.svg' },
      { name: 'Sass', icon: 'sass.svg' },
      { name: 'Tailwind', icon: 'tailwind.svg' },
      { name: 'JavaScript', icon: 'javascript.svg' },
      { name: 'TypeScript', icon: 'typescript.svg' },
      { name: 'React', icon: 'react.svg' },
      { name: 'Next.js', icon: 'nextjs.svg' },
      { name: 'Vue.js', icon: 'vue.svg' },
      { name: 'Nuxt', icon: 'nuxt.svg' },
      { name: 'Three.js', icon: 'threejs.svg' },
      { name: 'Figma', icon: 'figma.svg' },
    ],
  },
  {
    label: 'Back-end & outils',
    items: [
      { name: 'Node.js', icon: 'nodejs.svg' },
      { name: 'Express', icon: 'express.svg' },
      { name: 'Python', icon: 'python.svg' },
      { name: 'Java', icon: 'java.svg' },
      { name: 'Spring Boot', icon: 'spring.svg' },
      { name: 'PostgreSQL', icon: 'postgresql.svg' },
      { name: 'MongoDB', icon: 'mongodb.svg' },
      { name: 'Docker', icon: 'docker.svg' },
      { name: 'Git', icon: 'git.svg' },
      { name: 'Jest', icon: 'jest.svg' },
      { name: 'Postman', icon: 'postman.svg' },
      { name: 'PowerShell', icon: 'powershell.svg' },
    ],
  },
]

export const STACK_COUNT = STACK.reduce((total, row) => total + row.items.length, 0)
