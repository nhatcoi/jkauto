import { create } from 'zustand'
import { IpcChannels } from '@jkauto/core'
import type {
  AgentSession,
  AgentSessionMode,
  AgentArtifact,
  AgentAction,
  HarnessReport,
  HarnessRun,
} from '@jkauto/core'
import { invoke } from '@/lib/utils'

interface SessionStore {
  sessions: AgentSession[]
  activeSessionId: string | null
  artifacts: AgentArtifact[]
  actions: AgentAction[]
  harnessRuns: HarnessRun[]
  harnessReport: HarnessReport | null
  loading: boolean

  loadSessions: (projectPath: string) => Promise<void>
  createSession: (
    projectPath: string,
    mode?: AgentSessionMode,
    title?: string,
  ) => Promise<AgentSession>
  selectSession: (projectPath: string, id: string) => Promise<void>
  updateSession: (
    projectPath: string,
    id: string,
    patch: Partial<Pick<AgentSession, 'title' | 'mode' | 'status' | 'summary'>>,
  ) => Promise<void>
  deleteSession: (projectPath: string, id: string) => Promise<void>
  refreshArtifacts: (projectPath: string, sessionId: string) => Promise<void>
  refreshActions: (projectPath: string, sessionId: string) => Promise<void>
  refreshHarness: (projectPath: string, sessionId: string) => Promise<void>
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  artifacts: [],
  actions: [],
  harnessRuns: [],
  harnessReport: null,
  loading: false,

  loadSessions: async (projectPath) => {
    set({ loading: true })
    try {
      const sessions = await invoke<AgentSession[]>(
        IpcChannels.AGENT_SESSION_LIST,
        { projectPath },
      )
      set({ sessions, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createSession: async (projectPath, mode = 'normal', title?: string) => {
    const session = await invoke<AgentSession>(
      IpcChannels.AGENT_SESSION_CREATE,
      {
        projectPath,
        mode,
        title,
      },
    )
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: session.id,
    }))
    return session
  },

  selectSession: async (projectPath, id) => {
    set({
      activeSessionId: id,
      artifacts: [],
      actions: [],
      harnessRuns: [],
      harnessReport: null,
    })
    await Promise.all([
      get().refreshArtifacts(projectPath, id),
      get().refreshActions(projectPath, id),
      get().refreshHarness(projectPath, id),
    ])
  },

  updateSession: async (projectPath, id, patch) => {
    await invoke(IpcChannels.AGENT_SESSION_UPDATE, { projectPath, id, patch })
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id
          ? { ...sess, ...patch, updatedAt: new Date().toISOString() }
          : sess,
      ),
    }))
  },

  deleteSession: async (projectPath, id) => {
    await invoke(IpcChannels.AGENT_SESSION_DELETE, { projectPath, id })
    const { sessions, activeSessionId } = get()
    const remaining = sessions.filter((s) => s.id !== id)
    set({
      sessions: remaining,
      activeSessionId:
        activeSessionId === id ? (remaining[0]?.id ?? null) : activeSessionId,
    })
  },

  refreshArtifacts: async (projectPath, sessionId) => {
    const artifacts = await invoke<AgentArtifact[]>(
      IpcChannels.AGENT_SESSION_ARTIFACTS,
      {
        projectPath,
        sessionId,
      },
    )
    set({ artifacts })
  },

  refreshActions: async (projectPath, sessionId) => {
    const actions = await invoke<AgentAction[]>(
      IpcChannels.AGENT_SESSION_ACTIONS,
      {
        projectPath,
        sessionId,
      },
    )
    set({ actions })
  },

  refreshHarness: async (projectPath, sessionId) => {
    const harnessRuns = await invoke<HarnessRun[]>(
      IpcChannels.AGENT_HARNESS_RUNS,
      { projectPath, sessionId },
    )
    const latest = harnessRuns[0]
    const harnessReport = latest
      ? await invoke<HarnessReport>(IpcChannels.AGENT_HARNESS_REPORT, {
          projectPath,
          runId: latest.id,
        })
      : null
    set({ harnessRuns, harnessReport })
  },

  reset: () =>
    set({
      sessions: [],
      activeSessionId: null,
      artifacts: [],
      actions: [],
      harnessRuns: [],
      harnessReport: null,
      loading: false,
    }),
}))
