import type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextSnapshot,
  AgentMessage,
  AgentSession,
  AgentSessionMode,
  AgentArtifact,
  AgentAction,
  HarnessReport,
  HarnessRun,
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
  HarnessReport,
  HarnessRun,
}

export type AgentSendState = 'idle' | 'sending' | 'error'

export interface AgentThinkingStep {
  name: string
  args?: Record<string, unknown>
  result?: string
}
