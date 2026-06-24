import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import type { Profile, Step } from '@jkauto/core'
import { getKeyword } from '../keywords/registry'
import type { EngineAdapter, ExecutionHelpers, AdapterStartOptions } from './types'

async function launchChromium(headless: boolean): Promise<Browser> {
  try {
    return await chromium.launch({ headless })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes("Executable doesn't exist")) throw err
    // Browser not installed — auto-install then retry once
    execFileSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
    })
    return chromium.launch({ headless })
  }
}

export interface WebSession {
  browser: Browser
  context: BrowserContext
  page: Page
}

export class WebAdapter implements EngineAdapter<WebSession> {
  readonly platform = 'web' as const

  async start(_profile: Profile, options: AdapterStartOptions): Promise<WebSession> {
    const browser = await launchChromium(options.headless ?? false)
    const context = await browser.newContext()
    const page = await context.newPage()
    return { browser, context, page }
  }

  async execute(session: WebSession, step: Step, helpers: ExecutionHelpers): Promise<void> {
    const keyword = getKeyword(step.keyword)
    if (!keyword) {
      throw new Error(`Unknown keyword: ${step.keyword}`)
    }
    const executor = keyword.executors.web
    if (!executor) {
      throw new Error(`Keyword "${step.keyword}" not supported on web`)
    }
    await executor({
      page: session.page,
      objectRef: step.objectRef,
      input: step.input,
      expected: step.expected,
      resolveLocator: helpers.resolveLocator,
      interpolate: helpers.interpolate,
    })
  }

  async stop(session: WebSession): Promise<void> {
    await session.browser.close()
  }

  async screenshot(session: WebSession, { path }: { path: string }): Promise<void> {
    await session.page.screenshot({ path, fullPage: true })
  }
}
