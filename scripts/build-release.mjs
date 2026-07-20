import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = join(projectRoot, 'dist')
const verifyOnly = process.argv.includes('--verify-only')

const productionFiles = [
  '.nojekyll',
  'index.html',
  'portfolio-graft.css',
  'portfolio-graft.js',
  'project-viewport-fit.css',
  'site-loader.css',
  'site-loader.js',
  'site-loader-visual.js',
]

const productionDirectories = [
  '_sui-origin-assets',
  'assets',
  'portfolio-graft-assets',
  'project-page-assets',
  'projects',
  'scraped-assets',
  'site-loader-assets',
  'slater-local',
]

const releaseOnlyExcludes = [
  'projects/food-container/assets/daily-lunch-case/internal-layout.png',
  'projects/food-container/assets/daily-lunch-case/internal-boxes.png',
]

const forbiddenNames = new Set([
  '_backups',
  'templates',
  '_sui-original.html',
  'video-inspect.html',
  'serve-8793.cjs',
  'server-8777.err.log',
  'server-8777.out.log',
  '_server-8793.err.log',
  '_server-8793.out.log',
])

const forbiddenContent = [
  '{{PROJECT_',
  'api_key',
  'cdn.prod.website-files.com',
  'res.cloudinary.com',
  'd8j0ntlcm91z4.cloudfront.net',
]

const forbiddenPatterns = [
  {
    label: 'mainland China mobile phone number',
    pattern: /\b1[3-9]\d{9}\b/,
  },
]

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.md',
  '.svg',
  '.txt',
  '.xml',
])

const transparentPixel =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

function assertInsideProject(path) {
  const relativePath = relative(projectRoot, resolve(path))
  const escapesProject =
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)

  if (escapesProject) {
    throw new Error(`Refusing to write outside the project: ${path}`)
  }
}

function copyRequiredFile(name) {
  const source = join(projectRoot, name)
  const destination = join(outputRoot, name)
  if (!existsSync(source)) {
    throw new Error(`Missing production file: ${name}`)
  }
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
}

function copyRequiredDirectory(name) {
  const source = join(projectRoot, name)
  const destination = join(outputRoot, name)
  if (!existsSync(source)) {
    throw new Error(`Missing production directory: ${name}`)
  }
  cpSync(source, destination, { recursive: true })
}

