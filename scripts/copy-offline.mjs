import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'offline', 'offline.html')
const dest = join(root, '发射器库存计算器.html')

copyFileSync(src, dest)
mkdirSync(dirname(dest), { recursive: true })
console.log('已生成:', dest)