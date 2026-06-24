import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '../..')

// Resolve workspace packages by source (bypasses bundler-resolution dist files)
const workspaceAlias = {
  '@jkauto/engine': path.join(root, 'packages/engine/src/index.ts'),
  '@jkauto/core': path.join(root, 'packages/core/src/index.ts'),
  '@jkauto/project-fs': path.join(root, 'packages/project-fs/src/index.ts'),
  '@jkauto/storage': path.join(root, 'packages/storage/src/index.ts'),
}

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  alias: workspaceAlias,
  // Externalize heavy native packages — must be installed alongside the CLI
  external: [
    '@playwright/test',
    'playwright',
    'playwright-core',
    'chromium-bidi',
    'webdriverio',
    'fsevents',
  ],
}

// CLI binary
await build({
  ...common,
  entryPoints: [path.join(dir, 'src/cli.ts')],
  outfile: path.join(dir, 'dist/cli.cjs'),
  banner: { js: '#!/usr/bin/env node' },
})

// Public API
await build({
  ...common,
  entryPoints: [path.join(dir, 'src/index.ts')],
  outfile: path.join(dir, 'dist/index.cjs'),
})

console.log('CLI built successfully')
