import { create } from 'zustand'
import type { StepEvent, RunCompleteEvent, RunRecord } from '@jkauto/core'

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

interface RunStore {
  runId: string | null
  filePath: string | null
  status: 'idle' | 'running' | 'passed' | 'failed' | 'stopped'
  stepStatuses: Record<number, StepStatus>
  stepMessages: Record<number, string>
  stepDurations: Record<number, number>
  logs: LogEntry[]
  events: EventEntry[]
  runHistory: RunRecord[]

  // actions
  startRun: (runId: string, filePath: string) => void
  handleStepEvent: (event: StepEvent) => void
  handleRunComplete: (event: RunCompleteEvent) => void
  stopRun: () => void
  clearLogs: () => void
  reset: () => void
  setRunHistory: (records: RunRecord[]) => void
  appendRunRecord: (record: RunRecord) => void
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
  logs: [],
  events: [],
  runHistory: [],

  startRun: (runId, filePath) =>
    set({
      runId,
      filePath,
      status: 'running',
      stepStatuses: {},
      stepMessages: {},
      stepDurations: {},
      logs: [
        {
          id: uid(),
          time: ts(),
          level: 'info',
          message: `▶ Run started — ${filePath.split('/').pop()}`,
        },
      ],
      events: [
        {
          id: uid(),
          time: ts(),
          message: `Run started (id: ${runId.slice(0, 8)}…)`,
        },
      ],
    }),

  handleStepEvent: (event: StepEvent) => {
    const { stepIndex, status, message, durationMs } = event
    set((state) => {
      const newStatuses = { ...state.stepStatuses, [stepIndex]: status as StepStatus }
      const newMessages = message
        ? { ...state.stepMessages, [stepIndex]: message }
        : state.stepMessages
      const newDurations =
        durationMs !== undefined
          ? { ...state.stepDurations, [stepIndex]: durationMs }
          : state.stepDurations

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

      return {
        stepStatuses: newStatuses,
        stepMessages: newMessages,
        stepDurations: newDurations,
        logs: [
          ...state.logs,
          { id: uid(), time: ts(), level: logLevel as LogEntry['level'], message: logMsg, stepIndex },
        ],
      }
    })
  },

  handleRunComplete: (event: RunCompleteEvent) => {
    const { status, passedSteps, failedSteps, totalSteps, durationMs } = event
    const icon = status === 'passed' ? '✓' : status === 'stopped' ? '⏹' : '✗'
    const summaryMsg = `${icon} Run ${status} — ${passedSteps}/${totalSteps} passed, ${failedSteps} failed (${durationMs}ms)`

    set((state) => ({
      status: status as RunStore['status'],
      logs: [
        ...state.logs,
        {
          id: uid(),
          time: ts(),
          level: status === 'passed' ? 'success' : 'error',
          message: summaryMsg,
        },
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
      logs: [],
      events: [],
    }),

  setRunHistory: (records) => set({ runHistory: records }),

  appendRunRecord: (record) =>
    set((state) => ({ runHistory: [record, ...state.runHistory].slice(0, 50) })),
}))
