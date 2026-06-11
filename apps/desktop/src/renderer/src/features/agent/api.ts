import { IpcChannels } from '@jkauto/core'
import type { AgentChatPayload, AgentChatResult } from '@jkauto/core'
import { invoke } from '@/lib/utils'

export function sendAgentMessage(payload: AgentChatPayload): Promise<AgentChatResult> {
  return invoke<AgentChatResult>(IpcChannels.AGENT_CHAT, payload)
}
