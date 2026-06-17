import { useRef, useEffect, useState } from 'react'
import { AlertCircle, Bot, ChevronDown, ChevronRight, Loader2, Play, Trash2 } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import type { AgentChatResult } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { useAgentTestStore } from './store'
import type { AgentMessage } from '../agent/types'
import { AgentMessageList } from './AgentMessageList'
import { ChatInput } from '../agent/ChatInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface AgentContext {
  systemMd: string | null
  agentsMd: string | null
  skills: Array<{ name: string; content: string }>
  mcpConfig: string | null
  projectName: string
  projectType: string
}

async function loadAgentContext(projectPath: string, projectName: string, projectType: string): Promise<AgentContext> {
  const read = (p: string) => invoke<string>(IpcChannels.FS_READ_FILE, p).catch(() => null)
  const base = `${projectPath}/agent-test`

  const [systemMd, agentsMd, mcpConfig, browserSkill, playwrightSkill] = await Promise.all([
    read(`${base}/.agents/system.md`),
    read(`${base}/.agents/agents.md`),
    read(`${base}/.mcp.json`),
    read(`${base}/.agents/skills/browser.md`),
    read(`${base}/.agents/skills/playwright.md`),
  ])

  const skills: Array<{ name: string; content: string }> = []
  if (browserSkill) skills.push({ name: 'Browser Skill', content: browserSkill })
  if (playwrightSkill) skills.push({ name: 'Playwright Skill', content: playwrightSkill })

  return { systemMd, agentsMd, skills, mcpConfig, projectName, projectType }
}

function buildRunPrompt(
  input: {
    url: string
    feature: string
    testData: string
    accountInfo: string
    additionalInstructions: string
  },
  ctx: AgentContext,
): string {
  const sections: string[] = []

  // System / project context
  if (ctx.systemMd) {
    sections.push(`# System Instructions\n${ctx.systemMd}`)
  }
  if (ctx.agentsMd) {
    sections.push(`# Agent Configuration\n${ctx.agentsMd}`)
  }

  // MCP config
  if (ctx.mcpConfig) {
    sections.push(`# MCP Servers (Available Tools)\n\`\`\`json\n${ctx.mcpConfig}\n\`\`\`\nPlaywright MCP is active. Use it to control the browser.`)
  }

  // Skills
  for (const skill of ctx.skills) {
    sections.push(`# ${skill.name}\n${skill.content}`)
  }

  // Project info
  sections.push(`# Project\nName: ${ctx.projectName}\nType: ${ctx.projectType}`)

  // Test task
  const taskParts = [
    `# Test Task`,
    `Feature: ${input.feature}`,
    `URL: ${input.url}`,
  ]
  if (input.testData.trim()) taskParts.push(`\nTest data:\n${input.testData}`)
  if (input.accountInfo.trim()) taskParts.push(`\nAccount / Environment:\n${input.accountInfo}`)
  if (input.additionalInstructions.trim()) {
    taskParts.push(`\nAdditional instructions:\n${input.additionalInstructions}`)
  }
  sections.push(taskParts.join('\n'))

  sections.push(
    '# Instructions\nApply the skills and MCP tools above. Open the browser, explore the app, trace user actions, detect bugs, then generate complete JKAuto test cases with steps, assertions, test data, and object repository entries.',
  )

  return sections.join('\n\n---\n\n')
}

function createMsg(role: AgentMessage['role'], content: string): AgentMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

