import { randomUUID } from 'node:crypto'
import type { IpcMain } from 'electron'
import { IpcChannels } from '@jkauto/core'
import type {
  AgentChatPayload,
  AgentSessionListPayload,
  AgentSessionCreatePayload,
  AgentSessionUpdatePayload,
  AgentSessionDeletePayload,
  AgentSessionDataPayload,
  HarnessReportPayload,
  HarnessRunListPayload,
  AgentSession,
  AgentMessage,
  AgentChatResult,
} from '@jkauto/core'
import { getOrStartRuntime } from '../services/agent-runtime/agent-runtime'
import {
  ocListSessions,
  ocCreateSession,
  ocGetMessages,
  ocSendMessage,
  type OcSession,
} from '../services/agent-runtime/agent-client'
import {
  getHarnessReport,
  listHarnessRuns,
} from '../services/agent/harness.service'

// ─── Local metadata overlay ──────────────────────────────────────────────────
// opencode sessions don't have mode/status — we track them here.
// Lost on restart (acceptable: sessions persist in opencode's global DB).

interface SessionMeta {
  mode: 'normal' | 'directly'
  status: AgentSession['status']
  title?: string
}

const sessionMeta = new Map<string, SessionMeta>()

function getMeta(id: string): SessionMeta {
  return sessionMeta.get(id) ?? { mode: 'normal', status: 'active' }
}

// ─── Type adapters ───────────────────────────────────────────────────────────

function ocToAgentSession(oc: OcSession, projectPath: string): AgentSession {
  const meta = getMeta(oc.id)
  return {
    id: oc.id,
    projectPath,
    title: meta.title ?? oc.title,
    mode: meta.mode,
    status: meta.status,
    createdAt: new Date(oc.time.created).toISOString(),
    updatedAt: new Date(oc.time.updated).toISOString(),
  }
}

function flattenOcMessages(
  msgs: Awaited<ReturnType<typeof ocGetMessages>>,
  projectPath: string,
): AgentMessage[] {
  return msgs
    .filter((m) => m.info.role === 'user' || m.info.role === 'assistant')
    .filter((m) => getMeta('').status !== 'deleted') // filter only non-deleted — placeholder
    .map((m) => ({
      id: m.info.id,
      sessionId: m.info.sessionID,
      role: m.info.role as 'user' | 'assistant',
      content: m.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join(''),
      createdAt: new Date(m.info.time.created).toISOString(),
    }))
    .filter((m) => m.content.length > 0)
}

// ─── Persona injection ───────────────────────────────────────────────────────
// Track sessions that have received persona context (persists in-process)

const sessionPersonaInjected = new Set<string>()

const JKAUTO_PERSONA_PREFIX = `<assistant_identity>
Vai trò của bạn trong toàn bộ cuộc hội thoại này: Bạn là JKAuto Assistant — trợ lý AI được tích hợp sẵn trong JKAuto IDE, chuyên hỗ trợ kiểm thử tự động (test automation) với Playwright. Khi được hỏi "bạn là ai" hoặc "bạn tên gì", hãy giới thiệu mình là "JKAuto Assistant". Tuyệt đối không đề cập đến OpenCode, tên model, hay bất kỳ công cụ nội bộ nào. Dùng "bạn" và "tôi", giọng điệu thân thiện và chuyên nghiệp.
</assistant_identity>

`

function injectPersonaIfNeeded(sessionId: string, text: string): string {
  if (sessionPersonaInjected.has(sessionId)) return text
  sessionPersonaInjected.add(sessionId)
  return JKAUTO_PERSONA_PREFIX + text
}

// ─── Handler registration ────────────────────────────────────────────────────

