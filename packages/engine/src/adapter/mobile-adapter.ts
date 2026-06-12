import { chromium, devices } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

export interface MobileSession {
  browser: Browser
  context: BrowserContext
  page: Page
}

// Playwright device emulation for mobile web testing.
// Simulates touch, viewport, and user-agent of real mobile devices.
export class MobileAdapter implements EngineAdapter<MobileSession> {
  readonly platform = 'mobile' as const

  async start(_profile: Profile, options: AdapterStartOptions): Promise<MobileSession> {
    const deviceName = options.device ?? 'iPhone 14'
    const device = devices[deviceName] ?? devices['iPhone 14']
    const browser = await chromium.launch({ headless: options.headless ?? false })
    const context = await browser.newContext({ ...device, locale: 'en-US' })
    const page = await context.newPage()
    return { browser, context, page }
  }

  async execute(session: MobileSession, step: Step, helpers: ExecutionHelpers): Promise<void> {
    const keyword = getKeyword(step.keyword)
    if (!keyword) throw new Error(`Unknown keyword: ${step.keyword}`)
    const executor = keyword.executors.mobile
    if (!executor) throw new Error(`Keyword "${step.keyword}" not supported on mobile`)
    await executor({
      page: session.page,
      objectRef: step.objectRef,
      input: step.input,
      expected: step.expected,
      resolveLocator: helpers.resolveLocator,
      interpolate: helpers.interpolate,
    })
  }

  async stop(session: MobileSession): Promise<void> {
    await session.browser.close()
  }
}
