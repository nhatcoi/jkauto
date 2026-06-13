import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@jkauto/engine', '@jkauto/core'] })],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@jkauto/engine': resolve('../../packages/engine/src/index.ts'),
        '@jkauto/core': resolve('../../packages/core/src/index.ts'),
      },
    },
    build: {
      watch: {
        include: ['src/main/**', '../../packages/engine/src/**', '../../packages/core/src/**'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
    css: {
      postcss: resolve('postcss.config.js'),
    },
  },
})