export function registerAgentHandlers(ipcMain: IpcMain): void {
  // ── List sessions ──────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_SESSION_LIST,
    async (_, payload: AgentSessionListPayload) => {
      try {
        const baseUrl = await getOrStartRuntime(payload.projectPath)
        const all = await ocListSessions(baseUrl)
        return all
          .filter((s) => s.directory === payload.projectPath)
          .filter((s) => getMeta(s.id).status !== 'deleted')
          .map((s) => ocToAgentSession(s, payload.projectPath))
      } catch {
        return []
      }
    },
  )

  // ── Create session ─────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_SESSION_CREATE,
    async (_, payload: AgentSessionCreatePayload) => {
      const baseUrl = await getOrStartRuntime(payload.projectPath)
      const oc = await ocCreateSession(baseUrl, { title: payload.title })
      if (payload.mode) {
        sessionMeta.set(oc.id, { mode: payload.mode, status: 'active', title: payload.title })
      }
      return ocToAgentSession(oc, payload.projectPath)
    },
  )

  // ── Update session ─────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_SESSION_UPDATE,
    async (_, payload: AgentSessionUpdatePayload) => {
      const existing = getMeta(payload.id)
      sessionMeta.set(payload.id, {
        mode: payload.patch.mode ?? existing.mode,
        status: payload.patch.status ?? existing.status,
        title: payload.patch.title ?? existing.title,
      })
      return { ok: true }
    },
  )

  // ── Delete session ─────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_SESSION_DELETE,
    async (_, payload: AgentSessionDeletePayload) => {
      const existing = getMeta(payload.id)
      sessionMeta.set(payload.id, { ...existing, status: 'deleted' })
      return { ok: true }
    },
  )

  // ── Get messages ───────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_SESSION_MESSAGES,
    async (_, payload: AgentSessionDataPayload) => {
      try {
        const baseUrl = await getOrStartRuntime(payload.projectPath)
        const msgs = await ocGetMessages(baseUrl, payload.sessionId)
        return flattenOcMessages(msgs, payload.projectPath)
      } catch {
        return []
      }
    },
  )

  // ── Chat ───────────────────────────────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AGENT_CHAT,
    async (event, payload: AgentChatPayload): Promise<AgentChatResult> => {
      const projectPath = (
        payload.context as { activeProject?: { path: string } } | undefined
      )?.activeProject?.path

      if (!projectPath) {
        throw new Error('No active project — open a project first')
      }

      const baseUrl = await getOrStartRuntime(projectPath)

      // Lazily create session if needed
      let sessionId = payload.sessionId
      if (!sessionId) {
        const oc = await ocCreateSession(baseUrl)
        sessionId = oc.id
      }

      // Extract last user message text
      const lastMsg = payload.messages[payload.messages.length - 1]
      const text = lastMsg?.content ?? ''
      if (!text.trim()) {
        throw new Error('Empty message')
      }

      // Inject persona on first turn per session (tracks sessionId in-process)
      const outgoingText = injectPersonaIfNeeded(sessionId, text)

      const result = await ocSendMessage(
        baseUrl,
        sessionId,
        outgoingText,
        (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcChannels.AGENT_STREAM_CHUNK, chunk)
          }
        },
        (toolEvent) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcChannels.AGENT_STREAM_TOOL_EVENT, toolEvent)
          }
        },
      )

      const assistantMessage: AgentMessage = {
        id: randomUUID(),
        sessionId,
        role: 'assistant',
        content: result.content,
        createdAt: new Date().toISOString(),
        metadata: result.model
          ? {
              model: result.model,
              usage: result.usage
                ? {
                    prompt_tokens: result.usage.input,
                    completion_tokens: result.usage.output,
                    total_tokens: result.usage.input + result.usage.output,
                  }
                : undefined,
            }
          : undefined,
      }

      return {
        message: assistantMessage,
        model: result.model,
        usage: result.usage
          ? {
              prompt_tokens: result.usage.input,
              completion_tokens: result.usage.output,
              total_tokens: result.usage.input + result.usage.output,
            }
          : undefined,
        sessionId,
      }
    },
  )

  // ── Stubs (artifacts / actions / harness not used with opencode backend) ──

  ipcMain.handle(
    IpcChannels.AGENT_GET_CONTEXT,
    async () => ({ summary: '' }),
  )

  ipcMain.handle(IpcChannels.AGENT_CANCEL, async () => ({ ok: true }))

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_ARTIFACTS,
    async () => [],
  )

  ipcMain.handle(
    IpcChannels.AGENT_SESSION_ACTIONS,
    async () => [],
  )

  ipcMain.handle(
    IpcChannels.AGENT_HARNESS_RUNS,
    async (_, payload: HarnessRunListPayload) => {
      return listHarnessRuns(payload.projectPath, payload.sessionId)
    },
  )

  ipcMain.handle(
    IpcChannels.AGENT_HARNESS_REPORT,
    async (_, payload: HarnessReportPayload) => {
      return getHarnessReport(payload.projectPath, payload.runId)
    },
  )
}
