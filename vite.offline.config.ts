import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: '便携版',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'offline.html'),
      },
    },
  },
})