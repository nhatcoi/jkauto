import type { IpcMain, WebContents } from 'electron'
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { IpcChannels } from '@jkauto/core'
import type { TestCase, TestSuite, Profile, RunCompleteEvent, SuiteEvent, ObjectRepository, Step, AppSettings } from '@jkauto/core'
import { runTestCase, getKeywordMeta, getAdapter } from '@jkauto/engine'
import { getSettings } from '../services/settings.service'
import { ensureAppiumRunning } from './appium.handler'
import { loadDataFileRows } from './data-file.handler'
import { parse as yamlParse } from 'yaml'

interface ActiveRun {
  abort: AbortController
  webContents: WebContents
}

const activeRuns = new Map<string, ActiveRun>()
// debug-mode: per-run pending "next step" resolver
const debugNextResolvers = new Map<string, () => void>()

interface RunPayload {
  filePath: string
  debugMode?: boolean
  profileVariables?: Record<string, string>
  profileApi?: import('@jkauto/core').ApiProfileConfig
  profilePath?: string
  projectPath?: string
  appPath?: string
}

async function loadObjectRepositories(projectPath: string): Promise<ObjectRepository[]> {
  const repos: ObjectRepository[] = []
  for (const dir of ['object-repository', 'api-request']) {
    const repoDir = path.join(projectPath, dir)
    try {
      const entries = await fs.readdir(repoDir)
      for (const entry of entries) {
        if (!entry.endsWith('.objects.json')) continue
        try {
          const raw = await fs.readFile(path.join(repoDir, entry), 'utf-8')
          repos.push(JSON.parse(raw) as ObjectRepository)
        } catch { /* skip malformed file */ }
      }
    } catch { /* dir missing */ }
  }
  return repos
}

function normalizeTestCase(tcData: Partial<TestCase>): TestCase {
  const platform = tcData.platform
  const runner = tcData.runner ?? (
    platform === 'mobile' ? 'maestro'
    : platform === 'api' ? 'api'
    : platform === 'appium' ? 'appium'
    : 'playwright'
  )
  return {
    schemaVersion: 1,
    id: tcData.id ?? randomUUID(),
    name: tcData.name ?? 'Unnamed',
    description: tcData.description ?? '',
    owner: tcData.owner ?? '',
    tags: tcData.tags ?? [],
    platform,
    runner,
    app: {
      id: tcData.app?.id ?? '',
      env: tcData.app?.env ?? '',
      path: tcData.app?.path ?? '',
    },
    config: {
      timeoutMs: tcData.config?.timeoutMs ?? null,
      retry: tcData.config?.retry ?? 0,
      stepDelayMs: tcData.config?.stepDelayMs ?? tcData.stepDelayMs ?? null,
    },
    variables: tcData.variables ?? {},
    stepDelayMs: tcData.stepDelayMs ?? null,
    steps: (tcData.steps ?? []).map(normalizeStep),
    createdAt: tcData.createdAt ?? new Date().toISOString(),
    updatedAt: tcData.updatedAt ?? new Date().toISOString(),
  }
}

function normalizeStep(step: Partial<Step>): Step {
  return {
    id: step.id ?? randomUUID(),
    name: step.name ?? '',
    keyword: step.keyword ?? '',
    description: step.description ?? '',
    objectRef: step.objectRef ?? '',
    input: step.input ?? '',
    expected: step.expected ?? '',
    enabled: step.enabled ?? true,
    continueOnFailure: step.continueOnFailure ?? false,
    timeout: step.timeout ?? null,
  }
}

