import { streamText, dynamicTool, jsonSchema, type ModelMessage, type LanguageModelUsage, type ToolSet } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { AgentMessage, AgentMessageMeta, AgentSessionMode } from '@jkauto/core'
import type { McpManager } from './mcp-manager'
import { getSystemPrompt } from './prompt'

const DEFAULT_BASE_URL = 'http://127.0.0.1:20128/v1'
const DEFAULT_MODEL = 'v1'
const MAX_TOOL_ROUNDS = 20
const MAX_MESSAGES_TO_LLM = 20

export interface AgentConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AgentLlmResult {
  content: string
  model?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  metadata?: AgentMessageMeta
}

export function getConfig(override?: Partial<AgentConfig>): AgentConfig {
  return {
    baseUrl: override?.baseUrl || process.env.DEFAULT_BASE_URL || DEFAULT_BASE_URL,
    apiKey: override?.apiKey || process.env.DEFAULT_API_KEY || '',
    model: override?.model || process.env.DEFAULT_MODEL || DEFAULT_MODEL,
  }
}

function buildSystemPrompt(
  mode: AgentSessionMode,
  contextSummary: string,
  projectContext: string,
  sessionSummary: string | undefined,
  skills: string[],
): string {
  const parts: string[] = [getSystemPrompt(mode)]
  if (sessionSummary) parts.push(`## Session Memory\n${sessionSummary}`)
  if (projectContext) parts.push(`## Project Context\n${projectContext}`)
  parts.push(`## Current App State\n${contextSummary}`)
  parts.push(...skills)
  return parts.join('\n\n---\n\n')
}

function buildMessages(history: AgentMessage[]): ModelMessage[] {
  return history
    .slice(-MAX_MESSAGES_TO_LLM)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

function createFilteredFetch(): typeof fetch {
  return async (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
    const response = await globalThis.fetch(input, init)
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      return response
    }
    const transformer = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        const filtered = text
          .split('\n')
          .filter((line) => line !== 'data: null')
          .join('\n')
        controller.enqueue(new TextEncoder().encode(filtered))
      },
    })
    return new Response(response.body.pipeThrough(transformer), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

function mapUsage(usage: LanguageModelUsage) {
  return {
    prompt_tokens: usage.inputTokens ?? 0,
    completion_tokens: usage.outputTokens ?? 0,
    total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  }
}

async function buildMcpTools(manager: McpManager): Promise<ToolSet> {
  const mcpTools = await manager.listAllTools()
  return Object.fromEntries(
    mcpTools.map((t) => [
      t.name,
      dynamicTool({
        description: t.description,
        inputSchema: jsonSchema(t.inputSchema),
        execute: async (args) => {
          console.log(`[agent] tool call: ${t.name}`, args)
          const result = await manager.callTool(t.name, args as Record<string, unknown>)
          console.log(`[agent] tool result: ${t.name} → ${result.content.slice(0, 120)}`)
          return result.content
        },
      }),
    ]),
  )
}

export async function streamAgentChat(
  messages: AgentMessage[],
  contextSummary: string,
  projectContext: string,
  sessionSummary: string | undefined,
  mode: AgentSessionMode,
  mcpManager: McpManager | null,
  skills: string[],
  configOverride?: Partial<AgentConfig>,
  onChunk?: (text: string) => void,
): Promise<AgentLlmResult> {
  const config = getConfig(configOverride)
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    fetch: createFilteredFetch(),
  })

  const tools = mcpManager ? await buildMcpTools(mcpManager) : {}
  const hasTools = Object.keys(tools).length > 0

  const toolCallsLog: AgentMessageMeta['toolCalls'] = []

  const result = streamText({
    model: provider(config.model),
    system: buildSystemPrompt(mode, contextSummary, projectContext, sessionSummary, skills),
    messages: buildMessages(messages),
    ...(hasTools && { tools, maxSteps: MAX_TOOL_ROUNDS }),
    onStepFinish({ toolCalls }) {
      for (const tc of toolCalls ?? []) {
        toolCallsLog.push({ name: tc.toolName, args: tc.input })
      }
    },
  })

  let fullText = ''
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      fullText += part.text
      onChunk?.(part.text)
    } else if (part.type === 'error') {
      throw part.error instanceof Error ? part.error : new Error(String(part.error))
    }
  }

  const usage = await result.usage
  const response = await result.response

  if (!fullText) throw new Error('Agent returned no text (tool-only or empty stream)')

  const mappedUsage = usage ? mapUsage(usage) : undefined

  return {
    content: fullText,
    model: response.modelId,
    usage: mappedUsage,
    metadata: {
      model: response.modelId,
      usage: mappedUsage,
      toolCalls: toolCallsLog.length > 0 ? toolCallsLog : undefined,
    },
  }
}
