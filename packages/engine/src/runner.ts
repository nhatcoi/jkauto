import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestCase, Profile, Platform, ObjectRepository, Locator } from '@jkauto/core'
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
  /** Directory to save on-failure screenshots. When set, a PNG is captured after each failed step. */
  screenshotDir?: string
  /** 'failure' (default) = screenshot only on failed steps; 'final' = also screenshot at test end. */
  screenshotMode?: 'failure' | 'final'
  /** Callback to persist a variable to the active profile file. Provided by engine handler. */
  persistVariable?: (profileKey: string, value: string) => Promise<void>
  /** Callback to persist a value into profile.api (baseUrl, auth, defaultHeaders). */
  persistApiConfig?: (profileKey: string, value: string) => Promise<void>
  /** Extra variables from a data-file row — merged on top of profile.variables. */
  rowVars?: Record<string, string>
  /** Current data-file row index (0-based). Forwarded into StepEvent for UI display. */
  rowIndex?: number
  /** Total number of data-file rows in this run. */
  totalRows?: number
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

function resolveMaestro(): string {
  const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
  for (const shell of shells) {
    try {
      const bin = execSync(`${shell} -lc "which maestro"`, { encoding: 'utf-8', timeout: 3000 }).trim()
      if (bin) return bin
    } catch { /* try next */ }
  }
  const candidates = [
    `${process.env['HOME'] ?? ''}/.maestro/bin/maestro`,
    '/usr/local/bin/maestro',
    '/opt/homebrew/bin/maestro',
  ]
  for (const candidate of candidates) {
    try { execSync(`test -x "${candidate}"`); return candidate } catch { /* skip */ }
  }
  throw new Error('Maestro CLI not found')
}

function yamlScalar(value: string): string {
  return JSON.stringify(value)
}

function maestroTarget(step: { objectRef: string; input: string; expected: string }): string {
  return step.objectRef || step.input || step.expected
}

/**
 * Convert objectRef to Maestro selector YAML fragment.
 * ~accessibilityId  →  block form:  "\n    id: \"value\""
 * plain text/other  →  inline form: " \"value\""
 */
function maestroRef(ref: string): string {
  if (ref.startsWith('~')) return `\n    id: ${yamlScalar(ref.slice(1))}`
  return ` ${yamlScalar(ref)}`
}

function maestroCommand(step: TestCase['steps'][number], interpolate: (value: string) => string): string[] {
  const keyword = step.keyword
  const target = interpolate(maestroTarget(step))
  const input = interpolate(step.input)
  const expected = interpolate(step.expected)
  const objectRef = interpolate(step.objectRef)

  switch (keyword) {
    case 'mobile.launchApp':
    case 'launchApp': {
      const clearState = input === 'clearState' || input === 'true'
      return clearState ? ['- launchApp:\n    clearState: true'] : ['- launchApp']
    }
    case 'clearState':
    case 'mobile.clearState':
      return ['- clearState']
    case 'mobile.tap':
    case 'mobile.inputText':
    case 'tapOn':
    case 'tap':
      return [`- tapOn:${maestroRef(target)}`]
    case 'type-text':
      return objectRef
        ? [`- tapOn:${maestroRef(objectRef)}`, `- inputText: ${yamlScalar(input)}`]
        : [`- inputText: ${yamlScalar(input)}`]
    case 'inputText':
      return objectRef
        ? [`- tapOn:${maestroRef(objectRef)}`, `- inputText: ${yamlScalar(input)}`]
        : [`- inputText: ${yamlScalar(input)}`]
    case 'mobile.assertVisible':
    case 'assertVisible':
    case 'assert-visible':
    case 'wait-for-element':
    case 'mobile.waitForVisible':
      return [`- assertVisible:${maestroRef(target || expected)}`]
    case 'mobile.assertNotVisible':
    case 'assertNotVisible':
      return [`- assertNotVisible:${maestroRef(target || expected)}`]
    case 'assert-text':
      // Check element visible by id, then check expected text visible on screen
      return [
        ...(objectRef ? [`- assertVisible:${maestroRef(objectRef)}`] : []),
        `- assertVisible: ${yamlScalar(expected || target)}`,
      ]
    case 'mobile.back':
    case 'back':
      return ['- back']
    case 'mobile.pressKey':
    case 'pressKey':
      return [`- pressKey: ${yamlScalar(input)}`]
    case 'mobile.screenshot':
    case 'takeScreenshot':
      return [`- takeScreenshot: ${yamlScalar(input || step.name || step.id)}`]
    case 'mobile.swipe':
    case 'swipe':
      return [`- swipe: ${yamlScalar(input || 'up')}`]
    case 'mobile.closeApp':
    case 'closeApp':
    case 'clear-text':
    case 'mobile.clearText':
      // No equivalent in Maestro; skip
      return []
    default:
      throw new Error(`Maestro runner does not support keyword: ${keyword}`)
  }
}

