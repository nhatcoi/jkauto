import { create } from 'zustand'
import type { AgentMessage, AgentSendState } from './types'

interface AgentStore {
  messages: AgentMessage[]
  sendState: AgentSendState
  error: string | null
  lastModel: string | null
  lastUsage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
  addMessage: (message: AgentMessage) => void
  setSendState: (sendState: AgentSendState) => void
  setError: (error: string | null) => void
  setMetadata: (
    model?: string,
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    },
  ) => void
  clear: () => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello. I can help debug runs, explain app behavior, and suggest JKAuto test steps from the current project context.',
      createdAt: new Date().toISOString(),
    },
  ],
  sendState: 'idle',
  error: null,
  lastModel: null,
  lastUsage: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setSendState: (sendState) => set({ sendState }),

  setError: (error) => set({ error, sendState: error ? 'error' : 'idle' }),

  setMetadata: (model, usage) =>
    set({
      lastModel: model ?? null,
      lastUsage: usage ?? null,
    }),

  clear: () =>
    set({
      messages: [],
      sendState: 'idle',
      error: null,
      lastModel: null,
      lastUsage: null,
    }),
}))
