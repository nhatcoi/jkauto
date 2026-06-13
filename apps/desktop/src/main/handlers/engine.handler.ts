import type { IpcMain, WebContents } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { IpcChannels } from '@jkauto/core'
import type { TestCase, TestSuite, Profile, RunCompleteEvent, SuiteEvent, ObjectRepository } from '@jkauto/core'
import { runTestCase, getKeywordMeta, getAdapter } from '@jkauto/engine'
import { getSettings } from '../services/settings.service'
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
  projectPath?: string
  device?: string
  appPath?: string
}

async function loadObjectRepositories(projectPath: string): Promise<ObjectRepository[]> {
  const repoDir = path.join(projectPath, 'object-repository')
  const repos: ObjectRepository[] = []
  try {
    const entries = await fs.readdir(repoDir)
    for (const entry of entries) {
      if (!entry.endsWith('.objects.json')) continue
      try {
        const raw = await fs.readFile(path.join(repoDir, entry), 'utf-8')
        repos.push(JSON.parse(raw) as ObjectRepository)
      } catch { /* skip malformed file */ }
    }
  } catch { /* object-repository dir missing */ }
  return repos
}

function normalizeTestCase(tcData: Partial<TestCase>): TestCase {
  return {
    schemaVersion: 1,
    id: tcData.id ?? randomUUID(),
    name: tcData.name ?? 'Unnamed',
    description: tcData.description ?? '',
    platform: tcData.platform, // undefined → runner falls back to 'web'
    stepDelayMs: tcData.stepDelayMs ?? null,
    tags: tcData.tags ?? [],
    steps: tcData.steps ?? [],
    createdAt: tcData.createdAt ?? new Date().toISOString(),
    updatedAt: tcData.updatedAt ?? new Date().toISOString(),
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
  const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml')
  return normalizeTestCase((isYaml ? yamlParse(raw) : JSON.parse(raw)) as Partial<TestCase>)
}

function sendSuiteEvent(webContents: WebContents, event: SuiteEvent): void {
  if (!webContents.isDestroyed()) {
    webContents.send(IpcChannels.ENGINE_SUITE_EVENT, event)
  }
}

export function registerEngineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENGINE_RUN_CASE, async (event, payload: RunPayload) => {
    const { filePath, debugMode = false, profileVariables = {}, projectPath, device, appPath } = payload
    const settings = await getSettings()

    const testCase = await readTestCase(filePath)
    const objectRepositories = projectPath ? await loadObjectRepositories(projectPath) : []

    const profile: Profile = {
      schemaVersion: 1,
      name: 'default',
      variables: profileVariables,
    }

    const runId = randomUUID()
    const abort = new AbortController()
    const webContents: WebContents = event.sender
    activeRuns.set(runId, { abort, webContents })

    // Fire async — return runId immediately so renderer can subscribe
    const loadTestCase = readTestCase

    const stepDelay = testCase.stepDelayMs ?? settings.execution.stepDelayMs

    runTestCase(
      testCase,
      profile,
      runId,
      (stepEvent) => {
        if (!webContents.isDestroyed()) {
          webContents.send(IpcChannels.ENGINE_STEP_EVENT, stepEvent)
        }
      },
      (completeEvent) => {
        if (!webContents.isDestroyed()) {
          webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, completeEvent)
        }
        activeRuns.delete(runId)
      },
      abort.signal,
      debugMode
        ? {
            headless: settings.execution.headless,
            objectRepositories,
            device,
            appPath,
            loadTestCase,
            waitForNext: (stepIndex: number) =>
              new Promise<void>((resolve) => {
                debugNextResolvers.set(runId, resolve)
                if (!webContents.isDestroyed()) {
                  webContents.send(IpcChannels.ENGINE_DEBUG_NEXT, { runId, stepIndex, paused: true })
                }
              }),
          }
        : { headless: settings.execution.headless, objectRepositories, device, appPath, loadTestCase, stepDelay },
    ).catch((err) => {
      activeRuns.delete(runId)
      if (!webContents.isDestroyed()) {
        webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
          runId,
          status: 'failed',
          totalSteps: testCase.steps.length,
          passedSteps: 0,
          failedSteps: 1,
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })

    return { runId }
  })

  ipcMain.handle(IpcChannels.ENGINE_RUN_SUITE, async (event, payload: RunPayload) => {
    const { filePath, profileVariables = {}, projectPath } = payload
    const settings = await getSettings()

    const raw = await fs.readFile(filePath, 'utf-8')
    const suite = normalizeSuite(JSON.parse(raw))
    const objectRepositories = projectPath ? await loadObjectRepositories(projectPath) : []
    const enabledItems = suite.items
      .filter((item) => item.enabled)
      .sort((a, b) => a.order - b.order)

    const profile: Profile = {
      schemaVersion: 1,
      name: suite.profile || 'default',
      variables: profileVariables,
    }

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
          testCase = await readTestCase(item.testCasePath)
        } catch {
          const message = `Cannot read test case: ${item.testCasePath}`
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
            },
          ).catch(reject)
        })

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
