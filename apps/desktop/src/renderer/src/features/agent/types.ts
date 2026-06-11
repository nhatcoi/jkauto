import type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextSnapshot,
  AgentMessage,
} from '@jkauto/core'

export type { AgentChatPayload, AgentChatResult, AgentContextSnapshot, AgentMessage }

export type AgentSendState = 'idle' | 'sending' | 'error'