function normalizeSuite(suiteData: Partial<TestSuite> & { testCaseIds?: string[] }): TestSuite {
  const now = new Date().toISOString()
  const legacyItems =
    suiteData.testCaseIds?.map((testCaseId, order) => ({
      testCaseId,
      testCasePath: testCaseId,
      enabled: true,
      order,
    })) ?? []

  return {
    schemaVersion: 1,
    id: suiteData.id ?? randomUUID(),
    name: suiteData.name ?? 'Unnamed Suite',
    description: suiteData.description ?? '',
    profile: suiteData.profile ?? 'default',
    continueOnFailure: suiteData.continueOnFailure ?? false,
    sharedBrowser: suiteData.sharedBrowser ?? false,
    items: (suiteData.items ?? legacyItems).map((item, order) => ({
      testCaseId: item.testCaseId,
      testCasePath: item.testCasePath,
      enabled: item.enabled ?? true,
      order: item.order ?? order,
    })),
    createdAt: suiteData.createdAt ?? now,
    updatedAt: suiteData.updatedAt ?? now,
  }
}

async function readTestCase(filePath: string): Promise<TestCase> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return normalizeTestCase(yamlParse(raw) as Partial<TestCase>)
}

async function findTestCaseById(projectPath: string, id: string): Promise<{ filePath: string; testCase: TestCase } | null> {
  async function scan(dir: string): Promise<{ filePath: string; testCase: TestCase } | null> {
    let entries: Dirent[]
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return null }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = await scan(full)
        if (found) return found
      } else if (entry.name.endsWith('.test.yaml') || entry.name.endsWith('.test.yml')) {
        try {
          const tc = await readTestCase(full)
          if (tc.id === id) return { filePath: full, testCase: tc }
        } catch { /* skip unreadable */ }
      }
    }
    return null
  }
  return scan(projectPath)
}

function sendSuiteEvent(webContents: WebContents, event: SuiteEvent): void {
  if (!webContents.isDestroyed()) {
    webContents.send(IpcChannels.ENGINE_SUITE_EVENT, event)
  }
}

/**
 * GUI-launched Electron does not inherit the shell's PLAYWRIGHT_BROWSERS_PATH,
 * so chromium.launch() fails to find browsers installed in a custom dir.
 * When execution.browsersPath is configured, push it into process.env before a run.
 * Playwright reads this env at launch time, so changes apply without restart.
 */
function applyBrowsersPath(settings: AppSettings): void {
  const dir = settings.execution.browsersPath?.trim()
  if (dir) process.env['PLAYWRIGHT_BROWSERS_PATH'] = dir
}

