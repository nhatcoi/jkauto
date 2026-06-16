import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { RunCompleteEvent, RunRecord, StepResult, StepEvent, SuiteEvent, TestSuite } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { readEnv } from '@/features/env/api'

export type CaseStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

export interface RunSummary {
  status: 'passed' | 'failed' | 'stopped'
  durationMs: number
  passedCases: number
  failedCases: number
  totalCases: number
}

export function useSuiteRun(
  filePath: string,
  suiteRef: RefObject<TestSuite | null>,
  saveSuiteToFile: (suite: TestSuite) => Promise<TestSuite>,
) {
  const { activeProject } = useProjectStore()
  const {
    startRun, handleStepEvent, handleSuiteEvent, handleRunComplete,
    stopRun, appendRunRecord, runId, status: runStatus,
  } = useRunStore()

  const [caseStatuses, setCaseStatuses] = useState<Record<string, CaseStatus>>({})
  const [caseMessages, setCaseMessages] = useState<Record<string, string>>({})
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)

  // tracks whether current run is a suite run (true) or single-case run (string = path)
  const runModeRef = useRef<'suite' | string | null>(null)

  useEffect(() => {
    const offSuite = window.api.on(IpcChannels.ENGINE_SUITE_EVENT, (payload: unknown) => {
      const event = payload as SuiteEvent
      handleSuiteEvent(event)

      if (event.type === 'case-start' && event.testCasePath) {
        setCaseStatuses((prev) => ({ ...prev, [event.testCasePath!]: 'running' }))
      }
      if (event.type === 'case-complete' && event.testCasePath) {
        const status: CaseStatus = event.status === 'stopped' ? 'skipped' : (event.status as CaseStatus) ?? 'idle'
        setCaseStatuses((prev) => ({ ...prev, [event.testCasePath!]: status }))
        if (event.message) {
          setCaseMessages((prev) => ({ ...prev, [event.testCasePath!]: event.message ?? '' }))
        }
      }
    })

    const offStep = window.api.on(IpcChannels.ENGINE_STEP_EVENT, (payload: unknown) => {
      const event = payload as StepEvent
      handleStepEvent(event)
      const item = suiteRef.current?.items.find((c) => c.testCaseId === event.testCaseId)
      if (!item) return
      setCaseStatuses((prev) => ({
        ...prev,
        [item.testCasePath]: event.status === 'failed' ? 'failed' : 'running',
      }))
      if (event.message) {
        setCaseMessages((prev) => ({ ...prev, [item.testCasePath]: event.message ?? '' }))
      }
    })

    const offComplete = window.api.on(IpcChannels.ENGINE_RUN_COMPLETE, (payload: unknown) => {
      const event = payload as RunCompleteEvent
      handleRunComplete(event)

      const { stepStatuses, stepMessages, stepDurations } = useRunStore.getState()
      const stepResults: StepResult[] = Object.entries(stepStatuses)
        .map(([idx, status]) => {
          const i = Number(idx)
          const s = status === 'idle' || status === 'running' ? 'skipped' : status
          return { stepIndex: i, status: s as StepResult['status'], message: stepMessages[i], durationMs: stepDurations[i] }
        })
        .sort((a, b) => a.stepIndex - b.stepIndex)

      const record: RunRecord = {
        runId: event.runId,
        filePath,
        status: event.status,
        totalSteps: event.totalSteps,
        passedSteps: event.passedSteps,
        failedSteps: event.failedSteps,
        durationMs: event.durationMs,
        startedAt: new Date(Date.now() - event.durationMs).toISOString(),
        endedAt: new Date().toISOString(),
        stepResults,
      }
      appendRunRecord(record)
      invoke(IpcChannels.ENGINE_SAVE_RUN, filePath, record).catch(console.error)

      if (runModeRef.current === 'suite') {
        setCaseStatuses((prev) => {
          const passedCases = Object.values(prev).filter((s) => s === 'passed').length
          const failedCases = Object.values(prev).filter((s) => s === 'failed').length
          const totalCases = Object.values(prev).filter((s) => s !== 'idle').length
          setRunSummary({ status: event.status, durationMs: event.durationMs, passedCases, failedCases, totalCases })
          return prev
        })
      } else if (typeof runModeRef.current === 'string') {
        const casePath = runModeRef.current
        setCaseStatuses((prev) => ({
          ...prev,
          [casePath]: event.status === 'stopped' ? 'skipped' : event.status,
        }))
      }
      runModeRef.current = null
    })

    return () => {
      offSuite()
      offStep()
      offComplete()
    }
  }, [filePath, handleSuiteEvent, handleStepEvent, handleRunComplete, appendRunRecord, suiteRef])

  const loadProfileVars = async (profileName: string): Promise<Record<string, string>> => {
    if (!activeProject) return {}
    try {
      return await readEnv(`${activeProject.path}/profiles/${profileName}.env.json`)
    } catch {
      return {}
    }
  }

  const runSuite = useCallback(async () => {
    if (runStatus === 'running') return
    const current = suiteRef.current
    if (!current) return

    const normalized = await saveSuiteToFile(current)
    const profileName = normalized.profile || activeProject?.activeProfile || 'default'
    const profileVariables = await loadProfileVars(profileName)

    setCaseStatuses({})
    setCaseMessages({})
    setRunSummary(null)
    runModeRef.current = 'suite'

    const result = await invoke<{ runId: string }>(IpcChannels.ENGINE_RUN_SUITE, {
      filePath,
      profileVariables,
      projectPath: activeProject?.path,
    })
    startRun(result.runId, filePath, false)
  }, [activeProject, filePath, runStatus, saveSuiteToFile, startRun, suiteRef])

  const runCase = useCallback(async (testCasePath: string) => {
    if (runStatus === 'running') return
    const current = suiteRef.current
    const profileName = current?.profile ?? activeProject?.activeProfile ?? 'default'
    const profileVariables = await loadProfileVars(profileName)

    runModeRef.current = testCasePath
    setCaseStatuses((prev) => ({ ...prev, [testCasePath]: 'running' }))
    setCaseMessages((prev) => ({ ...prev, [testCasePath]: '' }))

    const result = await invoke<{ runId: string }>(IpcChannels.ENGINE_RUN_CASE, {
      filePath: testCasePath,
      debugMode: false,
      profileVariables,
      projectPath: activeProject?.path,
    })
    startRun(result.runId, testCasePath, false)
  }, [activeProject, runStatus, startRun, suiteRef])

  const stopSuite = useCallback(async () => {
    if (!runId) return
    await invoke(IpcChannels.ENGINE_STOP, runId)
    stopRun()
  }, [runId, stopRun])

  return {
    caseStatuses, caseMessages, runSummary,
    runSuite, runCase, stopSuite,
    runId, runStatus,
  }
}
