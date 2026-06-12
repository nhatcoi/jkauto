import type { TestCase, Profile, Platform, ObjectRepository, Locator } from '@jkauto/core'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import { getAdapter } from './adapter/registry'

export type StepEventCallback = (event: StepEvent) => void
export type RunCompleteCallback = (event: RunCompleteEvent) => void

export interface RunOptions {
  headless?: boolean
  stepDelay?: number
  waitForNext?: (stepIndex: number) => Promise<void>
  platform?: Platform
  /** Loaded object repositories for resolveLocator. Passed by engine handler at runtime. */
  objectRepositories?: ObjectRepository[]
  /** Mobile device name, e.g. "iPhone 14". Forwarded to adapter.start(). */
  device?: string
  /** Desktop app executable path. Forwarded to adapter.start(). */
  appPath?: string
}

function buildSelector(locator: Locator): string {
  switch (locator.strategy) {
    case 'testid': return `[data-testid="${locator.value}"]`
    case 'css': return locator.value
    case 'xpath': return `xpath=${locator.value}`
    case 'text': return `text=${locator.value}`
    case 'role': return `role=${locator.value}`
    case 'label': return `[aria-label="${locator.value}"]`
    case 'placeholder': return `[placeholder="${locator.value}"]`
    default: return locator.value
  }
}

function buildLocatorIndex(repos: ObjectRepository[], platform: Platform): Map<string, string> {
  const index = new Map<string, string>()
  for (const repo of repos) {
    for (const obj of repo.objects) {
      // Platform-specific locators first, then untagged ones.
      const candidates = obj.locators
        .filter((l) => !l.platform || l.platform === platform)
        .sort((a, b) => b.priority - a.priority)
      const best = candidates[0]
      if (!best) continue
      const selector = buildSelector(best)
      index.set(obj.name.toLowerCase(), selector)
      index.set(`${repo.name.toLowerCase()}.${obj.name.toLowerCase()}`, selector)
    }
  }
  return index
}

export async function runTestCase(
  testCase: TestCase,
  profile: Profile,
  runId: string,
  onStep: StepEventCallback,
  onComplete: RunCompleteCallback,
  signal?: AbortSignal,
  options: RunOptions = {},
): Promise<void> {
  const { headless = false, stepDelay = 0, waitForNext, objectRepositories = [], device, appPath } = options
  const platform: Platform = testCase.platform ?? options.platform ?? 'web'
  const startTime = Date.now()
  let passedSteps = 0
  let failedSteps = 0

  const variables = profile.variables
  const locatorIndex = buildLocatorIndex(objectRepositories, platform)

  function interpolate(value: string): string {
    return value
      .replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
      .replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? `\${${key}}`)
  }

  async function resolveLocator(ref: string): Promise<string> {
    if (!ref) return ''
    // Object repo lookup: try exact key, then case-insensitive.
    const key = ref.toLowerCase()
    const resolved = locatorIndex.get(key)
    if (resolved) return resolved
    // Fall back to treating ref as a raw CSS / XPath selector.
    return ref
  }

  const adapter = getAdapter(platform)
  const session = await adapter.start(profile, { headless, device, appPath })

  try {
    for (let i = 0; i < testCase.steps.length; i++) {
      if (signal?.aborted) break

      const step = testCase.steps[i]
      if (!step.enabled) {
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'skipped' })
        continue
      }

      onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'running' })

      const stepStart = Date.now()
      const timeout = step.timeout ?? 30000
      try {
        await Promise.race([
          adapter.execute(session, step, { resolveLocator, interpolate }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout after ${timeout}ms`)), timeout),
          ),
        ])
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'passed', durationMs: Date.now() - stepStart })
        passedSteps++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'failed', message, durationMs: Date.now() - stepStart })
        failedSteps++
        if (!step.continueOnFailure) break
      }

      if (waitForNext && !signal?.aborted) {
        await waitForNext(i)
      } else if (stepDelay > 0 && !signal?.aborted) {
        await new Promise((r) => setTimeout(r, stepDelay))
      }
    }
  } finally {
    await adapter.stop(session)
  }

  const finalStatus = signal?.aborted ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed'
  onComplete({ runId, status: finalStatus, totalSteps: testCase.steps.length, passedSteps, failedSteps, durationMs: Date.now() - startTime })
}
