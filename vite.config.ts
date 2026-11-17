import { defineConfig } from 'vite'
import { attachDefaultStateApi } from './scripts/dev-default-api.mjs'

const base = process.env.GITHUB_PAGES === '1' ? '/emitter-calculator/' : '/'

export default defineConfig({
  base,
  server: {
    open: true,
  },
  plugins: [
    {
      name: 'default-state-api',
      configureServer(server) {
        attachDefaultStateApi(server)
      },
    },
  ],
})