async function runMaestroTestCase(
  testCase: TestCase,
  profile: Profile,
  runId: string,
  onStep: StepEventCallback,
  onComplete: RunCompleteCallback,
  signal: AbortSignal | undefined,
): Promise<void> {
  const startTime = Date.now()
  const __builtins: Record<string, string> = { __timestamp: String(Date.now()), __rand: Math.random().toString(36).slice(2, 8) }
  const variables = { ...__builtins, ...testCase.variables, ...profile.variables }
  const appId = testCase.app?.id || variables['APP_ID']
  if (!appId) throw new Error('Maestro runner requires app.id or APP_ID')

  function interpolate(value: string): string {
    return value
      .replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
      .replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? `\${${key}}`)
  }

  const enabledSteps = testCase.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.enabled)

  for (const { index } of enabledSteps) {
    onStep({ runId, testCaseId: testCase.id, stepIndex: index, status: 'running' })
  }

  const flow = [
    `appId: ${yamlScalar(appId)}`,
    '---',
    ...enabledSteps.flatMap(({ step }) => maestroCommand(step, interpolate)),
    '',
  ].join('\n')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jkauto-maestro-'))
  const flowPath = path.join(dir, `${testCase.id || 'test'}.yaml`)
  await fs.writeFile(flowPath, flow, 'utf-8')

  let failed = false
  let error = ''
  const maestro = resolveMaestro()
  const proc = spawn(maestro, ['test', flowPath], { stdio: 'pipe' })
  signal?.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true })
  proc.stderr?.on('data', (chunk: Buffer) => { error += chunk.toString() })
  proc.stdout?.on('data', (chunk: Buffer) => { error += chunk.toString() })

  const code = await new Promise<number | null>((resolve, reject) => {
    proc.on('exit', resolve)
    proc.on('error', reject)
  })
  failed = code !== 0 || !!signal?.aborted

  let passedSteps = 0
  let failedSteps = 0
  for (const { index } of enabledSteps) {
    if (failed) {
      failedSteps++
      onStep({ runId, testCaseId: testCase.id, stepIndex: index, status: 'failed', message: error.trim() || `Maestro exited with code ${code}` })
    } else {
      passedSteps++
      onStep({ runId, testCaseId: testCase.id, stepIndex: index, status: 'passed' })
    }
  }

  onComplete({
    runId,
    status: signal?.aborted ? 'stopped' : failed ? 'failed' : 'passed',
    totalSteps: testCase.steps.length,
    passedSteps,
    failedSteps,
    durationMs: Date.now() - startTime,
  })
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
  const { headless = false, stepDelay = 0, waitForNext, objectRepositories = [], appPath, externalSession, loadTestCase, screenshotDir, screenshotMode = 'failure', persistVariable, persistApiConfig, rowVars, rowIndex, totalRows } = options
  const platform: Platform = testCase.platform
    ?? (testCase.runner === 'api' ? 'api' : options.platform ?? 'web')
  // When platform is 'mobile', resolve to the concrete engine adapter key.
  const adapterKey = platform === 'mobile'
    ? (testCase.runner === 'appium' ? 'appium' : 'maestro')
    : platform
  if (adapterKey === 'maestro') {
    await runMaestroTestCase(testCase, profile, runId, onStep, onComplete, signal)
    return
  }
  const startTime = Date.now()
  let passedSteps = 0
  let failedSteps = 0

  const __builtins: Record<string, string> = { __timestamp: String(Date.now()), __rand: Math.random().toString(36).slice(2, 8) }
  const variables = { ...__builtins, ...testCase.variables, ...profile.variables, ...(rowVars ?? {}) }
  const locatorIndex = buildLocatorIndex(objectRepositories, platform)

  function interpolate(value: string): string {
    return value
      .replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
      .replace(/\$\{(\w+)\}/g, (_, key) => variables[key] ?? `\${${key}}`)
  }

  async function resolveLocator(ref: string): Promise<string> {
    if (!ref) return ''
    const interpolated = interpolate(ref)
    const key = interpolated.toLowerCase()
    const resolved = locatorIndex.get(key)
    if (resolved) return resolved
    return interpolated
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = getAdapter(adapterKey as any)
  const session = externalSession ?? await adapter.start(profile, { headless, appPath })
  let finalScreenshotPath: string | undefined

  try {
    for (let i = 0; i < testCase.steps.length; i++) {
      if (signal?.aborted) break

      const step = testCase.steps[i]
      if (!step.enabled) {
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'skipped', rowIndex, totalRows })
        continue
      }

      onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'running', rowIndex, totalRows })

      const stepStart = Date.now()
      const timeout = step.timeout ?? 30000
      try {
        const setVariable = (key: string, value: string) => { variables[key] = value }
        const work = step.keyword === 'call-test-case'
          ? executeCalledTestCase(step.input, loadTestCase, adapter, session, { resolveLocator, interpolate }, signal)
          : adapter.execute(session, step, { resolveLocator, interpolate, setVariable, persistVariable, persistApiConfig })
        await Promise.race([
          work,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout after ${timeout}ms`)), timeout),
          ),
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stepMeta = (session as any)?.lastResponse ?? undefined
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'passed', durationMs: Date.now() - stepStart, meta: stepMeta, rowIndex, totalRows })
        passedSteps++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stepMeta = (session as any)?.lastResponse ?? undefined
        let screenshotPath: string | undefined
        if (screenshotDir && adapter.screenshot) {
          try {
            await fs.mkdir(screenshotDir, { recursive: true })
            screenshotPath = path.join(screenshotDir, `${runId}-step${i}.png`)
            await adapter.screenshot(session, { path: screenshotPath })
          } catch {
            screenshotPath = undefined
          }
        }
        onStep({ runId, testCaseId: testCase.id, stepIndex: i, status: 'failed', message, durationMs: Date.now() - stepStart, screenshotPath, meta: stepMeta, rowIndex, totalRows })
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
    if (screenshotDir && screenshotMode === 'final' && adapter.screenshot) {
      try {
        await fs.mkdir(screenshotDir, { recursive: true })
        finalScreenshotPath = path.join(screenshotDir, `${runId}-final.png`)
        await adapter.screenshot(session, { path: finalScreenshotPath })
      } catch {
        finalScreenshotPath = undefined
      }
    }
    if (!externalSession) {
      try { await adapter.stop(session) } catch { /* ignore */ }
    }
  }

  const finalStatus = signal?.aborted ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed'
  onComplete({ runId, status: finalStatus, totalSteps: testCase.steps.length, passedSteps, failedSteps, durationMs: Date.now() - startTime, finalScreenshotPath })
}
