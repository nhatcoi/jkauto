import OpenAI from 'openai'
import type { AgentMessage } from '@jkauto/core'
import type { McpClient } from './mcp-client'
import { AGENT_SYSTEM_PROMPT } from './prompt'

const DEFAULT_BASE_URL = 'http://127.0.0.1:20128/v1'
const DEFAULT_MODEL = 'v1'
const DEFAULT_API_KEY = 'sk-67abc7d002e1dde6-35cltj-04a78299'
const MAX_TOOL_ROUNDS = 20

export interface AgentConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AgentLlmResult {
  content: string
  model?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export function getConfig(override?: Partial<AgentConfig>): AgentConfig {
  return {
    baseUrl: override?.baseUrl || process.env.JKAUTO_AGENT_BASE_URL || DEFAULT_BASE_URL,
    apiKey: override?.apiKey || process.env.JKAUTO_AGENT_API_KEY || DEFAULT_API_KEY,
    model: override?.model || process.env.JKAUTO_AGENT_MODEL || DEFAULT_MODEL,
  }
}

function makeClient(config: AgentConfig): OpenAI {
  return new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })
}

type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

function buildMessages(
  history: AgentMessage[],
  contextSummary: string,
): OAIMessage[] {
  return [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'system', content: `Current JKAuto context:\n${contextSummary}` },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]
}

// Plain chat — no tools
export async function sendAgentChat(
  messages: AgentMessage[],
  contextSummary: string,
  configOverride?: Partial<AgentConfig>,
): Promise<AgentLlmResult> {
  const config = getConfig(configOverride)
  const client = makeClient(config)

  const completion = await client.chat.completions.create({
    model: config.model,
    messages: buildMessages(messages, contextSummary),
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Agent API returned no assistant message')

  return {
    content,
    model: completion.model,
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined,
  }
}

// Agentic loop — uses MCP tools until done or max rounds
export async function sendAgentChatWithTools(
  messages: AgentMessage[],
  contextSummary: string,
  mcpClient: McpClient,
  configOverride?: Partial<AgentConfig>,
): Promise<AgentLlmResult> {
  const config = getConfig(configOverride)
  const client = makeClient(config)

  const tools = await mcpClient.listTools()
  const thread: OAIMessage[] = buildMessages(messages, contextSummary)

  let lastContent = ''
  let lastModel: string | undefined
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: thread,
      tools,
      tool_choice: 'auto',
    })

    const choice = completion.choices[0]
    lastModel = completion.model
    if (completion.usage) {
      totalUsage.prompt_tokens += completion.usage.prompt_tokens
      totalUsage.completion_tokens += completion.usage.completion_tokens
      totalUsage.total_tokens += completion.usage.total_tokens
    }

    // Append assistant message to thread
    thread.push(choice.message)

    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      // Done — no more tool calls
      lastContent = choice.message.content ?? ''
      break
    }

    // Execute each tool call in parallel
    const toolResults = await Promise.all(
      choice.message.tool_calls.map(async (tc) => {
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(tc.function.arguments) as Record<string, unknown> } catch {}

        console.log(`[agent] tool call: ${tc.function.name}`, args)
        const result = await mcpClient.callTool(tc.function.name, args).catch((e) => ({
          content: `Tool error: ${e instanceof Error ? e.message : String(e)}`,
          isError: true,
        }))
        console.log(`[agent] tool result: ${tc.function.name} → ${result.content.slice(0, 120)}`)

        return {
          role: 'tool' as const,
          tool_call_id: tc.id,
          content: result.content,
        }
      }),
    )

    thread.push(...toolResults)
  }

  if (!lastContent) throw new Error('Agent loop ended without producing a response')

  return { content: lastContent, model: lastModel, usage: totalUsage }
}
