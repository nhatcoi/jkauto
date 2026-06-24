import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import type {
  AgentChatPayload,
  AgentChatResult,
  AgentContextResult,
  AgentMessageMeta,
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
import {
  discoverAndPlanHarness,
  failHarnessRun,
  finalizeHarnessRun,
  getHarnessReport,
  recordToolEvidence,
  startHarnessRun,
} from './harness.service'
import {
  formatAnalysisCommandResult,
  getCodeAnalysisReport,
  startCodeAnalysis,
} from '../analysis/analysis.service'
import {
  getRelevantCodeContext,
} from '../autogen/autogen.service'

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

function detectIntent(text: string, mode: AgentSessionMode): 'conversational' | 'info' | 'code-change' | 'execution' {
  if (mode === 'directly') {
    return 'execution'
  }
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
  if (normalized.length === 0) return 'conversational'
  const greetings = [
    'hi',
    'hello',
    'hey',
    'chào',
    'xin chào',
    'hi agent',
    'hello agent',
    'how are you',
    'bạn khỏe không',
    'khỏe không',
    'yo',
    'halo',
    'bạn là ai',
    'who are you',
    'what is your name',
    'tên bạn là gì',
    'chào bạn',
    'chào ad',
    'chào bạn nhé',
    'hello ad',
    'greetings',
  ]
  const greetingRegex = /^(chào|xin chào|hi|hello|hey|yo|halo|greetings|chao)(\s+(cậu|ad|bạn|nha|nhé|ơi|bot|agent|mọi người))?$/
  if (greetingRegex.test(normalized) || greetings.includes(normalized)) return 'conversational'
  if (normalized.length <= 4 && !/^\d+$/.test(normalized)) {
    return 'conversational'
  }
  const executionKeywords = [
    'run test', 'chạy test', 'execute', 'thực thi', 'browser', 'trình duyệt', 
    'playwright', 'chromium', 'open page', 'mở trang', 'click', 'type', 'nhập'
  ]
  if (executionKeywords.some(kw => normalized.includes(kw))) {
    return 'execution'
  }
  const codeChangeKeywords = [
    'create test', 'tạo test', 'sinh test', 'generate test', 'write test', 'viết test',
    'save', 'lưu', 'update', 'cập nhật', 'edit', 'sửa', 'modify', 'change', 'thay đổi',
    'add step', 'thêm bước', 'apply'
  ]
  if (codeChangeKeywords.some(kw => normalized.includes(kw))) {
    return 'code-change'
  }
  const infoKeywords = [
    'project', 'dự án', 'features', 'tính năng', 'keywords', 'từ khóa', 'test case',
    'profiles', 'env', 'request', 'endpoint', 'api', 'rules', 'quy tắc', 'hướng dẫn',
    'list', 'danh sách', 'show', 'hiển thị'
  ]
  if (infoKeywords.some(kw => normalized.includes(kw))) {
    return 'info'
  }
  return 'conversational'
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

  const analysisMatch = userMessage?.role === 'user'
    ? userMessage.content.trim().match(/^\/analysis(?:\s+(status|refresh|routes|symbols))?\s*$/i)
    : null
  if (projectPath && sessionId && analysisMatch) {
    const command = analysisMatch[1]?.toLowerCase() ?? 'status'
    let report = getCodeAnalysisReport(projectPath)
    if (command === 'refresh' || (!report && !analysisMatch[1])) {
      report = await startCodeAnalysis(
        { projectPath },
        (progress) => {
          if (progress.phase !== 'done') {
            onChunk?.(`[analysis:${progress.phase}] ${progress.message}\n`)
          }
        },
      )
    }
    const content = formatAnalysisCommandResult(report, command)
    const assistantMessage = {
      id: randomUUID(),
      sessionId,
      role: 'assistant' as const,
      content,
      createdAt: new Date().toISOString(),
    }
    saveMessage(projectPath, assistantMessage)
    updateSession(projectPath, sessionId, {})
    return {
      message: assistantMessage,
      sessionId,
    }
  }

  // Build messages for LLM: DB history + new user message, trimmed
  const messagesForLlm = [
    ...allDbMessages,
    ...(userMessage && !allDbMessages.find((m) => m.id === userMessage.id)
      ? [userMessage]
      : []),
  ]

  const latestRequest =
    userMessage?.role === 'user' ? userMessage.content : 'Complete the requested test'
  const intent = detectIntent(latestRequest, sessionMode)

  // Project context
  const projectContext = projectPath && intent !== 'conversational'
    ? await buildProjectContext(projectPath)
    : ''

  let content: string
  let model: string | undefined
  let usage: AgentChatResult['usage']
  let metadata: AgentMessageMeta | undefined
  let harnessRunId: string | undefined

  if (projectPath) {
    const analysisReport = getCodeAnalysisReport(projectPath)
    const limit = intent === 'code-change' ? 10 : 20
    const relevantCode = (intent === 'code-change' || intent === 'execution') && analysisReport?.run.status === 'completed'
      ? getRelevantCodeContext(projectPath, latestRequest, limit)
      : []
    const projectSummary = analysisReport?.artifacts.find(
      (artifact) => artifact.type === 'project-summary',
    )
    const classification = analysisReport?.artifacts.find(
      (artifact) => artifact.type === 'project-classification',
    )
    const analysisContext = intent !== 'conversational' && analysisReport?.run.status === 'completed'
      ? [
          '## Persisted Auto Generate Test',
          `Index id: ${analysisReport.run.indexId ?? 'unknown'}`,
          projectSummary
            ? `Project summary: ${projectSummary.contentJson}`
            : '',
          classification
            ? `Project classification: ${classification.contentJson}`
            : '',
          relevantCode.length > 0
            ? `Relevant indexed nodes:\n${JSON.stringify(relevantCode, null, 2)}`
            : 'No indexed nodes matched this request.',
        ].filter(Boolean).join('\n')
      : ''
    let harnessContext = ''
    if (sessionMode === 'directly' && sessionId) {
      const harnessRun = startHarnessRun(projectPath, sessionId, latestRequest)
      harnessRunId = harnessRun.id
      const { codeGraphSummary, plan } = await discoverAndPlanHarness(
        projectPath,
        harnessRun.id,
        latestRequest,
      )
      harnessContext = [
        '## Directly Harness Context',
        `Harness run id: ${harnessRun.id}`,
        `Code Graph Snapshot:\n${JSON.stringify(codeGraphSummary, null, 2)}`,
        `Initial Test Plan:\n${JSON.stringify(plan, null, 2)}`,
      ].join('\n\n')
    }

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

    try {
      const result = await streamAgentChat(
        messagesForLlm,
        context.summary,
        [projectContext, analysisContext, harnessContext].filter(Boolean).join('\n\n'),
        session?.summary,
        sessionMode,
        manager,
        (intent === 'code-change' || intent === 'execution') ? skills : [],
        agentConfig,
        onChunk,
        (event) => {
          onToolEvent?.(event)
          if (sessionMode === 'directly' && sessionId && event.type === 'result') {
            recordToolEvidence(
              projectPath,
              sessionId,
              event.name,
              event.args,
              event.result,
            )
          }
        },
        intent,
      )
      content = result.content
      model = result.model
      usage = result.usage
      metadata = result.metadata

      if (harnessRunId) {
        const report = finalizeHarnessRun(projectPath, harnessRunId)
        if (report.run.status !== 'passed') {
          throw new Error(report.run.error ?? 'Directly harness did not pass')
        }
      }
    } catch (error) {
      if (harnessRunId) {
        const message = error instanceof Error ? error.message : String(error)
        const current = getHarnessReport(projectPath, harnessRunId)
        if (current.run.status === 'running') {
          failHarnessRun(projectPath, harnessRunId, message)
        }
      }
      throw error
    }

    // Save assistant message
    if (projectPath && sessionId) {
      const assistantMsg = {
        id: randomUUID(),
        sessionId,
        role: 'assistant' as const,
        content,
        createdAt: new Date().toISOString(),
        metadata,
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
      (intent === 'code-change' || intent === 'execution') ? skills : [],
      agentConfig,
      onChunk,
      onToolEvent,
      intent,
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
    harnessRunId,
  }
}
