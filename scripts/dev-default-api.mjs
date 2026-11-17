import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultJson = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'default-state.json')

/** Vite 开发服务器：PUT /api/default-state 写入 public/data/default-state.json */
export function attachDefaultStateApi(server) {
  server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/default-state' || (req.method !== 'PUT' && req.method !== 'POST')) {
      next()
      return
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8')
        JSON.parse(body)
        mkdirSync(dirname(defaultJson), { recursive: true })
        writeFileSync(defaultJson, body, 'utf8')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.statusCode = 400
        res.end(String(e instanceof Error ? e.message : 'invalid json'))
      }
    })
  })
}