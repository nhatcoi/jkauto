import { create } from 'zustand'
import type { AgentMessage, AgentSendState, AgentThinkingStep } from './types'

interface AgentStore {
  messages: AgentMessage[]
  sendState: AgentSendState
  error: string | null
  streamingContent: string | null
  pendingToolCalls: AgentThinkingStep[]
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
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    },
  ) => void
  startStreaming: () => void
  appendStreamChunk: (chunk: string) => void
  finalizeStream: () => void
  addPendingToolCall: (name: string, args?: Record<string, unknown>) => void
  updatePendingToolResult: (name: string, result: string) => void
  clear: () => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [],
  sendState: 'idle',
  error: null,
  streamingContent: null,
  pendingToolCalls: [],
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

  startStreaming: () => set({ streamingContent: '', pendingToolCalls: [] }),

  appendStreamChunk: (chunk) =>
    set((state) => ({
      streamingContent: (state.streamingContent ?? '') + chunk,
    })),

  finalizeStream: () => set({ streamingContent: null }),

  addPendingToolCall: (name, args) =>
    set((state) => ({
      pendingToolCalls: [...state.pendingToolCalls, { name, args }],
    })),

  updatePendingToolResult: (name, result) =>
    set((state) => {
      // Update the last entry with matching name that has no result yet
      const steps = [...state.pendingToolCalls]
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].name === name && steps[i].result === undefined) {
          steps[i] = { ...steps[i], result }
          break
        }
      }
      return { pendingToolCalls: steps }
    }),

  clear: () =>
    set({
      messages: [],
      sendState: 'idle',
      error: null,
      streamingContent: null,
      pendingToolCalls: [],
      lastModel: null,
      lastUsage: null,
    }),
}))
