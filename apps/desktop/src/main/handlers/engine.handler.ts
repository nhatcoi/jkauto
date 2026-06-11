import type { IpcMain, WebContents } from 'electron'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { IpcChannels } from '@jkauto/core'
import type { TestCase, Profile } from '@jkauto/core'
import { runTestCase } from '@jkauto/engine'

interface ActiveRun {
  abort: AbortController
  webContents: WebContents
}

const activeRuns = new Map<string, ActiveRun>()

interface RunPayload {
  filePath: string
  debugMode?: boolean
  profileVariables?: Record<string, string>
}

export function registerEngineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENGINE_RUN_CASE, async (event, payload: RunPayload) => {
    const { filePath, debugMode = false, profileVariables = {} } = payload

    const raw = await fs.readFile(filePath, 'utf-8')
    const tcData = JSON.parse(raw) as Partial<TestCase>

    // Normalise — files created in-app may lack createdAt/updatedAt
    const testCase: TestCase = {
      schemaVersion: 1,
      id: tcData.id ?? randomUUID(),
      name: tcData.name ?? 'Unnamed',
      description: tcData.description ?? '',
      tags: tcData.tags ?? [],
      steps: tcData.steps ?? [],
      createdAt: tcData.createdAt ?? new Date().toISOString(),
      updatedAt: tcData.updatedAt ?? new Date().toISOString(),
    }

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
      { headless: false, stepDelay: debugMode ? 1000 : 0 },
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

  ipcMain.handle(IpcChannels.ENGINE_STOP, (_, runId: string) => {
    const run = activeRuns.get(runId)
    if (run) {
      run.abort.abort()
      activeRuns.delete(runId)
    }
  })
}
