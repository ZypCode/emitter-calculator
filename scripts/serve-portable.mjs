import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const portableDir = join(root, '便携版')
const defaultJson = join(root, 'public', 'data', 'default-state.json')
const PORT = 8765

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

function safePath(rootDir, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '')
  const full = normalize(join(rootDir, rel))
  if (!full.startsWith(normalize(rootDir))) return null
  return full
}

function openBrowser(url) {
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
}

const entryHtml = existsSync(join(portableDir, 'index.html'))
  ? 'index.html'
  : existsSync(join(portableDir, 'offline.html'))
    ? 'offline.html'
    : null
if (!entryHtml) {
  console.error('未找到便携版，请先执行: npm run build:offline')
  process.exit(1)
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const raw = (req.url ?? '/').split('?')[0]
  let urlPath = raw === '/' ? `/${entryHtml}` : raw

  if (urlPath === '/api/default-state' && (req.method === 'PUT' || req.method === 'POST')) {
    try {
      const body = await readRequestBody(req)
      JSON.parse(body)
      mkdirSync(dirname(defaultJson), { recursive: true })
      writeFileSync(defaultJson, body, 'utf8')
      send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8')
    } catch (e) {
      send(res, 400, e instanceof Error ? e.message : 'invalid json')
    }
    return
  }

  if (urlPath === '/data/default-state.json' || urlPath.endsWith('/data/default-state.json')) {
    if (!existsSync(defaultJson)) {
      send(res, 404, 'default-state.json not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    createReadStream(defaultJson).pipe(res)
    return
  }

  const filePath = safePath(portableDir, urlPath.replace(/^\//, ''))
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, 'Not found')
    return
  }

  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(res)
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`
  console.log('配置来源: public/data/default-state.json（修改后浏览器刷新或点「重新加载」即可）')
  console.log(url)
  openBrowser(url)
  console.log('按 Ctrl+C 结束')
})