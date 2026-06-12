import type { IpcMain, WebContents } from 'electron'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { IpcChannels } from '@jkauto/core'
import type { TestCase, TestSuite, Profile, RunCompleteEvent } from '@jkauto/core'
import { runTestCase, getKeywordMeta } from '@jkauto/engine'
import { getSettings } from '../services/settings.service'

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
}

function normalizeTestCase(tcData: Partial<TestCase>): TestCase {
  return {
    schemaVersion: 1,
    id: tcData.id ?? randomUUID(),
    name: tcData.name ?? 'Unnamed',
    description: tcData.description ?? '',
    platform: tcData.platform, // undefined → runner falls back to 'web'
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
  return normalizeTestCase(JSON.parse(raw) as Partial<TestCase>)
}

export function registerEngineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENGINE_RUN_CASE, async (event, payload: RunPayload) => {
    const { filePath, debugMode = false, profileVariables = {} } = payload
    const settings = await getSettings()

    const testCase = await readTestCase(filePath)

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
            waitForNext: (stepIndex: number) =>
              new Promise<void>((resolve) => {
                debugNextResolvers.set(runId, resolve)
                // notify renderer that engine is paused at this step
                if (!webContents.isDestroyed()) {
                  webContents.send(IpcChannels.ENGINE_DEBUG_NEXT, { runId, stepIndex, paused: true })
                }
              }),
          }
        : { headless: settings.execution.headless },
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
    const { filePath, profileVariables = {} } = payload
    const settings = await getSettings()

    const raw = await fs.readFile(filePath, 'utf-8')
    const suite = normalizeSuite(JSON.parse(raw))
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

    ;(async () => {
      const startedAt = Date.now()
      let totalSteps = 0
      let passedSteps = 0
      let failedSteps = 0
      let stopped = false

      const testCases: TestCase[] = []
      for (const item of enabledItems) {
        try {
          const testCase = await readTestCase(item.testCasePath)
          testCases.push(testCase)
          totalSteps += testCase.steps.length
        } catch {
          failedSteps++
          totalSteps++
          if (!webContents.isDestroyed()) {
            webContents.send(IpcChannels.ENGINE_STEP_EVENT, {
              runId,
              testCaseId: item.testCaseId,
              stepIndex: 0,
              status: 'failed',
              message: `Cannot read test case: ${item.testCasePath}`,
            })
          }
          break
        }
      }

      for (const testCase of testCases) {
        if (abort.signal.aborted) {
          stopped = true
          break
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
            { headless: settings.execution.headless },
          ).catch(reject)
        })

        passedSteps += caseResult.passedSteps
        failedSteps += caseResult.failedSteps
        if (caseResult.status === 'stopped') {
          stopped = true
          break
        }
        if (caseResult.status === 'failed') break
      }

      if (abort.signal.aborted) stopped = true

      if (!webContents.isDestroyed()) {
        webContents.send(IpcChannels.ENGINE_RUN_COMPLETE, {
          runId,
          status: stopped ? 'stopped' : failedSteps > 0 ? 'failed' : 'passed',
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
