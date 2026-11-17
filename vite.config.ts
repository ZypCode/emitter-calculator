import { defineConfig } from 'vite'

const base = process.env.GITHUB_PAGES === '1' ? '/emitter-calculator/' : '/'

export default defineConfig({
  base,
  server: {
    open: true,
  },
})