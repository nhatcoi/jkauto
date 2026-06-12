import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { AppSettings } from '@jkauto/core'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings['agent']>) => void
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">AI Agent</h3>
        <p className="text-xs text-muted-foreground">
          OpenAI-compatible endpoint for the chat agent.
        </p>
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
    </div>
  )
}
