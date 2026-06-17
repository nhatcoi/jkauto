import type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextSnapshot,
  AgentMessage,
  AgentSession,
  AgentSessionMode,
  AgentArtifact,
  AgentAction,
} from '@jkauto/core'

export type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextSnapshot,
  AgentMessage,
  AgentSession,
  AgentSessionMode,
  AgentArtifact,
  AgentAction,
}

export type AgentSendState = 'idle' | 'sending' | 'error'
