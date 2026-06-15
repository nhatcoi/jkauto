import { useState, useEffect, useCallback, useRef } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { AppiumStatus, AppiumDriverMap } from '@jkauto/core'
import { Button } from '@/components/ui/button'
import { useRunStore } from '@/store/run.store'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, Download, RefreshCw, MonitorSmartphone } from 'lucide-react'

const KNOWN_DRIVERS: { name: string; label: string; platform: string }[] = [
  { name: 'uiautomator2', label: 'UiAutomator2', platform: 'Android' },
  { name: 'xcuitest',     label: 'XCUITest',     platform: 'iOS / tvOS' },
  { name: 'espresso',     label: 'Espresso',     platform: 'Android (alt)' },
]

export function AppiumPanel() {
  const [status, setStatus] = useState<AppiumStatus>({ running: false })
  const [busy, setBusy] = useState(false)
  const [drivers, setDrivers] = useState<AppiumDriverMap>({})
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [installingDriver, setInstallingDriver] = useState<string | null>(null)
  const appiumLogs = useRunStore((s) => s.appiumLogs)
  const addAppiumLog = useRunStore((s) => s.addAppiumLog)
  const settings = useAppSettingsStore((s) => s.settings)
  const logRef = useRef<HTMLDivElement>(null)

  const refreshStatus = useCallback(async () => {
    const s = (await window.api.invoke(IpcChannels.APPIUM_STATUS)) as AppiumStatus
    setStatus(s)
  }, [])

  const refreshDrivers = useCallback(async () => {
    setLoadingDrivers(true)
    try {
      const d = (await window.api.invoke(IpcChannels.APPIUM_DRIVERS_GET)) as AppiumDriverMap
      setDrivers(d)
    } finally {
      setLoadingDrivers(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    void refreshDrivers()
    const interval = setInterval(refreshStatus, 3000)
    return () => clearInterval(interval)
  }, [refreshStatus, refreshDrivers])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [appiumLogs])

  async function handleToggle() {
    setBusy(true)
    try {
      if (status.running) {
        await window.api.invoke(IpcChannels.APPIUM_STOP)
      } else {
        await window.api.invoke(IpcChannels.APPIUM_START)
      }
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  async function handleInstall(driverName: string) {
    setInstallingDriver(driverName)
    try {
      const res = (await window.api.invoke(
        IpcChannels.APPIUM_DRIVER_INSTALL,
        driverName,
      )) as { ok: boolean; error?: string }
      if (!res?.ok && res?.error) {
        addAppiumLog(`Driver install failed: ${res.error}`, 'error')
      }
      await refreshDrivers()
    } catch (err) {
      addAppiumLog(
        `Driver install error: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      )
    } finally {
      setInstallingDriver(null)
    }
  }

  const tail = appiumLogs.slice(-100)
  const missingDrivers = KNOWN_DRIVERS.filter((d) => !drivers[d.name])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status + toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              status.running ? 'bg-green-500' : 'bg-muted-foreground/40',
            )}
          />
          <span className="text-xs text-muted-foreground">
            {status.running ? `Running · PID ${status.pid ?? '?'}` : 'Stopped'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 gap-1"
            disabled={!status.running}
            onClick={() => window.api.invoke(IpcChannels.APPIUM_INSPECTOR_OPEN)}
            title="Open device mirror & inspector"
          >
            <MonitorSmartphone className="w-3 h-3" />
            Inspect
          </Button>
          <Button
            size="sm"
            variant={status.running ? 'destructive' : 'default'}
            className="h-6 text-xs px-2"
            disabled={busy}
            onClick={handleToggle}
          >
            {busy ? '…' : status.running ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Quick config */}
      {settings && (
        <div className="flex gap-2 px-3 py-1.5 border-b border-border shrink-0 text-[11px] text-muted-foreground">
          <span className="font-mono">{settings.appium.host}:{settings.appium.port}</span>
          <span className="text-border">·</span>
          <span>{settings.appium.logLevel}</span>
          {settings.appium.autoStart && (
            <>
              <span className="text-border">·</span>
              <span className="text-primary/70">auto-start</span>
            </>
          )}
        </div>
      )}

      {/* Drivers */}
      <div className="border-b border-border shrink-0 px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Drivers
          </span>
          <button
            onClick={refreshDrivers}
            disabled={loadingDrivers}
            className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30 transition-colors"
            title="Refresh driver list"
          >
            <RefreshCw className={cn('w-3 h-3', loadingDrivers && 'animate-spin')} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {KNOWN_DRIVERS.map((d) => {
            const info = drivers[d.name]
            const installed = !!info?.installed
            const installing = installingDriver === d.name
            return (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {installed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium text-foreground/90">{d.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{d.platform}</span>
                    {info?.version && (
                      <span className="text-[10px] text-muted-foreground/60 ml-1">v{info.version}</span>
                    )}
                  </div>
                </div>
                {!installed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[10px] px-1.5 gap-1 shrink-0"
                    disabled={installing || installingDriver !== null}
                    onClick={() => handleInstall(d.name)}
                  >
                    <Download className="w-2.5 h-2.5" />
                    {installing ? 'Installing…' : 'Install'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {missingDrivers.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50 mt-2 leading-relaxed">
            Install progress streams to the Appium tab below.
          </p>
        )}
      </div>

      {/* Log tail */}
      <div ref={logRef} className="flex-1 min-h-0 overflow-auto p-2 font-mono text-[11px] bg-background/20">
        {tail.length === 0 ? (
          <div className="text-muted-foreground/40 italic text-center mt-8">No logs yet</div>
        ) : (
          <div className="flex flex-col gap-0.5 select-text">
            {tail.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'whitespace-pre-wrap leading-relaxed',
                  log.level === 'error' ? 'text-red-400' : 'text-foreground/70',
                )}
              >
                <span className="text-muted-foreground/50 select-none">[{log.time}] </span>
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
