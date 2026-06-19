import { create } from 'zustand'
import type { StepEvent, RunCompleteEvent, RunRecord, SuiteEvent } from '@jkauto/core'

export type StepStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped'

export interface LogEntry {
  id: string
  time: string
  level: 'info' | 'success' | 'error' | 'warn'
  message: string
  stepIndex?: number
}

export interface EventEntry {
  id: string
  time: string
  message: string
}

export interface AppiumLogEntry {
  id: string
  time: string
  level: 'info' | 'error'
  message: string
}

interface RunStore {
  runId: string | null
  filePath: string | null
  status: 'idle' | 'running' | 'passed' | 'failed' | 'stopped'
  stepStatuses: Record<number, StepStatus>
  stepMessages: Record<number, string>
  stepDurations: Record<number, number>
  stepScreenshots: Record<number, string>
  stepMeta: Record<number, unknown>
  logs: LogEntry[]
  events: EventEntry[]
  appiumLogs: AppiumLogEntry[]
  runHistory: RunRecord[]
  isDebugMode: boolean
  isDebugPaused: boolean

  // actions
  startRun: (runId: string, filePath: string, debugMode?: boolean) => void
  handleStepEvent: (event: StepEvent) => void
  handleSuiteEvent: (event: SuiteEvent) => void
  handleRunComplete: (event: RunCompleteEvent) => void
  setDebugPaused: (paused: boolean) => void
  stopRun: () => void
  clearLogs: () => void
  reset: () => void
  setRunHistory: (records: RunRecord[]) => void
  appendRunRecord: (record: RunRecord) => void
  addLog: (message: string, level?: LogEntry['level']) => void
  addAppiumLog: (message: string, level?: AppiumLogEntry['level']) => void
  clearAppiumLogs: () => void
}