export function TestRunnerTab() {
  const [inputOpen, setInputOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const { activeProject } = useProjectStore()
  const {
    runInput,
    setRunInput,
    messages,
    addMessage,
    clearMessages,
    sendState,
    setSendState,
    error,
    setError,
  } = useAgentTestStore()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendState])

  async function sendMessage(content: string) {
    if (!content.trim() || sendState === 'sending') return
    const userMsg = createMsg('user', content)
    const nextMessages = [...messages, userMsg]
    addMessage(userMsg)
    setError(null)
    setSendState('sending')

    try {
      const result = await invoke<AgentChatResult>(IpcChannels.AGENT_CHAT, {
        messages: nextMessages,
        context: {
          useMcp: true,
          ...(activeProject
            ? {
                activeProject: {
                  path: activeProject.path,
                  name: activeProject.project.name,
                  type: activeProject.project.type,
                  activeProfile: activeProject.activeProfile,
                },
              }
            : {}),
        },
      })
      addMessage(result.message)
      setSendState('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleRun() {
    if (!runInput.url.trim() || !runInput.feature.trim() || !activeProject) return
    setInputOpen(false)
    const ctx = await loadAgentContext(
      activeProject.path,
      activeProject.project.name,
      activeProject.project.type,
    )
    await sendMessage(buildRunPrompt(runInput, ctx))
  }

  function handleChatSubmit() {
    const content = draft.trim()
    if (!content) return
    setDraft('')
    sendMessage(content)
  }

  const isSending = sendState === 'sending'
  const canRun = runInput.url.trim().length > 0 && runInput.feature.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Collapsible test input */}
      <div className="shrink-0 border-b border-border">
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary/30 transition-colors"
          onClick={() => setInputOpen((v) => !v)}
        >
          {inputOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground">Test Input</span>
          {!inputOpen && runInput.url && (
            <span className="text-[10px] text-muted-foreground/50 truncate ml-1 min-w-0">
              {runInput.url}
            </span>
          )}
        </button>

        {inputOpen && (
          <div className="flex flex-col gap-2.5 px-3 pb-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">URL *</Label>
              <Input
                value={runInput.url}
                onChange={(e) => setRunInput({ url: e.target.value })}
                placeholder="https://example.com"
                className="h-8 text-xs border-border"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">Feature to test *</Label>
              <Textarea
                value={runInput.feature}
                onChange={(e) => setRunInput({ feature: e.target.value })}
                placeholder="e.g. Login with email and password"
                rows={2}
                className="text-xs resize-none border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Test data</Label>
                <Textarea
                  value={runInput.testData}
                  onChange={(e) => setRunInput({ testData: e.target.value })}
                  placeholder={`email: user@test.com\npassword: secret`}
                  rows={2}
                  className="text-xs resize-none border-border"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Account / Env</Label>
                <Textarea
                  value={runInput.accountInfo}
                  onChange={(e) => setRunInput({ accountInfo: e.target.value })}
                  placeholder={`env: staging\nrole: admin`}
                  rows={2}
                  className="text-xs resize-none border-border"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">
                Additional instructions
              </Label>
              <Textarea
                value={runInput.additionalInstructions}
                onChange={(e) => setRunInput({ additionalInstructions: e.target.value })}
                placeholder="Focus on error states. Check validation messages."
                rows={2}
                className="text-xs resize-none border-border"
              />
            </div>

            <Button
              size="sm"
              onClick={handleRun}
              disabled={!canRun || isSending}
              className="self-start text-xs"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isSending ? 'Running…' : 'Run Agent Test'}
            </Button>
          </div>
        )}
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Bot className="w-8 h-8 text-muted-foreground/25" />
            <div className="text-xs text-muted-foreground/50">
              Fill in the test input above and click{' '}
              <span className="font-medium text-muted-foreground/70">Run Agent Test</span>,<br />
              or chat directly with the agent.
            </div>
          </div>
        ) : (
          <AgentMessageList messages={messages} projectPath={activeProject?.path} />
        )}

        {isSending && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Agent is exploring the app…
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 whitespace-pre-wrap">{error}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chat bar */}
      <div className="shrink-0 border-t border-border">
        <div
          className={cn(
            'flex items-center justify-between px-3 py-1',
            messages.length === 0 && 'hidden',
          )}
        >
          <span className="text-[10px] text-muted-foreground/40">Continue chat with agent</span>
          <button
            type="button"
            onClick={clearMessages}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <ChatInput
          value={draft}
          disabled={isSending}
          onChange={setDraft}
          onSubmit={handleChatSubmit}
        />
      </div>
    </div>
  )
}
