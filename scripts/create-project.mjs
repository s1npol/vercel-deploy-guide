import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templateRoot = join(projectRoot, 'templates', 'project-page')
const projectsRoot = join(projectRoot, 'projects')
const [rawSlug = '', ...titleParts] = process.argv.slice(2)
const slug = rawSlug.trim().toLowerCase()
const fallbackTitle = slug
  .split('-')
  .filter(Boolean)
  .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')
const title = titleParts.join(' ').trim() || fallbackTitle

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error(
    'Use a lowercase project slug with letters, numbers, and single hyphens, for example: smart-product',
  )
}

if (!title) {
  throw new Error('Provide a project title after the slug.')
}

if (!existsSync(templateRoot)) {
  throw new Error(`Project template is missing: ${templateRoot}`)
}

const targetRoot = resolve(projectsRoot, slug)
const normalizedProjectsRoot = `${resolve(projectsRoot).toLowerCase()}\\`
if (!targetRoot.toLowerCase().startsWith(normalizedProjectsRoot)) {
  throw new Error('Refusing to create a project outside the projects folder.')
}

if (existsSync(targetRoot)) {
  throw new Error(`Project already exists: projects/${slug}`)
}

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

cpSync(templateRoot, targetRoot, {
  recursive: true,
  filter: (source) => basename(source).toLowerCase() !== 'readme.md',
})
mkdirSync(join(targetRoot, 'assets', 'media'), { recursive: true })

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.svg'])
const queue = [targetRoot]
while (queue.length) {
  const current = queue.pop()
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const fullPath = join(current, entry.name)
    if (entry.isDirectory()) {
      queue.push(fullPath)
      continue
    }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name).toLowerCase())) {
      continue
    }

    const original = readFileSync(fullPath, 'utf8')
    const updated = original
      .replaceAll('{{PROJECT_SLUG}}', slug)
      .replaceAll('{{PROJECT_TITLE}}', escapeHtml(title))
    if (updated !== original) {
      writeFileSync(fullPath, updated, 'utf8')
    }
  }
}

if (!statSync(join(targetRoot, 'index.html')).isFile()) {
  throw new Error('Generated project is missing index.html.')
}

console.log(`Created projects/${slug}`)
console.log('Next:')
console.log('1. Replace every remaining {{PROJECT_...}} placeholder.')
console.log('2. Add optimized local media to assets/media/.')
console.log('3. Test the page on mobile and desktop.')
console.log('4. Add its relative URL to portfolio-graft.js only when complete.')
