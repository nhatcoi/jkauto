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

export interface AgentToolEvent {
  type: 'call' | 'result'
  name: string
  args?: Record<string, unknown>
  result?: string
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
  onToolEvent?: (event: AgentToolEvent) => void,
): Promise<AgentLlmResult> {
  const config = getConfig(configOverride)
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
    fetch: createFilteredFetch(),
  })

  const tools = mcpManager ? await buildMcpTools(mcpManager) : {}
  const hasTools = Object.keys(tools).length > 0
  const systemPrompt = buildSystemPrompt(mode, contextSummary, projectContext, sessionSummary, skills)

  const toolCallsLog: AgentMessageMeta['toolCalls'] = []

  // Manual agentic loop — local models don't handle role:tool continuation messages,
  // so we inject tool results as user messages and call the model again ourselves.
  let currentMessages = buildMessages(messages)
  let fullText = ''
  let lastUsage: LanguageModelUsage | undefined
  let lastModelId: string | undefined

  for (let step = 0; step < MAX_TOOL_ROUNDS; step++) {
    const result = streamText({
      model: provider(config.model),
      system: systemPrompt,
      messages: currentMessages,
      ...(hasTools && { tools }),
      onStepFinish({ toolCalls }) {
        for (const tc of toolCalls ?? []) {
          toolCallsLog.push({ name: tc.toolName, args: tc.input })
        }
      },
    })

    let stepText = ''
    const stepToolResults: string[] = []

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        stepText += part.text
        fullText += part.text
        onChunk?.(part.text)
      } else if (part.type === 'tool-call') {
        onToolEvent?.({ type: 'call', name: part.toolName, args: part.args as Record<string, unknown> })
      } else if (part.type === 'tool-result') {
        // AI SDK v6: property is "output", not "result"
        const out = (part as unknown as { output?: unknown }).output
        const outStr =
          out === undefined ? '(empty)' : typeof out === 'string' ? out : JSON.stringify(out)
        stepToolResults.push(`[${part.toolName}]: ${outStr}`)
        onToolEvent?.({ type: 'result', name: part.toolName, result: outStr })
      } else if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error(String(part.error))
      }
    }

    lastUsage = await result.usage
    lastModelId = (await result.response).modelId

    if (stepText || stepToolResults.length === 0) {
      // Model produced text, or called no tools — done
      break
    }

    // Tools ran but no text: inject results as user message and continue loop.
    // Use XML tags + no fake assistant turn — avoids model echoing "[Tools called: ...]".
    currentMessages = [
      ...currentMessages,
      {
        role: 'user' as const,
        content: `<tool_results>\n${stepToolResults.join('\n\n')}\n</tool_results>\n\nContinue with the task and write your response to the user.`,
      },
    ]
  }

  if (!fullText) {
    throw new Error('Agent returned no text after all tool steps')
  }

  const mappedUsage = lastUsage ? mapUsage(lastUsage) : undefined

  return {
    content: fullText,
    model: lastModelId,
    usage: mappedUsage,
    metadata: {
      model: lastModelId,
      usage: mappedUsage,
      toolCalls: toolCallsLog.length > 0 ? toolCallsLog : undefined,
    },
  }
}
