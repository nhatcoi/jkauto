// opencode REST API client + SSE bridge

export interface OcSession {
  id: string
  directory: string
  title: string
  time: { created: number; updated: number }
}

export interface OcMessageInfo {
  id: string
  role: 'user' | 'assistant'
  sessionID: string
  time: { created: number; completed?: number }
  tokens?: { input: number; output: number }
  modelID?: string
  error?: { name: string; data: { message: string } }
}

export interface OcPart {
  id: string
  type: 'text' | 'tool-use' | 'tool-result'
  messageID: string
  sessionID: string
  // text
  text?: string
  // tool-use
  tool?: string
  name?: string
  input?: unknown
  // tool-result
  output?: unknown
}

export interface OcMessage {
  info: OcMessageInfo
  parts: OcPart[]
}

export interface ToolEvent {
  type: 'call' | 'result'
  name: string
  args?: Record<string, unknown>
  result?: string
}

// ─── Session CRUD ───────────────────────────────────────────────────────────

export async function ocListSessions(baseUrl: string): Promise<OcSession[]> {
  const r = await fetch(`${baseUrl}/session`)
  if (!r.ok) throw new Error(`opencode list sessions: ${r.status}`)
  return r.json() as Promise<OcSession[]>
}

export async function ocCreateSession(
  baseUrl: string,
  opts: { title?: string } = {},
): Promise<OcSession> {
  const r = await fetch(`${baseUrl}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.title ? { title: opts.title } : {}),
  })
  if (!r.ok) throw new Error(`opencode create session: ${r.status}`)
  return r.json() as Promise<OcSession>
}

export async function ocGetMessages(
  baseUrl: string,
  sessionId: string,
): Promise<OcMessage[]> {
  const r = await fetch(`${baseUrl}/session/${sessionId}/message`)
  if (!r.ok) throw new Error(`opencode get messages: ${r.status}`)
  return r.json() as Promise<OcMessage[]>
}

// ─── Send message + stream events ───────────────────────────────────────────

export interface SendResult {
  content: string
  model?: string
  usage?: { input: number; output: number }
}

export async function ocSendMessage(
  baseUrl: string,
  sessionId: string,
  text: string,
  onChunk: (delta: string) => void,
  onToolEvent: (event: ToolEvent) => void,
): Promise<SendResult> {
  return new Promise((resolve, reject) => {
    let fullText = ''
    let assistantModel: string | undefined
    let assistantUsage: SendResult['usage']
    let settled = false
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let connectTimeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      settle(new Error('opencode SSE: server.connected timeout (8s)'))
    }, 8_000)

    function settle(result: SendResult | Error) {
      if (settled) return
      settled = true
      if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null }
      reader?.cancel().catch(() => {})
      if (result instanceof Error) reject(result)
      else resolve(result)
    }

    // Track which messageIDs are assistant messages
    const messageRoles = new Map<string, 'user' | 'assistant'>()

    // Start SSE subscription
    fetch(`${baseUrl}/event?sessionID=${sessionId}`)
      .then(async (response) => {
        if (!response.ok || !response.body) {
          settle(new Error(`opencode SSE: ${response.status}`))
          return
        }
        reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            let event: { type: string; properties: Record<string, unknown> }
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            const { type, properties } = event

            if (type === 'server.connected') {
              if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null }
              // Now safe to send the message
              fetch(`${baseUrl}/session/${sessionId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parts: [{ type: 'text', text }] }),
              }).catch(settle)
              continue
            }

            if (type === 'message.updated') {
              const info = properties.info as OcMessageInfo | undefined
              if (info?.id && info.role) {
                messageRoles.set(info.id, info.role)
                if (info.role === 'assistant') {
                  if (info.modelID) assistantModel = info.modelID
                  if (info.tokens) {
                    assistantUsage = { input: info.tokens.input, output: info.tokens.output }
                  }
                  if (info.error) {
                    settle(new Error(info.error.data?.message ?? 'opencode error'))
                  }
                }
              }
              continue
            }

            // Use delta events for efficient streaming (incremental text chunks)
            if (type === 'message.part.delta') {
              const { messageID, field, delta } = properties as {
                messageID: string
                field: string
                delta: string
              }
              if (field === 'text' && messageRoles.get(messageID) === 'assistant') {
                fullText += delta
                onChunk(delta)
              }
              continue
            }

            if (type === 'message.part.updated') {
              const part = properties.part as OcPart | undefined
              if (!part) continue
              const role = messageRoles.get(part.messageID)
              if (role !== 'assistant') continue

              // Tool events (delta events don't cover tool use/result)
              if (part.type === 'tool-use') {
                const name = part.name ?? part.tool ?? 'unknown'
                const args = (part.input ?? {}) as Record<string, unknown>
                onToolEvent({ type: 'call', name, args })
              } else if (part.type === 'tool-result') {
                const name = part.tool ?? 'unknown'
                const result = typeof part.output === 'string'
                  ? part.output
                  : JSON.stringify(part.output ?? '')
                onToolEvent({ type: 'result', name, result })
              }
              continue
            }

            if (type === 'session.error') {
              const err = (properties.error as { data?: { message?: string } } | undefined)
              settle(new Error(err?.data?.message ?? 'opencode session error'))
              continue
            }

            if (
              type === 'session.idle' ||
              (type === 'session.status' &&
                (properties.status as { type?: string } | undefined)?.type === 'idle')
            ) {
              settle({
                content: fullText,
                model: assistantModel,
                usage: assistantUsage,
              })
            }
          }
        }

        if (!settled) {
          settle({ content: fullText, model: assistantModel, usage: assistantUsage })
        }
      })
      .catch(settle)

  })
}

// ─── Map OcMessage[] → flat AgentMessage content string ─────────────────────

export function ocMessagesToContent(messages: OcMessage[]): string {
  return messages
    .filter((m) => m.info.role === 'assistant')
    .flatMap((m) => m.parts.filter((p) => p.type === 'text' && p.text))
    .map((p) => p.text ?? '')
    .join('')
}
