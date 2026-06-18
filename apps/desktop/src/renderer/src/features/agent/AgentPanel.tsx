import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { AlertCircle, Bot, Loader2, Plus, Trash2 } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { AgentContextSnapshot, AgentMessage } from './types'
import { sendAgentMessage } from './api'
import { useAgentStore } from './store'
import { useSessionStore } from './session.store'
import { SessionHeader } from './SessionHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ThinkingSection } from './ThinkingSection'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { invoke } from '@/lib/utils'
import {
  normalizeTestCase,
  compactTestCase,
} from '@/features/test-cases/hooks/useTestCaseFile'
import type { TestCase } from '@/features/test-cases/types'
import type { AgentSessionMode } from '@jkauto/core'

function createMessage(role: AgentMessage['role'], content: string, sessionId?: string): AgentMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    sessionId,
    createdAt: new Date().toISOString(),
  }
}

function isTestCasePath(p: string | null | undefined): boolean {
  if (!p) return false
  return p.endsWith('.test.json') || p.endsWith('.test.yaml') || p.endsWith('.test.yml')
}

export function AgentPanel() {
  const [draft, setDraft] = useState('')
  const [pendingMode, setPendingMode] = useState<AgentSessionMode>('ask')
  const endRef = useRef<HTMLDivElement>(null)
  const prevMsgCountRef = useRef(0)
  const isSubmittingRef = useRef(false)

  const {
    messages,
    sendState,
    error,
    streamingContent,
    pendingToolCalls,
    lastModel,
    lastUsage,
    addMessage,
    setSendState,
    setError,
    setMetadata,
    startStreaming,
    appendStreamChunk,
    finalizeStream,
    addPendingToolCall,
    updatePendingToolResult,
    clear,
    setMessages,
  } = useAgentStore()

  const { activeProject, activeTabPath, openTabs, triggerTabReload } = useProjectStore()
  const run = useRunStore()
  const { settings, update: updateSettings } = useAppSettingsStore()
  const editMode = settings?.agent.editMode ?? 'ask'

  const {
    sessions,
    activeSessionId,
    artifacts,
    loadSessions,
    createSession,
    selectSession,
    updateSession,
    deleteSession,
    refreshArtifacts,
  } = useSessionStore()

  const projectPath = activeProject?.path ?? null

  // Load sessions when project opens
  useEffect(() => {
    if (!projectPath) {
      useSessionStore.getState().reset()
      return
    }
    loadSessions(projectPath).then(() => {
      const store = useSessionStore.getState()
      if (store.sessions.length > 0 && !store.activeSessionId) {
        useSessionStore.setState({ activeSessionId: store.sessions[0].id })
      }
    })
  }, [projectPath])

  // Load messages for active session
  useEffect(() => {
    if (!projectPath || !activeSessionId) return
    invoke<AgentMessage[]>(IpcChannels.AGENT_SESSION_MESSAGES, {
      projectPath,
      sessionId: activeSessionId,
    })
      .then((msgs) => setMessages(msgs))
      .catch(() => {})
  }, [activeSessionId, projectPath])

  function toggleEditMode() {
    const next =
      editMode === 'ask' ? 'auto' : editMode === 'auto' ? 'auto-with-rollback' : 'ask'
    if (settings) updateSettings({ agent: { ...settings.agent, editMode: next } })
  }

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.path === activeTabPath) ?? null,
    [activeTabPath, openTabs],
  )

  const applyTargetPath = isTestCasePath(activeTabPath) ? activeTabPath : null

  const context = useMemo<AgentContextSnapshot>(
    () => ({
      activeProject: activeProject
        ? {
            path: activeProject.path,
            name: activeProject.project.name,
            type: activeProject.project.type,
            description: activeProject.project.description,
            activeProfile: activeProject.activeProfile,
          }
        : undefined,
      activeTab: activeTab
        ? { path: activeTab.path, title: activeTab.title, isDirty: activeTab.isDirty }
        : undefined,
      openTabs: openTabs.map((tab) => ({
        path: tab.path,
        title: tab.title,
        isDirty: tab.isDirty,
      })),
      run: {
        status: run.status,
        runId: run.runId,
        isDebugMode: run.isDebugMode,
        isDebugPaused: run.isDebugPaused,
        latestLogs: run.logs.slice(-20).map((log) => ({
          time: log.time,
          level: log.level,
          message: log.message,
          stepIndex: log.stepIndex,
        })),
        latestEvents: run.events.slice(-20).map((event) => ({
          time: event.time,
          message: event.message,
        })),
        stepMessages: run.stepMessages,
      },
    }),
    [activeProject, activeTab, openTabs, run],
  )

  // Listen to stream chunks from main process
  useEffect(() => {
    const off = window.api.on(IpcChannels.AGENT_STREAM_CHUNK, (chunk: unknown) => {
      if (typeof chunk === 'string' && chunk.length > 0) {
        appendStreamChunk(chunk)
      }
    })
    return off
  }, [appendStreamChunk])

  // Listen to tool call events from main process
  useEffect(() => {
    const off = window.api.on(IpcChannels.AGENT_STREAM_TOOL_EVENT, (event: unknown) => {
      const e = event as { type: 'call' | 'result'; name: string; args?: Record<string, unknown>; result?: string }
      if (e.type === 'call') {
        addPendingToolCall(e.name, e.args)
      } else if (e.type === 'result') {
        updatePendingToolResult(e.name, e.result ?? '(empty)')
      }
    })
    return off
  }, [addPendingToolCall, updatePendingToolResult])

  useEffect(() => {
    if (!endRef.current) return
    const isNewMessage = messages.length > prevMsgCountRef.current
    prevMsgCountRef.current = messages.length
    endRef.current.scrollIntoView({ behavior: isNewMessage || sendState === 'sending' ? 'smooth' : 'instant' })
  }, [messages, sendState, streamingContent])

  async function handleSubmit() {
    const content = draft.trim()
    if (!content || isSubmittingRef.current) return
    isSubmittingRef.current = true

    setDraft('')
    setError(null)
    startStreaming()
    setSendState('sending')

    try {
      // Lazy-create session on first message
      let sessionId = activeSessionId
      if (!sessionId && projectPath) {
        const title = content.length > 60 ? content.slice(0, 57) + '…' : content
        const sess = await createSession(projectPath, pendingMode, title)
        sessionId = sess.id
      }

      const userMessage = createMessage('user', content, sessionId ?? undefined)
      const nextMessages = [...messages, userMessage]
      addMessage(userMessage)

      const result = await sendAgentMessage({
        sessionId: sessionId ?? undefined,
        messages: nextMessages,
        context,
      })
      finalizeStream()
      addMessage(result.message)
      setMetadata(result.model, result.usage)
      setSendState('idle')
      if (projectPath && sessionId) {
        refreshArtifacts(projectPath, sessionId)
      }
    } catch (err) {
      finalizeStream()
      setSendState('idle')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleApplySteps = useCallback(
    async (steps: unknown[]) => {
      if (!applyTargetPath) throw new Error('No test case file open')

      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, applyTargetPath)
      const isYaml =
        applyTargetPath.endsWith('.yaml') || applyTargetPath.endsWith('.yml')
      const parsed = (isYaml ? yamlParse(raw) : JSON.parse(raw)) as Partial<TestCase>
      const tc = normalizeTestCase(parsed)

      const normalizedSteps = (steps as Array<Record<string, unknown>>).map((s) => ({
        id: crypto.randomUUID(),
        name: String(s.name ?? ''),
        keyword: String(s.keyword ?? ''),
        description: String(s.description ?? ''),
        objectRef: String(s.objectRef ?? ''),
        input: String(s.input ?? ''),
        expected: String(s.expected ?? ''),
        enabled: s.enabled !== false,
        continueOnFailure: s.continueOnFailure === true,
        timeout: typeof s.timeout === 'number' ? s.timeout : null,
      }))

      const updated: TestCase = {
        ...tc,
        steps: normalizedSteps,
        updatedAt: new Date().toISOString(),
      }

      const serialized = yamlStringify(compactTestCase(updated))
      await invoke(IpcChannels.FS_WRITE_FILE, applyTargetPath, serialized)
      triggerTabReload(applyTargetPath)
    },
    [applyTargetPath, triggerTabReload],
  )

  async function handleSelectSession(id: string) {
    if (!projectPath) return
    clear()
    await selectSession(projectPath, id)
  }

  function handleCreateSession(mode: AgentSessionMode) {
    clear()
    setPendingMode(mode)
    useSessionStore.setState({ activeSessionId: null })
  }

  async function handleDeleteSession(id: string) {
    if (!projectPath) return
    if (id === activeSessionId) clear()
    await deleteSession(projectPath, id)
  }

  function handleRenameSession(id: string, title: string) {
    if (!projectPath) return
    updateSession(projectPath, id, { title })
  }

  function handleChangeMode(id: string, mode: AgentSessionMode) {
    if (!projectPath) return
    updateSession(projectPath, id, { mode })
  }

  const isSending = sendState === 'sending'
  const editModeLabel =
    editMode === 'ask' ? 'ask' : editMode === 'auto-with-rollback' ? 'rollback' : 'auto'
  const editModeColor =
    editMode === 'auto-with-rollback'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
      : editMode === 'auto'
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
        : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:bg-secondary/80'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-panel/60 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground mb-0.5">JKAuto AI</div>
          {projectPath ? (
            <SessionHeader
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={handleCreateSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
              onChangeMode={handleChangeMode}
            />
          ) : (
            <div className="text-[10px] text-muted-foreground">
              {activeTab ? `Context: ${activeTab.title}` : 'Context: app workspace'}
              {lastModel ? ` · ${lastModel}` : ''}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {projectPath && (
            <button
              type="button"
              onClick={() => handleCreateSession('ask')}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="New session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleEditMode}
            title={`File edit mode: ${editMode} (click to cycle)`}
            className={[
              'h-5 px-1.5 rounded text-[10px] font-medium border transition-colors',
              editModeColor,
            ].join(' ')}
          >
            {editModeLabel}
          </button>
          <button
            type="button"
            onClick={clear}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Clear chat view"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground/60 text-center mt-8">
            {projectPath
              ? 'Ask about the current project, test case, run failure, or selector.'
              : 'Open a project to enable full agent context.'}
          </div>
        ) : (
          <MessageList
            messages={messages}
            applyTargetPath={applyTargetPath}
            onApplySteps={handleApplySteps}
          />

        )}

        {isSending && streamingContent !== null && (
          <div className="mt-3 flex gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border bg-secondary text-foreground/80 border-border">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[10px] text-muted-foreground font-medium">JKAuto AI</div>
              {pendingToolCalls.length > 0 && (
                <ThinkingSection steps={pendingToolCalls} isStreaming={!streamingContent} />
              )}
              {streamingContent ? (
                <div className="rounded-md px-3 py-2 text-xs leading-relaxed bg-secondary/50 text-foreground/85 border border-border/60 whitespace-pre-wrap mt-1.5">
                  {streamingContent}
                  <span className="animate-pulse ml-0.5">▊</span>
                </div>
              ) : pendingToolCalls.length === 0 && (
                <div className="rounded-md px-3 py-2 text-xs leading-relaxed bg-secondary/50 text-foreground/85 border border-border/60">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Thinking…
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 whitespace-pre-wrap">{error}</div>
          </div>
        )}

        {lastUsage && (
          <div className="mt-3 text-[10px] text-muted-foreground/60">
            Tokens: {lastUsage.total_tokens} total · {lastUsage.prompt_tokens} prompt ·{' '}
            {lastUsage.completion_tokens} completion
          </div>
        )}
        <div ref={endRef} />
      </div>

      <ChatInput
        value={draft}
        disabled={isSending}
        onChange={setDraft}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