function sanitizeLegacyHtml() {
  const indexPath = join(outputRoot, 'index.html')
  let html = readFileSync(indexPath, 'utf8')

  html = html
    .replace(
      /<link\b[^>]*href=["']_sui-origin-assets\/sui-v2\.shared\.[^"']+\.css["'][^>]*>/gi,
      (tag) =>
        tag
          .replace(/\s+integrity=["'][^"']+["']/i, '')
          .replace(/\s+crossorigin=["'][^"']+["']/i, ''),
    )
    .replace(
      /<link\b[^>]*rel=["']preconnect["'][^>]*cdn\.prod\.website-files\.com[^>]*>\s*/gi,
      '',
    )
    .replace(
      /<link\b[^>]*cdn\.prod\.website-files\.com[^>]*rel=["']preconnect["'][^>]*>\s*/gi,
      '',
    )
    .replace(
      /<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi,
      '',
    )
    .replace(
      /<link\b[^>]*rel=["']shortcut icon["'][^>]*>/gi,
      (tag) =>
        tag.replace(
          /href=["'][^"']*["']/i,
          'href="assets/sinpol-logo/sinpol_blue1.svg"',
        ),
    )
    .replace(
      /<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi,
      (tag) =>
        tag.replace(
          /content=["'][^"']*["']/i,
          'content="projects/food-container/assets/daily-lunch-case/components.webp"',
        ),
    )
    .replace(
      /(\s(?:src|srcset|poster|data-poster))=["']https:\/\/(?:cdn\.prod\.website-files\.com|res\.cloudinary\.com)\/[^"']*["']/gi,
      (_, attribute) => `${attribute}="${transparentPixel}"`,
    )
    .replace(
      /(\s(?:data-src|global-src|href))=["']https:\/\/(?:cdn\.prod\.website-files\.com|res\.cloudinary\.com)\/[^"']*["']/gi,
      (_, attribute) => `${attribute}=""`,
    )
    .replace(
      /url\(\s*["']?https:\/\/(?:cdn\.prod\.website-files\.com|res\.cloudinary\.com)\/[^)]*\)/gi,
      'none',
    )

  writeFileSync(indexPath, html, 'utf8')
}

function listFiles(root) {
  const files = []
  const queue = [root]

  while (queue.length) {
    const current = queue.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function sanitizeLegacyStylesheets() {
  const legacyStylesRoot = join(outputRoot, '_sui-origin-assets')

  for (const file of listFiles(legacyStylesRoot)) {
    if (extname(file).toLowerCase() !== '.css') {
      continue
    }

    const original = readFileSync(file, 'utf8')
    const sanitized = original.replace(
      /url\(\s*["']?https:\/\/(?:cdn\.prod\.website-files\.com|res\.cloudinary\.com)\/[^)]*\)/gi,
      'none',
    )

    if (sanitized !== original) {
      writeFileSync(file, sanitized, 'utf8')
    }
  }
}

function removeReleaseOnlyExcludes() {
  for (const name of releaseOnlyExcludes) {
    const target = join(outputRoot, name)
    assertInsideProject(target)
    rmSync(target, { force: true })
  }
}

function verifyLocalHtmlReferences() {
  const htmlFiles = listFiles(outputRoot).filter(
    (file) => extname(file).toLowerCase() === '.html',
  )
  const attributePattern =
    /\b(?:src|href|poster|data-src)=["']([^"']+)["']/gi

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8')
    let match

    while ((match = attributePattern.exec(html))) {
      const raw = match[1].trim()
      if (
        !raw ||
        raw.startsWith('#') ||
        /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw) ||
        raw.includes('{{')
      ) {
        continue
      }

      const pathname = raw.split(/[?#]/, 1)[0]
      if (!pathname) {
        continue
      }

      let decoded
      try {
        decoded = decodeURIComponent(pathname)
      } catch {
        throw new Error(
          `Invalid encoded URL "${raw}" in ${relative(outputRoot, htmlFile)}`,
        )
      }

      let target = decoded.startsWith('/')
        ? resolve(outputRoot, decoded.replace(/^\/+/, ''))
        : resolve(dirname(htmlFile), decoded)
      assertInsideProject(target)

      if (existsSync(target) && statSync(target).isDirectory()) {
        target = join(target, 'index.html')
      }

      if (!existsSync(target)) {
        throw new Error(
          `Missing local asset "${raw}" referenced by ${relative(outputRoot, htmlFile)}`,
        )
      }
    }
  }
}

function verifyRelease() {
  if (!existsSync(outputRoot)) {
    throw new Error('No dist directory found. Run npm run build first.')
  }

  for (const name of forbiddenNames) {
    if (existsSync(join(outputRoot, name))) {
      throw new Error(`Forbidden release artifact found: ${name}`)
    }
  }

  const files = listFiles(outputRoot)

  for (const file of files) {
    if (!textExtensions.has(extname(file).toLowerCase())) {
      continue
    }

    const contents = readFileSync(file, 'utf8')
    for (const pattern of forbiddenContent) {
      if (contents.includes(pattern)) {
        throw new Error(
          `Forbidden content "${pattern}" found in ${relative(outputRoot, file)}`,
        )
      }
    }

    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(contents)) {
        throw new Error(
          `Forbidden content "${label}" found in ${relative(outputRoot, file)}`,
        )
      }
    }
  }

  verifyLocalHtmlReferences()

  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0)
  return { files: files.length, totalBytes }
}

assertInsideProject(outputRoot)

if (!verifyOnly) {
  rmSync(outputRoot, { recursive: true, force: true })
  mkdirSync(outputRoot, { recursive: true })

  productionFiles.forEach(copyRequiredFile)
  productionDirectories.forEach(copyRequiredDirectory)
  sanitizeLegacyHtml()
  sanitizeLegacyStylesheets()
  removeReleaseOnlyExcludes()
}

const result = verifyRelease()
console.log(`Production output ready: ${outputRoot}`)
console.log(`Files: ${result.files}`)
console.log(`Size: ${(result.totalBytes / 1024 / 1024).toFixed(2)} MB`)
