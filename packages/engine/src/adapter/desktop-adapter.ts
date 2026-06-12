import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

export interface DesktopSession {
  app: ElectronApplication
  page: Page
}

// Playwright Electron adapter for desktop app testing.
// Requires APP_PATH in profile variables or options.appPath.
export class DesktopAdapter implements EngineAdapter<DesktopSession> {
  readonly platform = 'desktop' as const

  async start(profile: Profile, options: AdapterStartOptions): Promise<DesktopSession> {
    const appPath = options.appPath ?? profile.variables['APP_PATH']
    if (!appPath) {
      throw new Error('DesktopAdapter requires APP_PATH in profile variables or options.appPath')
    }
    const app = await electron.launch({ args: [appPath] })
    const page = await app.firstWindow()
    return { app, page }
  }

  async execute(session: DesktopSession, step: Step, helpers: ExecutionHelpers): Promise<void> {
    const keyword = getKeyword(step.keyword)
    if (!keyword) throw new Error(`Unknown keyword: ${step.keyword}`)
    const executor = keyword.executors.desktop
    if (!executor) throw new Error(`Keyword "${step.keyword}" not supported on desktop`)
    await executor({
      page: session.page,
      objectRef: step.objectRef,
      input: step.input,
      expected: step.expected,
      resolveLocator: helpers.resolveLocator,
      interpolate: helpers.interpolate,
    })
  }

  async stop(session: DesktopSession): Promise<void> {
    await session.app.close()
  }
}
