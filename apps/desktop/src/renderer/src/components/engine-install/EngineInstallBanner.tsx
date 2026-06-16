import { useState, useEffect, useCallback } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { AppiumEnvStatus, MaestroEnvStatus } from '@jkauto/core'
import { AlertTriangle, Terminal, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      off: (channel: string, cb: (...args: unknown[]) => void) => void
      openExternal: (url: string) => void
    }
  }
}

export type MobileEngine = 'appium' | 'maestro'

interface EngineInfo {
  label: string
  checkChannel: string
  installChannel: string
  logChannel: string
  extractInstalled: (res: unknown) => boolean
  installCmd: (os: 'windows' | 'mac' | 'linux') => string | null
  installCmdLabel: (os: 'windows' | 'mac' | 'linux') => string
  guideUrl: string
  installDisabledOnWindows?: boolean
}

const ENGINES: Record<MobileEngine, EngineInfo> = {
  appium: {
    label: 'Appium',
    checkChannel: IpcChannels.APPIUM_ENV_CHECK,
    installChannel: IpcChannels.APPIUM_GLOBAL_INSTALL,
    logChannel: IpcChannels.APPIUM_LOG,
    extractInstalled: (res) => !!(res as AppiumEnvStatus)?.appiumInstalled,
    installCmd: () => 'npm install -g appium',
    installCmdLabel: () => 'npm install -g appium',
    guideUrl: 'https://appium.io/docs/en/latest/quickstart/',
  },
  maestro: {
    label: 'Maestro',
    checkChannel: IpcChannels.MAESTRO_ENV_CHECK,
    installChannel: IpcChannels.MAESTRO_INSTALL,
    logChannel: IpcChannels.MAESTRO_LOG,
    extractInstalled: (res) => !!(res as MaestroEnvStatus)?.installed,
    installCmd: (os) =>
      os === 'windows' ? null : 'curl -Ls "https://get.maestro.mobile.dev" | bash',
    installCmdLabel: (os) =>
      os === 'windows'
        ? 'Not supported on Windows — use WSL'
        : 'curl -Ls "https://get.maestro.mobile.dev" | bash',
    guideUrl: 'https://docs.mobile.dev/getting-started/installing-maestro',
    installDisabledOnWindows: true,
  },
}

function detectOs(): 'windows' | 'mac' | 'linux' {
  const p = navigator.userAgent.toLowerCase()
  if (p.includes('win')) return 'windows'
  if (p.includes('mac')) return 'mac'
  return 'linux'
}

interface LogEntry {
  id: string
  level: 'info' | 'error'
  message: string
}

interface Props {
  engine: MobileEngine
  className?: string
  /** Called after a successful install + re-check shows it's now installed. */
  onInstalled?: () => void
}

export function EngineInstallBanner({ engine, className, onInstalled }: Props) {
  const info = ENGINES[engine]
  const os = detectOs()

  const [installed, setInstalled] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const res = await window.api.invoke(info.checkChannel)
      const ok = info.extractInstalled(res)
      setInstalled(ok)
      if (ok) onInstalled?.()
    } finally {
      setChecking(false)
    }
  }, [info, onInstalled])

  useEffect(() => { void check() }, [check])

  useEffect(() => {
    const handler = (entry: unknown) => {
      const { level, message } = entry as { level: 'info' | 'error'; message: string }
      setLog((prev) => [
        ...prev.slice(-100),
        { id: crypto.randomUUID(), level, message },
      ])
    }
    window.api.on(info.logChannel, handler)
    return () => { window.api.off(info.logChannel, handler) }
  }, [info.logChannel])

  const handleInstall = async () => {
    setLog([])
    setInstalling(true)
    try {
      await window.api.invoke(info.installChannel)
    } finally {
      setInstalling(false)
      await check()
    }
  }

  const copyCmd = () => {
    const cmd = info.installCmd(os)
    if (cmd) void navigator.clipboard.writeText(cmd)
  }

  // Render nothing when installed or still checking on first load
  if (installed === null || installed === true) return null

  const cmd = info.installCmd(os)
  const isWindowsDisabled = info.installDisabledOnWindows && os === 'windows'

  return (
    <div className={cn('rounded border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px]', className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-amber-200">{info.label} not found.</span>
          <span className="text-muted-foreground ml-1">Install to run mobile tests.</span>

          {/* Install command */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <code className="px-1.5 py-0.5 rounded bg-black/30 text-amber-100/80 font-mono text-[10px] select-all">
              {info.installCmdLabel(os)}
            </code>
            {cmd && (
              <button
                type="button"
                onClick={copyCmd}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Copy
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1 border-amber-500/40 hover:border-amber-500/70"
              disabled={installing || isWindowsDisabled}
              onClick={handleInstall}
            >
              {installing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Installing…</>
              ) : (
                <><Terminal className="w-3 h-3" /> Install {info.label}</>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
              onClick={() => window.api.openExternal(info.guideUrl)}
            >
              <ExternalLink className="w-3 h-3" /> Guide
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 text-muted-foreground"
              disabled={checking}
              onClick={check}
            >
              {checking
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Verify
            </Button>
          </div>

          {/* Install log output */}
          {log.length > 0 && (
            <div className="mt-2 max-h-24 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[9px] leading-relaxed">
              {log.map((l) => (
                <div key={l.id} className={l.level === 'error' ? 'text-red-400' : 'text-green-300/80'}>
                  {l.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
