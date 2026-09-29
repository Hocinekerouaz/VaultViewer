import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            const match = id
              .replace(/\\/g, '/')
              .match(/.*\/node_modules\/((?:@[^/]+\/)?[^/]+)/)
            if (!match) return undefined
            const pkg = match[1]
            if (pkg === 'codemirror' || pkg.startsWith('@codemirror/') || pkg.startsWith('@lezer/'))
              return 'editor'
            return 'vendor'
          }
        }
      }
    }
  }
})