export function registerEngineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENGINE_RUN_CASE, async (event, payload: RunPayload) => {
    const { filePath, debugMode = false, profileVariables = {}, profileApi, profilePath, projectPath, appPath } = payload
    const settings = await getSettings()
    applyBrowsersPath(settings)

    const testCase = await readTestCase(filePath)
    const objectRepositories = projectPath ? await loadObjectRepositories(projectPath) : []

    const resolvedVars = { ...profileVariables }
    const platform = testCase.platform ?? 'web'
    const runner = testCase.runner ?? (platform === 'mobile' ? 'maestro' : platform === 'api' ? 'api' : 'playwright')
    if (platform === 'appium' || runner === 'appium') {
      if (!resolvedVars['APPIUM_HOST']) resolvedVars['APPIUM_HOST'] = settings.appium.host
      if (!resolvedVars['APPIUM_PORT']) resolvedVars['APPIUM_PORT'] = String(settings.appium.port)
      if (settings.appium.autoStart) await ensureAppiumRunning(event.sender)
    }

    const profile: Profile = {
      schemaVersion: 1,
      name: 'default',
      variables: resolvedVars,
      api: profileApi,
    }

    const runId = randomUUID()
    const abort = new AbortController()
    const webContents: WebContents = event.sender
    activeRuns.set(runId, { abort, webContents })

    // Fire async — return runId immediately so renderer can subscribe
    const loadTestCase = readTestCase

    const stepDelay = testCase.config?.stepDelayMs ?? testCase.stepDelayMs ?? settings.execution.stepDelayMs

    const persistVariable = profilePath
      ? async (profileKey: string, value: string) => {
          const raw = await fs.readFile(profilePath, 'utf-8')
          const parsed = JSON.parse(raw) as Record<string, unknown>
          const updated = { ...parsed, variables: { ...(parsed['variables'] as Record<string, string> ?? {}), [profileKey]: value } }
          await fs.writeFile(profilePath, JSON.stringify(updated, null, 2), 'utf-8')
        }
      : undefined

    const persistApiConfig = profilePath
      ? async (key: string, value: string) => {
          const raw = await fs.readFile(profilePath, 'utf-8')
          const parsed = JSON.parse(raw) as Record<string, unknown>
          const api = (parsed['api'] ?? {}) as Record<string, unknown>
          if (key === 'baseUrl') {
            parsed['api'] = { ...api, baseUrl: value }
          } else if (key === 'auth.bearer.token') {
            parsed['api'] = { ...api, auth: { type: 'bearer', token: value } }
          } else if (key === 'auth.basic.username') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'basic' }), type: 'basic', username: value } }
          } else if (key === 'auth.basic.password') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'basic' }), type: 'basic', password: value } }
          } else if (key === 'auth.api-key.key') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'api-key' }), type: 'api-key', key: value } }
          } else {
            const headers = (api['defaultHeaders'] ?? {}) as Record<string, string>
            parsed['api'] = { ...api, defaultHeaders: { ...headers, [key]: value } }
          }
          await fs.writeFile(profilePath, JSON.stringify(parsed, null, 2), 'utf-8')
        }
      : undefined

    // Load data file rows if test case has a dataFile binding
    let dataRows: Record<string, string>[] = []
    if (testCase.dataFile && projectPath) {
      const dataFilePath = path.isAbsolute(testCase.dataFile)
        ? testCase.dataFile
        : path.join(projectPath, testCase.dataFile)
      dataRows = await loadDataFileRows(dataFilePath)
    }
    const totalRows = dataRows.length > 0 ? dataRows.length : undefined

    const baseOptions = debugMode
      ? {
          headless: settings.execution.headless,
          objectRepositories,
          appPath: appPath ?? testCase.app?.path,
          loadTestCase,
          persistVariable,
          persistApiConfig,
          waitForNext: (stepIndex: number) =>
            new Promise<void>((resolve) => {
              debugNextResolvers.set(runId, resolve)
              if (!webContents.isDestroyed()) {
                webContents.send(IpcChannels.ENGINE_DEBUG_NEXT, { runId, stepIndex, paused: true })
              }
            }),
        }
      : {
          headless: settings.execution.headless,
          objectRepositories,
          appPath: appPath ?? testCase.app?.path,
          loadTestCase,
          stepDelay,
          persistVariable,
          persistApiConfig,
          screenshotDir: projectPath ? path.join(projectPath, '.autotest', 'screenshots') : undefined,
        }

    const onStep = (stepEvent: import('@jkauto/core').StepEvent) => {
      if (!webContents.isDestroyed()) webContents.send(IpcChannels.ENGINE_STEP_EVENT, stepEvent)
    }

    void (async () => {
      try {
        if (dataRows.length === 0) {
          // No data file — single run
          await new Promise<void>((resolve, reject) => {
            runTestCase(testCase, profile, runId, onStep, (completeEvent) => {
              if (!webContents.isDestroyed()) webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, completeEvent)
              activeRuns.delete(runId)
              resolve()
            }, abort.signal, baseOptions).catch(reject)
          })
        } else {
          // Data-driven: run once per row
          let totalPassed = 0
          let totalFailed = 0
          const startTime = Date.now()
          for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
            if (abort.signal.aborted) break
            const rowVars = dataRows[rowIndex]!
            if (!webContents.isDestroyed()) {
              webContents.send(IpcChannels.ENGINE_ROW_EVENT, {
                runId, rowIndex, totalRows, type: 'row-start',
              })
            }
            const result = await new Promise<import('@jkauto/core').RunCompleteEvent>((resolve, reject) => {
              runTestCase(testCase, profile, runId, onStep, resolve, abort.signal, {
                ...baseOptions, rowVars, rowIndex, totalRows,
              }).catch(reject)
            })
            totalPassed += result.passedSteps
            totalFailed += result.failedSteps
            if (!webContents.isDestroyed()) {
              webContents.send(IpcChannels.ENGINE_ROW_EVENT, {
                runId, rowIndex, totalRows, type: 'row-complete',
                status: result.status, passedSteps: result.passedSteps, failedSteps: result.failedSteps,
                durationMs: result.durationMs,
              })
            }
            if (result.status === 'stopped') break
          }
          const finalStatus = abort.signal.aborted ? 'stopped' : totalFailed > 0 ? 'failed' : 'passed'
          if (!webContents.isDestroyed()) {
            webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
              runId, status: finalStatus,
              totalSteps: testCase.steps.length * dataRows.length,
              passedSteps: totalPassed, failedSteps: totalFailed,
              durationMs: Date.now() - startTime,
            })
          }
          activeRuns.delete(runId)
        }
      } catch (err) {
        activeRuns.delete(runId)
        if (!webContents.isDestroyed()) {
          webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
            runId, status: 'failed',
            totalSteps: testCase.steps.length,
            passedSteps: 0, failedSteps: 1, durationMs: 0,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })()

    return { runId }
  })

  ipcMain.handle(IpcChannels.ENGINE_RUN_SUITE, async (event, payload: RunPayload) => {
    const { filePath, profileVariables = {}, profileApi, profilePath, projectPath } = payload
    const settings = await getSettings()
    applyBrowsersPath(settings)

    const raw = await fs.readFile(filePath, 'utf-8')
    const suite = normalizeSuite(yamlParse(raw))
    const objectRepositories = projectPath ? await loadObjectRepositories(projectPath) : []
    const enabledItems = suite.items
      .filter((item) => item.enabled)
      .sort((a, b) => a.order - b.order)

    const profile: Profile = {
      schemaVersion: 1,
      name: suite.profile || 'default',
      variables: profileVariables,
      api: profileApi,
    }

    const persistVariable = profilePath
      ? async (key: string, value: string) => {
          const raw = await fs.readFile(profilePath, 'utf-8')
          const parsed = JSON.parse(raw) as Record<string, unknown>
          const updated = { ...parsed, variables: { ...(parsed['variables'] as Record<string, string> ?? {}), [key]: value } }
          await fs.writeFile(profilePath, JSON.stringify(updated, null, 2), 'utf-8')
        }
      : undefined

    const persistApiConfig = profilePath
      ? async (key: string, value: string) => {
          const raw = await fs.readFile(profilePath, 'utf-8')
          const parsed = JSON.parse(raw) as Record<string, unknown>
          const api = (parsed['api'] ?? {}) as Record<string, unknown>
          if (key === 'baseUrl') {
            parsed['api'] = { ...api, baseUrl: value }
          } else if (key === 'auth.bearer.token') {
            parsed['api'] = { ...api, auth: { type: 'bearer', token: value } }
          } else if (key === 'auth.basic.username') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'basic' }), type: 'basic', username: value } }
          } else if (key === 'auth.basic.password') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'basic' }), type: 'basic', password: value } }
          } else if (key === 'auth.api-key.key') {
            parsed['api'] = { ...api, auth: { ...(api['auth'] as Record<string, unknown> ?? { type: 'api-key' }), type: 'api-key', key: value } }
          } else {
            const headers = (api['defaultHeaders'] ?? {}) as Record<string, string>
            parsed['api'] = { ...api, defaultHeaders: { ...headers, [key]: value } }
          }
          await fs.writeFile(profilePath, JSON.stringify(parsed, null, 2), 'utf-8')
        }
      : undefined

    const runId = randomUUID()
    const abort = new AbortController()
    const webContents: WebContents = event.sender
    activeRuns.set(runId, { abort, webContents })

    setTimeout(() => {
      void (async () => {
      const startedAt = Date.now()
      let totalSteps = 0
      let passedSteps = 0
      let failedSteps = 0
      let stopped = false
      let passedCases = 0
      let failedCases = 0
      let skippedCases = 0

      sendSuiteEvent(webContents, {
        runId,
        suiteId: suite.id,
        suiteName: suite.name,
        type: 'suite-start',
        totalCases: enabledItems.length,
      })

      // Shared browser: reuse one web session across web cases so login/cookie
      // state persists. Created lazily on the first web case (suites with no web
      // cases never open a browser). Non-web cases always get their own session.
      const webAdapter = getAdapter('web')
      let sharedSession: unknown | undefined

      try {
      for (let index = 0; index < enabledItems.length; index++) {
        const item = enabledItems[index]
        if (abort.signal.aborted) {
          stopped = true
          break
        }

        let testCase: TestCase
        const caseStartedAt = Date.now()
        try {
          const resolvedPath = path.isAbsolute(item.testCasePath)
            ? item.testCasePath
            : projectPath ? path.join(projectPath, item.testCasePath) : item.testCasePath
          try {
            testCase = await readTestCase(resolvedPath)
          } catch {
            // path stale (moved/renamed) — fallback scan by ID
            if (projectPath && item.testCaseId) {
              const found = await findTestCaseById(projectPath, item.testCaseId)
              if (found) {
                testCase = found.testCase
                // auto-heal: update path hint in suite file
                const relFound = found.filePath.startsWith(projectPath + '/')
                  ? found.filePath.slice(projectPath.length + 1)
                  : found.filePath
                item.testCasePath = relFound
                const healedSuite = { ...suite, items: suite.items.map(i => i === item ? { ...i, testCasePath: relFound } : i) }
                await fs.writeFile(filePath, (await import('yaml')).stringify(healedSuite), 'utf-8')
              } else {
                throw new Error(`Cannot find test case by id: ${item.testCaseId}`)
              }
            } else {
              throw new Error(`Cannot read test case: ${resolvedPath}`)
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : `Cannot read test case: ${item.testCasePath}`
          failedSteps++
          failedCases++
          totalSteps++
          sendSuiteEvent(webContents, {
            runId,
            suiteId: suite.id,
            suiteName: suite.name,
            type: 'case-complete',
            caseIndex: index,
            totalCases: enabledItems.length,
            testCaseId: item.testCaseId,
            testCasePath: item.testCasePath,
            testCaseName: item.testCasePath,
            status: 'failed',
            message,
            durationMs: Date.now() - caseStartedAt,
          })
          if (!webContents.isDestroyed()) {
            webContents.send(IpcChannels.ENGINE_STEP_EVENT, {
              runId,
              testCaseId: item.testCaseId,
              stepIndex: 0,
              status: 'failed',
              message,
            })
          }
          if (!suite.continueOnFailure) break
          continue
        }

        totalSteps += testCase.steps.length
        sendSuiteEvent(webContents, {
          runId,
          suiteId: suite.id,
          suiteName: suite.name,
          type: 'case-start',
          caseIndex: index,
          totalCases: enabledItems.length,
          testCaseId: testCase.id,
          testCasePath: item.testCasePath,
          testCaseName: testCase.name,
          status: 'running',
        })

        // Only web cases share the session; others run isolated.
        const casePlatform = testCase.platform ?? 'web'
        let externalSession: unknown | undefined
        if (suite.sharedBrowser && casePlatform === 'web') {
          if (!sharedSession) {
            sharedSession = await webAdapter.start(profile, { headless: settings.execution.headless })
          }
          externalSession = sharedSession
        }

        const caseResult = await new Promise<RunCompleteEvent>((resolve, reject) => {
          runTestCase(
            testCase,
            profile,
            runId,
            (stepEvent) => {
              if (!webContents.isDestroyed()) {
                webContents.send(IpcChannels.ENGINE_STEP_EVENT, stepEvent)
              }
            },
            resolve,
            abort.signal,
            {
              headless: settings.execution.headless,
              objectRepositories,
              externalSession,
              loadTestCase: readTestCase,
              stepDelay: testCase.stepDelayMs ?? settings.execution.stepDelayMs,
              persistVariable,
              persistApiConfig,
            },
          ).catch(reject)
        })

        // Reload profile from disk so variables/tokens persisted by this TC
        // are available to subsequent TCs in the suite.
        if (profilePath) {
          try {
            const refreshed = JSON.parse(await fs.readFile(profilePath, 'utf-8')) as Record<string, unknown>
            profile.variables = (refreshed['variables'] as Record<string, string>) ?? {}
            profile.api = refreshed['api'] as Profile['api']
          } catch { /* ignore — profile reload is best-effort */ }
        }

        passedSteps += caseResult.passedSteps
        failedSteps += caseResult.failedSteps
        if (caseResult.status === 'passed') passedCases++
        if (caseResult.status === 'failed') failedCases++
        if (caseResult.status === 'stopped') skippedCases += enabledItems.length - index - 1

        sendSuiteEvent(webContents, {
          runId,
          suiteId: suite.id,
          suiteName: suite.name,
          type: 'case-complete',
          caseIndex: index,
          totalCases: enabledItems.length,
          testCaseId: testCase.id,
          testCasePath: item.testCasePath,
          testCaseName: testCase.name,
          status: caseResult.status,
          durationMs: caseResult.durationMs,
        })

        if (caseResult.status === 'stopped') {
          stopped = true
          break
        }
        if (caseResult.status === 'failed' && !suite.continueOnFailure) break
      }
      } finally {
        if (sharedSession) {
          await webAdapter.stop(sharedSession)
        }
      }

      if (abort.signal.aborted) stopped = true
      const suiteStatus = stopped ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed'

      sendSuiteEvent(webContents, {
        runId,
        suiteId: suite.id,
        suiteName: suite.name,
        type: 'suite-complete',
        totalCases: enabledItems.length,
        status: suiteStatus,
        message: `${passedCases} passed, ${failedCases} failed, ${skippedCases} skipped`,
        durationMs: Date.now() - startedAt,
      })

      if (!webContents.isDestroyed()) {
        webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
          runId,
          status: suiteStatus,
          totalSteps,
          passedSteps,
          failedSteps,
          durationMs: Date.now() - startedAt,
        })
      }
      activeRuns.delete(runId)
      })().catch((err) => {
        activeRuns.delete(runId)
        if (!webContents.isDestroyed()) {
          webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
            runId,
            status: 'failed',
            totalSteps: enabledItems.length,
            passedSteps: 0,
            failedSteps: 1,
            durationMs: 0,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      })
    }, 0)

    return { runId }
  })

  ipcMain.handle(IpcChannels.ENGINE_STOP, (_, runId: string) => {
    const run = activeRuns.get(runId)
    if (run) {
      run.abort.abort()
      activeRuns.delete(runId)
    }
    // unblock any pending debug pause so the runner can exit cleanly
    const resolve = debugNextResolvers.get(runId)
    if (resolve) {
      debugNextResolvers.delete(runId)
      resolve()
    }
  })

  ipcMain.handle(IpcChannels.ENGINE_DEBUG_NEXT, (_, runId: string) => {
    const resolve = debugNextResolvers.get(runId)
    if (resolve) {
      debugNextResolvers.delete(runId)
      resolve()
    }
  })

  ipcMain.handle(IpcChannels.ENGINE_GET_KEYWORDS, () => getKeywordMeta())
}
