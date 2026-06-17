import { useState } from 'react'
import { CheckCircle2, Download, Loader2 } from 'lucide-react'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { useAgentTestStore, DEFAULT_BROWSER_SKILL, DEFAULT_PLAYWRIGHT_SKILL } from './store'
import type { ModelProvider } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const MODEL_OPTIONS: { provider: ModelProvider; models: string[] }[] = [
  {
    provider: 'claude',
    models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  { provider: 'codex', models: ['gpt-4o', 'gpt-4o-mini'] },
  { provider: 'gemini', models: ['gemini-1.5-pro', 'gemini-2.0-flash'] },
  { provider: 'local', models: ['ollama/qwen2.5', 'ollama/llama3.3'] },
]

const MCP_PLAYWRIGHT_CONFIG = JSON.stringify(
  {
    mcpServers: {
      playwright: {
        command: 'npx',
        args: ['@playwright/mcp@latest'],
        env: {},
      },
    },
  },
  null,
  2,
)

type SaveState = 'idle' | 'saving' | 'installing' | 'installing-browser' | 'saved' | 'error'

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-md border transition-colors',
        checked
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-secondary/20 hover:bg-secondary/40',
      )}
      onClick={() => onChange(!checked)}
    >
      <div
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
          checked ? 'bg-primary border-primary' : 'border-muted-foreground/40',
        )}
      >
        {checked && (
          <svg
            className="w-2.5 h-2.5 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{description}</div>
      </div>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-0.5">
        {title}
      </div>
      {children}
    </div>
  )
}

