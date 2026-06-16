import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { AgentContextSnapshot, AgentMessage } from './types'
import { sendAgentMessage } from './api'
import { useAgentStore } from './store'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useProjectStore } from '@/store/project.store'
import { useRunStore } from '@/store/run.store'
import { invoke } from '@/lib/utils'
import {
  normalizeTestCase,
  compactTestCase,
} from '@/features/test-cases/hooks/useTestCaseFile'
import type { TestCase } from '@/features/test-cases/types'

function createMessage(role: AgentMessage['role'], content: string): AgentMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function isTestCasePath(p: string | null | undefined): boolean {
  if (!p) return false
  return p.endsWith('.test.json') || p.endsWith('.test.yaml') || p.endsWith('.test.yml')
}

export function AgentPanel() {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    sendState,
    error,
    lastModel,
    lastUsage,
    addMessage,
    setSendState,
    setError,
    setMetadata,
    clear,
  } = useAgentStore()

  const { activeProject, activeTabPath, openTabs, triggerTabReload } = useProjectStore()
  const run = useRunStore()

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.path === activeTabPath) ?? null,
    [activeTabPath, openTabs],
  )

  const applyTargetPath = isTestCasePath(activeTabPath) ? activeTabPath : null

  const context = useMemo<AgentContextSnapshot>(() => ({
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
      ? {
          path: activeTab.path,
          title: activeTab.title,
          isDirty: activeTab.isDirty,
        }
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
  }), [activeProject, activeTab, openTabs, run])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendState])

  async function handleSubmit() {
    const content = draft.trim()
    if (!content || sendState === 'sending') return

    const userMessage = createMessage('user', content)
    const nextMessages = [...messages, userMessage]
    setDraft('')
    setError(null)
    setSendState('sending')
    addMessage(userMessage)

    try {
      const result = await sendAgentMessage({
        messages: nextMessages,
        context,
      })
      addMessage(result.message)
      setMetadata(result.model, result.usage)
      setSendState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleApplySteps = useCallback(async (steps: unknown[]) => {
    if (!applyTargetPath) throw new Error('No test case file open')

    const raw = await invoke<string>(IpcChannels.FS_READ_FILE, applyTargetPath)
    const isYaml = applyTargetPath.endsWith('.yaml') || applyTargetPath.endsWith('.yml')
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
  }, [applyTargetPath, triggerTabReload])

  const isSending = sendState === 'sending'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-panel/60 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">JKAuto AI</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {activeTab ? `Context: ${activeTab.title}` : 'Context: app workspace'}
            {lastModel ? ` · ${lastModel}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={clear}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground/60 text-center mt-8">
            Ask about the current project, test case, run failure, or selector.
          </div>
        ) : (
          <MessageList
            messages={messages}
            applyTargetPath={applyTargetPath}
            onApplySteps={handleApplySteps}
          />
        )}

        {isSending && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking with current app context...
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
