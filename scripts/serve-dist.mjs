import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const publicRoot = resolve(projectRoot, 'dist')
const port = Number.parseInt(process.env.PORT || '8794', 10)

const mimeTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.riv': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

if (!existsSync(resolve(publicRoot, 'index.html'))) {
  throw new Error('No production build found. Run npm run build first.')
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method not allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(
      new URL(request.url, `http://127.0.0.1:${port}`).pathname,
    )
  } catch {
    response.writeHead(400)
    response.end('Bad request')
    return
  }

  let target = resolve(publicRoot, pathname.replace(/^\/+/, ''))
  const targetRelative = relative(publicRoot, target)

  if (targetRelative.startsWith('..') || targetRelative.includes(':')) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = resolve(target, 'index.html')
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type':
      mimeTypes[extname(target).toLowerCase()] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(target).pipe(response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Production preview: http://127.0.0.1:${port}/`)
})
