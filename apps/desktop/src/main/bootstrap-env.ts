// MUST be the first import in the main entry (index.ts).
//
// Playwright computes its browsers registry directory from
// PLAYWRIGHT_BROWSERS_PATH once, at module-eval time. web-adapter.ts imports
// @playwright/test, so by the time any run handler executes the path is already
// frozen. GUI-launched Electron does not inherit the shell env, so we must seed
// the var synchronously here — before the engine (and thus Playwright) is imported.
import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const envPaths = [
  join(app.getAppPath(), '.env'),
  join(process.cwd(), 'apps', 'desktop', '.env'),
  join(process.cwd(), '.env'),
]

for (const envPath of envPaths) {
  if (!existsSync(envPath)) continue
  process.loadEnvFile(envPath)
  break
}

if (!process.env['PLAYWRIGHT_BROWSERS_PATH']) {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    const dir = settings?.execution?.browsersPath
    if (typeof dir === 'string' && dir.trim()) {
      process.env['PLAYWRIGHT_BROWSERS_PATH'] = dir.trim()
    }
  } catch {
    // No settings file yet (first launch) — Playwright uses its default cache.
  }
}
