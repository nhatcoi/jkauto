import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { AppSettings } from '@jkauto/core'

type McpServer = AppSettings['agent']['mcpServers'][number]

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings['agent']>) => void
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

function McpServerRow({
  server,
  onUpdate,
  onRemove,
}: {
  server: McpServer
  onUpdate: (patch: Partial<McpServer>) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
      <Input
        value={server.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder="name"
        className="h-7 text-xs font-mono border-border"
      />
      <Input
        value={server.command}
        onChange={(e) => onUpdate({ command: e.target.value })}
        placeholder="command (e.g. npx)"
        className="h-7 text-xs font-mono border-border"
      />
      <button
        type="button"
        onClick={onRemove}
        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <Input
        value={server.args.join(' ')}
        onChange={(e) =>
          onUpdate({ args: e.target.value ? e.target.value.split(' ') : [] })
        }
        placeholder="args (space-separated)"
        className="h-7 text-xs font-mono border-border col-span-2"
      />
    </div>
  )
}

export function AgentSection({ settings, onChange }: Props) {
  const { agent } = settings
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  const handleTest = async () => {
    setTestStatus('testing')
    setTestError('')
    try {
      const url = `${agent.baseUrl.replace(/\/$/, '')}/models`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${agent.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      setTestStatus(res.ok ? 'ok' : 'error')
      if (!res.ok) setTestError(`${res.status} ${res.statusText}`)
    } catch (e) {
      setTestStatus('error')
      setTestError(e instanceof Error ? e.message : 'Connection failed')
    }
  }

  function updateMcpServer(index: number, patch: Partial<McpServer>) {
    const next = [...agent.mcpServers]
    next[index] = { ...next[index], ...patch }
    onChange({ mcpServers: next })
  }

  function removeMcpServer(index: number) {
    onChange({ mcpServers: agent.mcpServers.filter((_, i) => i !== index) })
  }

  function addMcpServer() {
    onChange({
      mcpServers: [
        ...agent.mcpServers,
        { name: '', command: 'npx', args: [], env: {}, enabled: true },
      ],
    })
  }

  function removeSkillPath(index: number) {
    onChange({ skillPaths: agent.skillPaths.filter((_, i) => i !== index) })
  }

  function addSkillPath() {
    onChange({ skillPaths: [...agent.skillPaths, ''] })
  }

  function updateSkillPath(index: number, value: string) {
    const next = [...agent.skillPaths]
    next[index] = value
    onChange({ skillPaths: next })
  }

  return (
    <div className="space-y-6">
      {/* LLM endpoint */}
      <div>
        <h3 className="text-sm font-semibold mb-0.5">AI Agent</h3>
        <p className="text-xs text-muted-foreground">OpenAI-compatible endpoint for the chat agent.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="agent-url">Base URL</Label>
          <Input
            id="agent-url"
            value={agent.baseUrl}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            placeholder="http://127.0.0.1:3000/v1"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-key">API Key</Label>
          <div className="relative">
            <Input
              id="agent-key"
              type={showKey ? 'text' : 'password'}
              value={agent.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              placeholder="sk-…"
              className="font-mono text-xs pr-8"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-model">Model</Label>
          <Input
            id="agent-model"
            value={agent.model}
            onChange={(e) => onChange({ model: e.target.value })}
            placeholder="gpt-4o / claude-sonnet-4-6 / v1"
            className="font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === 'testing' || !agent.baseUrl}
            className="text-xs h-7 gap-1.5"
          >
            {testStatus === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
            Test Connection
          </Button>
          {testStatus === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          )}
          {testStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="w-3.5 h-3.5" /> {testError || 'Failed'}
            </span>
          )}
        </div>
      </div>

      {/* File edit mode */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div>
          <h4 className="text-xs font-semibold text-foreground">File Edit Mode</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Controls whether the agent can write files directly or only suggest changes.
          </p>
        </div>
        <div className="flex gap-2">
          {(['ask', 'auto', 'auto-with-rollback'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ editMode: mode })}
              className={[
                'h-7 px-3 rounded text-xs font-medium border transition-colors',
                agent.editMode === mode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary',
              ].join(' ')}
            >
              {mode === 'ask'
                ? 'Ask'
                : mode === 'auto'
                  ? 'Auto'
                  : 'Auto + Rollback'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {agent.editMode === 'ask' && 'Write tools hidden — agent suggests only, user applies.'}
          {agent.editMode === 'auto' && 'Agent can write files directly via MCP.'}
          {agent.editMode === 'auto-with-rollback' &&
            'Agent writes files but backs up originals to .autotest/agent-backups/ first.'}
        </p>
      </div>

      {/* MCP servers */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Extra MCP Servers</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Built-in: jkauto-mcp, filesystem, playwright. Add more here.
          </p>
        </div>

        {agent.mcpServers.length > 0 && (
          <div className="space-y-3">
            {agent.mcpServers.map((srv, i) => (
              <McpServerRow
                key={i}
                server={srv}
                onUpdate={(patch) => updateMcpServer(i, patch)}
                onRemove={() => removeMcpServer(i)}
              />
            ))}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={addMcpServer}
          className="text-xs h-7 gap-1.5"
        >
          <Plus className="w-3 h-3" />
          Add MCP Server
        </Button>
      </div>

      {/* Skill paths */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Skill Files</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Markdown files injected as system instructions for the agent.
          </p>
        </div>

        {agent.skillPaths.length > 0 && (
          <div className="space-y-2">
            {agent.skillPaths.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={p}
                  onChange={(e) => updateSkillPath(i, e.target.value)}
                  placeholder="/path/to/skill.md"
                  className="h-7 text-xs font-mono border-border"
                />
                <button
                  type="button"
                  onClick={() => removeSkillPath(i)}
                  className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={addSkillPath}
          className="text-xs h-7 gap-1.5"
        >
          <Plus className="w-3 h-3" />
          Add Skill File
        </Button>
      </div>
    </div>
  )
}
