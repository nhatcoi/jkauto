import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextResult,
  AgentSession,
  AgentSessionMode,
} from '@jkauto/core'
import { buildAgentContext } from './context-builder'
import { streamAgentChat } from './llm-client'
import type { AgentConfig, AgentToolEvent } from './llm-client'
import { McpManager } from './mcp-manager'
import type { McpServerConfig, McpEditMode } from './mcp-manager'
import { buildProjectContext } from './project-context'
import {
  listSessions,
  createSession,
  getSession,
  updateSession,
  getSessionMessages,
  saveMessage,
  saveArtifact,
} from './session.service'

const APPLY_STEPS_REGEX = /```apply-steps\n([\s\S]*?)\n```/g

interface ServiceAgentConfig extends Partial<AgentConfig> {
  mcpServers?: McpServerConfig[]
  skillPaths?: string[]
  editMode?: McpEditMode
}

// Cache McpManager per projectPath — avoid 60s reconnect on every chat message
const managerCache = new Map<string, McpManager>()

export async function disposeProjectManager(
  projectPath: string,
): Promise<void> {
  const manager = managerCache.get(projectPath)
  if (manager) {
    managerCache.delete(projectPath)
    await manager.dispose()
  }
}

async function loadSkills(skillPaths: string[]): Promise<string[]> {
  const skills: string[] = []
  for (const p of skillPaths) {
    try {
      const content = await fs.readFile(p, 'utf-8')
      skills.push(content)
    } catch {
      // skip missing
    }
  }
  return skills
}

function getProjectPath(payload: AgentChatPayload): string | undefined {
  return (payload.context as { activeProject?: { path: string } } | undefined)
    ?.activeProject?.path
}

function extractApplyStepsArtifacts(
  content: string,
  sessionId: string,
  targetPath?: string,
): Array<{
  id: string
  sessionId: string
  type: 'apply-steps'
  contentJson: string
  targetPath?: string
  createdAt: string
}> {
  const artifacts = []
  const regex = new RegExp(APPLY_STEPS_REGEX.source, 'g')
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      artifacts.push({
        id: randomUUID(),
        sessionId,
        type: 'apply-steps' as const,
        contentJson: JSON.stringify(parsed),
        targetPath,
        createdAt: new Date().toISOString(),
      })
    } catch {
      // invalid JSON in block — skip
    }
  }
  return artifacts
}

export async function getAgentContext(
  payload: AgentChatPayload,
): Promise<AgentContextResult> {
  return buildAgentContext(payload.context)
}

export async function listAgentSessions(
  projectPath: string,
): Promise<AgentSession[]> {
  return listSessions(projectPath)
}

export async function createAgentSession(
  projectPath: string,
  mode: AgentSessionMode = 'normal',
  title?: string,
): Promise<AgentSession> {
  return createSession(projectPath, mode, title)
}

export async function updateAgentSession(
  projectPath: string,
  id: string,
  patch: Partial<Pick<AgentSession, 'title' | 'mode' | 'status' | 'summary'>>,
): Promise<void> {
  updateSession(projectPath, id, patch)
}

export async function chatWithAgent(
  payload: AgentChatPayload,
  agentConfig?: ServiceAgentConfig,
  onChunk?: (text: string) => void,
  onToolEvent?: (event: AgentToolEvent) => void,
): Promise<AgentChatResult> {
  const context = await getAgentContext(payload)
  const projectPath = getProjectPath(payload)
  const skills = await loadSkills(agentConfig?.skillPaths ?? [])
  const editMode = agentConfig?.editMode ?? 'ask'

  // Resolve session — frontend always provides sessionId (created lazily on first message)
  const sessionId = payload.sessionId
  const session =
    projectPath && sessionId ? getSession(projectPath, sessionId) : null
  const sessionMode: AgentSessionMode = session?.mode ?? 'normal'

  // Load historical messages from DB for context (use as source of truth)
  const allDbMessages =
    projectPath && sessionId ? getSessionMessages(projectPath, sessionId) : []

  // Merge: use DB history + latest user message from payload (last in payload.messages)
  const latestUserMsg = payload.messages[payload.messages.length - 1]
  const userMessage = latestUserMsg
    ? { ...latestUserMsg, sessionId: sessionId ?? undefined }
    : null

  // Save user message to DB
  if (projectPath && sessionId && userMessage && userMessage.role === 'user') {
    saveMessage(projectPath, userMessage)
  }

  // Build messages for LLM: DB history + new user message, trimmed
  const messagesForLlm = [
    ...allDbMessages,
    ...(userMessage && !allDbMessages.find((m) => m.id === userMessage.id)
      ? [userMessage]
      : []),
  ]

  // Project context
  const projectContext = projectPath
    ? await buildProjectContext(projectPath)
    : ''

  let content: string
  let model: string | undefined
  let usage: AgentChatResult['usage']

  if (projectPath) {
    let manager = managerCache.get(projectPath)
    if (!manager) {
      manager = new McpManager()
      await manager.setup(
        projectPath,
        agentConfig?.mcpServers ?? [],
        editMode,
        sessionId ?? '',
      )
      managerCache.set(projectPath, manager)
    } else {
      manager.configure(editMode, sessionId ?? '')
    }

    const result = await streamAgentChat(
      messagesForLlm,
      context.summary,
      projectContext,
      session?.summary,
      sessionMode,
      manager,
      skills,
      agentConfig,
      onChunk,
      onToolEvent,
    )
    content = result.content
    model = result.model
    usage = result.usage

    // Save assistant message
    if (projectPath && sessionId) {
      const assistantMsg = {
        id: randomUUID(),
        sessionId,
        role: 'assistant' as const,
        content,
        createdAt: new Date().toISOString(),
        metadata: result.metadata,
      }
      saveMessage(projectPath, assistantMsg)

      // Extract + save artifacts
      const activeTabPath = payload.context?.activeTab?.path
      const artifacts = extractApplyStepsArtifacts(
        content,
        sessionId,
        activeTabPath,
      )
      for (const artifact of artifacts) {
        saveArtifact(projectPath, artifact)
      }

      // Update session timestamp
      updateSession(projectPath, sessionId, {})
    }
  } else {
    const result = await streamAgentChat(
      messagesForLlm,
      context.summary,
      '',
      session?.summary,
      sessionMode,
      null,
      skills,
      agentConfig,
      onChunk,
      onToolEvent,
    )
    content = result.content
    model = result.model
    usage = result.usage
  }

  return {
    message: {
      id: randomUUID(),
      sessionId: sessionId ?? undefined,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    },
    model,
    usage,
    sessionId,
  }
}