function ts() {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

function uid() {
  return crypto.randomUUID()
}

export const useRunStore = create<RunStore>((set, get) => ({
  runId: null,
  filePath: null,
  status: 'idle',
  stepStatuses: {},
  stepMessages: {},
  stepDurations: {},
  stepScreenshots: {},
  stepMeta: {},
  logs: [],
  events: [],
  appiumLogs: [],
  runHistory: [],
  isDebugMode: false,
  isDebugPaused: false,

  startRun: (runId, filePath, debugMode = false) =>
    set({
      runId,
      filePath,
      status: 'running',
      isDebugMode: debugMode,
      isDebugPaused: false,
      stepStatuses: {},
      stepMessages: {},
      stepDurations: {},
      stepScreenshots: {},
      stepMeta: {},
      logs: [
        {
          id: uid(),
          time: ts(),
          level: 'info',
          message: `▶ Run started — ${filePath.split('/').pop()}${debugMode ? ' (debug)' : ''}`,
        },
      ],
      events: [
        {
          id: uid(),
          time: ts(),
          message: `Run started (id: ${runId.slice(0, 8)}…)${debugMode ? ' — debug mode' : ''}`,
        },
      ],
    }),

  handleStepEvent: (event: StepEvent) => {
    const { stepIndex, status, message, durationMs, screenshotPath, meta } = event
    set((state) => {
      const newStatuses = { ...state.stepStatuses, [stepIndex]: status as StepStatus }
      const newMessages = message
        ? { ...state.stepMessages, [stepIndex]: message }
        : state.stepMessages
      const newDurations =
        durationMs !== undefined
          ? { ...state.stepDurations, [stepIndex]: durationMs }
          : state.stepDurations
      const newScreenshots =
        screenshotPath
          ? { ...state.stepScreenshots, [stepIndex]: screenshotPath }
          : state.stepScreenshots
      const newMeta = meta !== undefined
        ? { ...state.stepMeta, [stepIndex]: meta }
        : state.stepMeta

      const logLevel =
        status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'info'
      const durationStr =
        durationMs !== undefined ? ` (${durationMs}ms)` : ''
      const logMsg =
        status === 'running'
          ? `  Step ${stepIndex + 1}: running…`
          : status === 'failed'
            ? `  Step ${stepIndex + 1}: FAILED — ${message ?? 'error'}${durationStr}`
            : status === 'skipped'
              ? `  Step ${stepIndex + 1}: skipped`
              : `  Step ${stepIndex + 1}: passed${durationStr}`

      const isDebugPaused = state.isDebugMode && (status === 'passed' || status === 'failed')

      return {
        stepStatuses: newStatuses,
        stepMessages: newMessages,
        stepDurations: newDurations,
        stepScreenshots: newScreenshots,
        stepMeta: newMeta,
        isDebugPaused,
        logs: [
          ...state.logs,
          { id: uid(), time: ts(), level: logLevel as LogEntry['level'], message: logMsg, stepIndex },
        ],
      }
    })
  },

  handleSuiteEvent: (event: SuiteEvent) => {
    set((state) => {
      let level: LogEntry['level'] = 'info'
      let message = ''

      if (event.type === 'suite-start') {
        message = `Suite started — ${event.suiteName} (${event.totalCases ?? 0} cases)`
      } else if (event.type === 'case-start') {
        message = `Case ${(event.caseIndex ?? 0) + 1}/${event.totalCases ?? '?'}: ${event.testCaseName ?? event.testCasePath}`
      } else if (event.type === 'case-complete') {
        level = event.status === 'passed' ? 'success' : event.status === 'failed' ? 'error' : event.status === 'stopped' ? 'warn' : 'info'
        const duration = event.durationMs !== undefined ? ` (${event.durationMs}ms)` : ''
        message = `Case ${(event.caseIndex ?? 0) + 1}/${event.totalCases ?? '?'} ${event.status ?? 'completed'} — ${event.testCaseName ?? event.testCasePath}${duration}`
        if (event.message) message += ` — ${event.message}`
      } else {
        level = event.status === 'passed' ? 'success' : event.status === 'failed' ? 'error' : event.status === 'stopped' ? 'warn' : 'info'
        const duration = event.durationMs !== undefined ? ` (${event.durationMs}ms)` : ''
        message = `Suite ${event.status ?? 'completed'} — ${event.message ?? event.suiteName}${duration}`
      }

      return {
        logs: [
          ...state.logs,
          { id: uid(), time: ts(), level, message },
        ],
        events: [
          ...state.events,
          { id: uid(), time: ts(), message },
        ],
      }
    })
  },

  setDebugPaused: (paused) => set({ isDebugPaused: paused }),

  handleRunComplete: (event: RunCompleteEvent) => {
    const { status, passedSteps, failedSteps, totalSteps, durationMs, error } = event
    const icon = status === 'passed' ? '✓' : status === 'stopped' ? '⏹' : '✗'
    const summaryMsg = `${icon} Run ${status} — ${passedSteps}/${totalSteps} passed, ${failedSteps} failed (${durationMs}ms)`

    set((state) => ({
      status: status as RunStore['status'],
      isDebugPaused: false,
      logs: [
        ...state.logs,
        {
          id: uid(),
          time: ts(),
          level: status === 'passed' ? 'success' : 'error',
          message: summaryMsg,
        },
        ...(error ? [{ id: uid(), time: ts(), level: 'error' as const, message: `Error: ${error}` }] : []),
      ],
      events: [
        ...state.events,
        {
          id: uid(),
          time: ts(),
          message: summaryMsg,
        },
      ],
    }))
  },

  stopRun: () =>
    set((state) => ({
      status: 'stopped',
      logs: [
        ...state.logs,
        { id: uid(), time: ts(), level: 'warn', message: '⏹ Run stopped by user' },
      ],
      events: [
        ...state.events,
        { id: uid(), time: ts(), message: 'Run stopped by user' },
      ],
    })),

  clearLogs: () => set({ logs: [], events: [] }),

  reset: () =>
    set({
      runId: null,
      filePath: null,
      status: 'idle',
      stepStatuses: {},
      stepMessages: {},
      stepDurations: {},
      stepScreenshots: {},
      stepMeta: {},
      logs: [],
      events: [],
    }),

  setRunHistory: (records) => set({ runHistory: records }),

  appendRunRecord: (record) =>
    set((state) => ({ runHistory: [record, ...state.runHistory].slice(0, 50) })),

  addLog: (message, level = 'info') =>
    set((state) => ({
      logs: [...state.logs, { id: uid(), time: ts(), level, message }],
    })),

  addAppiumLog: (message, level = 'info') =>
    set((state) => ({
      appiumLogs: [...state.appiumLogs, { id: uid(), time: ts(), level, message }].slice(-500),
    })),

  clearAppiumLogs: () => set({ appiumLogs: [] }),
}))
