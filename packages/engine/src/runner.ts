import type { TestCase, Profile, Platform, ObjectRepository, Locator, MobileTestType } from '@jkauto/core'
import type { StepEvent, RunCompleteEvent } from '@jkauto/core'
import { getAdapter } from './adapter/registry'
import type { EngineAdapter } from './adapter/types'

export type StepEventCallback = (event: StepEvent) => void
export type RunCompleteCallback = (event: RunCompleteEvent) => void

export interface RunOptions {
  headless?: boolean
  stepDelay?: number
  waitForNext?: (stepIndex: number) => Promise<void>
  platform?: Platform
  /** Loaded object repositories for resolveLocator. Passed by engine handler at runtime. */
  objectRepositories?: ObjectRepository[]
  /** Desktop/Appium app executable path. Forwarded to adapter.start(). */
  appPath?: string
  /** Pre-created session to reuse. When provided, start/stop are skipped — caller owns lifecycle. */
  externalSession?: unknown
  /** Loads a test case by path for call-test-case keyword — provided by engine handler. */
  loadTestCase?: (path: string) => Promise<TestCase>
}

function buildSelector(locator: Locator, platform: Platform): string {
  if (platform === 'appium') {
    // WebDriverIO Appium selector conventions.
    switch (locator.strategy) {
      case 'testid':
      case 'label': return `~${locator.value}`          // accessibility ID
      case 'xpath': return locator.value               // must start with //
      case 'text':  return `~${locator.value}`         // accessibility label fallback
      default:      return locator.value
    }
  }
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
      const selector = buildSelector(best, platform)
      index.set(obj.name.toLowerCase(), selector)
      index.set(`${repo.name.toLowerCase()}.${obj.name.toLowerCase()}`, selector)
    }
  }
  return index
}

async function executeCalledTestCase(
  calledPath: string,
  loadTestCase: ((path: string) => Promise<TestCase>) | undefined,
  adapter: EngineAdapter,
  session: unknown,
  ctx: { resolveLocator: (ref: string) => Promise<string>; interpolate: (value: string) => string },
  signal: AbortSignal | undefined,
): Promise<void> {
  const resolvedPath = ctx.interpolate(calledPath)
  if (!resolvedPath) throw new Error('call-test-case: no test case path specified')
  if (!loadTestCase) throw new Error('call-test-case: file system not available in this context')
  const calledTc = await loadTestCase(resolvedPath)
  for (const subStep of calledTc.steps) {
    if (signal?.aborted) break
    if (!subStep.enabled) continue
    await adapter.execute(session, subStep, ctx)
  }
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
  const { headless = false, stepDelay = 0, waitForNext, objectRepositories = [], appPath, externalSession, loadTestCase } = options
  const platform: Platform = testCase.platform ?? options.platform ?? 'web'
  // When platform is 'mobile', resolve to the concrete engine adapter key.
  const mobileTestType: MobileTestType = testCase.mobileTestType ?? 'normal'
  const adapterKey = platform === 'mobile'
    ? (mobileTestType === 'appium' ? 'appium' : 'maestro')
    : platform
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
    const key = ref.toLowerCase()
    const resolved = locatorIndex.get(key)
    if (resolved) return resolved
    return ref
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = getAdapter(adapterKey as any)
  const session = externalSession ?? await adapter.start(profile, { headless, appPath })

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
        const work = step.keyword === 'call-test-case'
          ? executeCalledTestCase(step.input, loadTestCase, adapter, session, { resolveLocator, interpolate }, signal)
          : adapter.execute(session, step, { resolveLocator, interpolate })
        await Promise.race([
          work,
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
    if (!externalSession) {
      await adapter.stop(session)
    }
  }

  const finalStatus = signal?.aborted ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed'
  onComplete({ runId, status: finalStatus, totalSteps: testCase.steps.length, passedSteps, failedSteps, durationMs: Date.now() - startTime })
}
