import { create } from 'zustand'
import type { AgentMessage, AgentSendState } from './types'

interface AgentStore {
  messages: AgentMessage[]
  sendState: AgentSendState
  error: string | null
  streamingContent: string | null
  lastModel: string | null
  lastUsage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
  addMessage: (message: AgentMessage) => void
  setMessages: (messages: AgentMessage[]) => void
  setSendState: (sendState: AgentSendState) => void
  setError: (error: string | null) => void
  setMetadata: (
    model?: string,
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  ) => void
  startStreaming: () => void
  appendStreamChunk: (chunk: string) => void
  finalizeStream: () => void
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
  streamingContent: null,
  lastModel: null,
  lastUsage: null,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setSendState: (sendState) => set({ sendState }),

  setError: (error) =>
    set({ error, sendState: error ? 'error' : 'idle', streamingContent: null }),

  setMetadata: (model, usage) =>
    set({ lastModel: model ?? null, lastUsage: usage ?? null }),

  startStreaming: () => set({ streamingContent: '' }),

  appendStreamChunk: (chunk) =>
    set((state) => ({
      streamingContent: (state.streamingContent ?? '') + chunk,
    })),

  finalizeStream: () => set({ streamingContent: null }),

  clear: () =>
    set({
      messages: [],
      sendState: 'idle',
      error: null,
      streamingContent: null,
      lastModel: null,
      lastUsage: null,
    }),
}))
