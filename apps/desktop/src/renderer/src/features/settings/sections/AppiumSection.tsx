import { useState, useEffect, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IpcChannels } from '@jkauto/core'
import type { AppSettings, AppiumStatus } from '@jkauto/core'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings['appium']>) => void
}

export function AppiumSection({ settings, onChange }: Props) {
  const { appium } = settings
  const [status, setStatus] = useState<AppiumStatus>({ running: false })
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    const s = await window.api.invoke(IpcChannels.APPIUM_STATUS) as AppiumStatus
    setStatus(s)
  }, [])

  useEffect(() => {
    void refreshStatus()
    const interval = setInterval(refreshStatus, 3000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  async function handleToggle() {
    setBusy(true)
    setStartError(null)
    try {
      if (status.running) {
        await window.api.invoke(IpcChannels.APPIUM_STOP)
      } else {
        const result = await window.api.invoke(IpcChannels.APPIUM_START) as { ok: boolean; error?: string }
        if (!result.ok) setStartError(result.error ?? 'Failed to start Appium')
      }
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Appium</h3>
        <p className="text-xs text-muted-foreground">
          Mobile / desktop automation via Appium server.
        </p>
      </div>

      {/* Server status + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${status.running ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
          />
          <span className="text-xs text-muted-foreground">
            {status.running ? `Running (PID ${status.pid ?? '?'})` : 'Stopped'}
          </span>
        </div>
        <Button
          size="sm"
          variant={status.running ? 'destructive' : 'default'}
          className="h-7 text-xs"
          disabled={busy}
          onClick={handleToggle}
        >
          {busy ? '...' : status.running ? 'Stop Server' : 'Start Server'}
        </Button>
      </div>

      {startError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 whitespace-pre-wrap">
          {startError}
        </p>
      )}

      <div className="space-y-4">
        {/* Host */}
        <div className="space-y-1.5">
          <Label htmlFor="appium-host">Appium host</Label>
          <Input
            id="appium-host"
            value={appium.host}
            onChange={(e) => onChange({ host: e.target.value })}
            className="w-48 text-xs h-8"
            placeholder="localhost"
          />
        </div>

        {/* Port */}
        <div className="space-y-1.5">
          <Label htmlFor="appium-port">Port</Label>
          <Input
            id="appium-port"
            type="number"
            min={1}
            max={65535}
            value={appium.port}
            onChange={(e) =>
              onChange({ port: Math.min(65535, Math.max(1, parseInt(e.target.value, 10) || 4723)) })
            }
            className="w-28 text-xs h-8"
          />
        </div>

        {/* Log level */}
        <div className="space-y-1.5">
          <Label>Log level</Label>
          <Select
            value={appium.logLevel}
            onValueChange={(v) => onChange({ logLevel: v as AppSettings['appium']['logLevel'] })}
          >
            <SelectTrigger className="w-32 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-start */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Auto-start with test run</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Start Appium automatically when running Appium test cases
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={appium.autoStart}
            onClick={() => onChange({ autoStart: !appium.autoStart })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
              ${appium.autoStart ? 'bg-primary' : 'bg-secondary'}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform
                ${appium.autoStart ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
