import { randomUUID } from 'node:crypto'
import type { AgentChatPayload, AgentChatResult, AgentContextResult } from '@jkauto/core'
import { buildAgentContext } from './context-builder'
import { sendAgentChat, sendAgentChatWithTools } from './llm-client'
import type { AgentConfig } from './llm-client'
import { createPlaywrightMcpClient } from './mcp-client'

export async function getAgentContext(payload: AgentChatPayload): Promise<AgentContextResult> {
  return buildAgentContext(payload.context)
}

export async function chatWithAgent(
  payload: AgentChatPayload,
  agentConfig?: Partial<AgentConfig>,
): Promise<AgentChatResult> {
  const context = await getAgentContext(payload)

  // Check if caller requested MCP tools (context flag)
  const useMcp = (payload.context as { useMcp?: boolean } | undefined)?.useMcp === true

  let content: string
  let model: string | undefined
  let usage: AgentChatResult['usage']

  if (useMcp) {
    const mcp = createPlaywrightMcpClient()
    try {
      await mcp.connect()
      const result = await sendAgentChatWithTools(
        payload.messages,
        context.summary,
        mcp,
        agentConfig,
      )
      content = result.content
      model = result.model
      usage = result.usage
    } finally {
      await mcp.disconnect().catch(() => {})
    }
  } else {
    const result = await sendAgentChat(payload.messages, context.summary, agentConfig)
    content = result.content
    model = result.model
    usage = result.usage
  }

  return {
    message: {
      id: randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    },
    model,
    usage,
  }
}