export function AgentSetupTab() {
  const { activeProject } = useProjectStore()
  const { config, setConfig } = useAgentTestStore()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')

  const projectPath = activeProject?.path

  // agentTestPath = <project>/agent-test — all agent files live here
  const agentTestPath = projectPath ? `${projectPath}/agent-test` : null

  async function handleSave() {
    if (!projectPath || !agentTestPath) return
    setSaveState('saving')
    setSaveError('')

    try {
      await invoke(IpcChannels.FS_CREATE_DIR, `${agentTestPath}/.agents/skills`)
      await invoke(IpcChannels.FS_CREATE_DIR, `${agentTestPath}/traces`)
      await invoke(IpcChannels.FS_CREATE_DIR, `${agentTestPath}/generated-cases`)
      await invoke(IpcChannels.FS_CREATE_DIR, `${agentTestPath}/reports`)

      if (config.mcpPlaywright) {
        await invoke(
          IpcChannels.FS_WRITE_FILE,
          `${agentTestPath}/.mcp.json`,
          MCP_PLAYWRIGHT_CONFIG,
        )
      }

      await invoke(
        IpcChannels.FS_WRITE_FILE,
        `${agentTestPath}/.agents/system.md`,
        config.systemMd,
      )
      await invoke(
        IpcChannels.FS_WRITE_FILE,
        `${agentTestPath}/.agents/agents.md`,
        config.agentsMd,
      )

      if (config.skills.browser) {
        await invoke(
          IpcChannels.FS_WRITE_FILE,
          `${agentTestPath}/.agents/skills/browser.md`,
          DEFAULT_BROWSER_SKILL,
        )
      }
      if (config.skills.playwright) {
        await invoke(
          IpcChannels.FS_WRITE_FILE,
          `${agentTestPath}/.agents/skills/playwright.md`,
          DEFAULT_PLAYWRIGHT_SKILL,
        )
      }

      // Install playwright-skill from GitHub into agent-test/.claude/skills/
      if (config.skills.playwright) {
        setSaveState('installing')
        await invoke(IpcChannels.AGENT_INSTALL_SKILL, agentTestPath).catch((e) => {
          console.warn('Playwright skill install failed:', e)
        })
      }

      // Install Playwright Chromium browser (required by MCP)
      setSaveState('installing-browser')
      await invoke(IpcChannels.AGENT_INSTALL_BROWSERS).catch((e) => {
        console.warn('Playwright browser install failed:', e)
      })

      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      setSaveState('error')
    }
  }

  const modelOptions =
    MODEL_OPTIONS.find((o) => o.provider === config.modelProvider)?.models ?? []

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-4">
        <Section title="Model Provider">
          <Select
            value={config.modelProvider}
            onValueChange={(v) => {
              const provider = v as ModelProvider
              const firstModel =
                MODEL_OPTIONS.find((o) => o.provider === provider)?.models[0] ?? ''
              setConfig({ modelProvider: provider, modelId: firstModel })
            }}
          >
            <SelectTrigger className="h-8 text-xs border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude" className="text-xs">
                Claude (Anthropic)
              </SelectItem>
              <SelectItem value="codex" className="text-xs">
                Codex (OpenAI)
              </SelectItem>
              <SelectItem value="gemini" className="text-xs">
                Gemini (Google)
              </SelectItem>
              <SelectItem value="local" className="text-xs">
                Local / Custom
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">Model ID</Label>
            {config.modelProvider === 'local' ? (
              <Input
                value={config.modelId}
                onChange={(e) => setConfig({ modelId: e.target.value })}
                placeholder="e.g. ollama/qwen2.5"
                className="h-8 text-xs border-border"
              />
            ) : (
              <Select
                value={config.modelId}
                onValueChange={(v) => setConfig({ modelId: v })}
              >
                <SelectTrigger className="h-8 text-xs border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </Section>

        <Section title="MCP Server">
          <ToggleRow
            label="Playwright MCP"
            description="Generates .mcp.json · enables browser automation via npx @playwright/mcp"
            checked={config.mcpPlaywright}
            onChange={(v) => setConfig({ mcpPlaywright: v })}
          />
          {config.mcpPlaywright && (
            <pre className="text-[10px] font-mono text-muted-foreground/60 bg-secondary/30 border border-border/40 rounded-md p-2.5 overflow-x-auto leading-relaxed">
              {MCP_PLAYWRIGHT_CONFIG}
            </pre>
          )}
        </Section>

        <Section title="Skills">
          <ToggleRow
            label="Browser Skill"
            description=".agents/skills/browser.md · click, fill, screenshot, assert"
            checked={config.skills.browser}
            onChange={(v) => setConfig({ skills: { ...config.skills, browser: v } })}
          />
          <ToggleRow
            label="Playwright Skill"
            description=".agents/skills/playwright.md · JKAuto step generation rules"
            checked={config.skills.playwright}
            onChange={(v) => setConfig({ skills: { ...config.skills, playwright: v } })}
          />
        </Section>

        <Section title="System Instructions">
          <div className="text-[10px] text-muted-foreground/50">
            Saved to .agents/system.md
          </div>
          <Textarea
            value={config.systemMd}
            onChange={(e) => setConfig({ systemMd: e.target.value })}
            rows={6}
            className="text-xs font-mono resize-y border-border"
          />
        </Section>

        <Section title="Agents Instructions">
          <div className="text-[10px] text-muted-foreground/50">
            Saved to .agents/agents.md
          </div>
          <Textarea
            value={config.agentsMd}
            onChange={(e) => setConfig({ agentsMd: e.target.value })}
            rows={4}
            className="text-xs font-mono resize-y border-border"
          />
        </Section>

        <div className="flex items-center gap-3 pb-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              saveState === 'saving' ||
              saveState === 'installing' ||
              saveState === 'installing-browser' ||
              !projectPath
            }
            className="text-xs"
          >
            {(saveState === 'saving' || saveState === 'installing' || saveState === 'installing-browser') && (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            )}
            {saveState === 'saving' ? 'Saving…'
              : saveState === 'installing' ? 'Installing skill…'
              : saveState === 'installing-browser' ? 'Installing Chromium…'
              : 'Save Config'}
          </Button>

          {saveState === 'saved' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved · Chromium ready
            </div>
          )}
          {saveState === 'installing' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="w-3.5 h-3.5" />
              Cloning playwright-skill…
            </div>
          )}
          {saveState === 'installing-browser' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="w-3.5 h-3.5" />
              Installing Chromium browser…
            </div>
          )}
          {saveState === 'error' && (
            <div className="text-xs text-red-400 truncate max-w-xs">{saveError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
