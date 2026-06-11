import { randomUUID } from 'node:crypto'
import type { AgentChatPayload, AgentChatResult, AgentContextResult } from '@jkauto/core'
import { buildAgentContext } from './context-builder'
import { sendAgentChat } from './llm-client'

export async function getAgentContext(
  payload: AgentChatPayload,
): Promise<AgentContextResult> {
  return buildAgentContext(payload.context)
}

export async function chatWithAgent(payload: AgentChatPayload): Promise<AgentChatResult> {
  const context = await getAgentContext(payload)
  const response = await sendAgentChat(payload.messages, context.summary)

  return {
    message: {
      id: randomUUID(),
      role: 'assistant',
      content: response.content,
      createdAt: new Date().toISOString(),
    },
    model: response.model,
    usage: response.usage,
  }
}
