import { useState, useEffect, useCallback, useRef } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { AppiumStatus, AppiumDriverMap, AppiumEnvStatus } from '@jkauto/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRunStore } from '@/store/run.store'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { cn } from '@/lib/utils'
import { AlertCircle, Smartphone, BookOpen } from 'lucide-react'
import { DeviceMirror } from './DeviceMirror'
import { AndroidMirror } from './AndroidMirror'
import { DeviceToolbar } from './DeviceToolbar'
import { AppiumGuideDialog } from './AppiumGuideDialog'
import { useAppiumSession } from './useAppiumSession'

function Banner({ children, onGuide }: { children: React.ReactNode; onGuide: () => void }) {
  return (
    <div className="mx-3 mt-2 rounded border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-2 text-[11px] text-yellow-200/90 leading-relaxed shrink-0">
      <div className="flex gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          {children}{' '}
          <button onClick={onGuide} className="underline text-yellow-300 hover:text-yellow-200">
            Open guide
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppiumPanel() {
  // --- server + env state ---
  const [serverStatus, setServerStatus] = useState<AppiumStatus>({ running: false })
  const [env, setEnv] = useState<AppiumEnvStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [drivers, setDrivers] = useState<AppiumDriverMap>({})
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [installingDriver, setInstallingDriver] = useState<string | null>(null)
  const settings = useAppSettingsStore((s) => s.settings)
  const addAppiumLog = useRunStore((s) => s.addAppiumLog)

  // --- session / mirror state ---
  const {
    session, devices, avdEntries, bootingAvd,
    connecting, log,
    connect, disconnect, tap, swipe, pressButton, screenshot,
    refreshDevices, refreshAvds, startAvd,
  } = useAppiumSession()

  // selectedId: "avd:<avdName>" for android, "ios:<udid>" for iOS
  const [selectedId, setSelectedId] = useState('')
  const [bundleId, setBundleId] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const prevBootingRef = useRef<string | null>(null)

  const iosDevices = devices.filter((d) => d.platform === 'ios')

  // Derived selection
  const selectedAvd = avdEntries.find((e) => `avd:${e.avdName}` === selectedId)
  const selectedIos = iosDevices.find((d) => `ios:${d.udid}` === selectedId)
  const isStopped = selectedAvd?.state === 'stopped'
  const isBooting = bootingAvd != null && selectedAvd?.avdName === bootingAvd
  const canConnect =
    (selectedAvd?.state === 'device') ||
    selectedIos != null  // any iOS device selectable; simulator auto-boots on connect

  // Auto-select newly booted device
  useEffect(() => {
    const prev = prevBootingRef.current
    prevBootingRef.current = bootingAvd
    if (prev && !bootingAvd) {
      const booted = avdEntries.find((e) => e.avdName === prev && e.state === 'device')
      if (booted) setSelectedId(`avd:${booted.avdName}`)
    }
  }, [bootingAvd, avdEntries])

  const refreshStatus = useCallback(async () => {
    const s = (await window.api.invoke(IpcChannels.APPIUM_STATUS)) as AppiumStatus
    setServerStatus(s)
  }, [])

  const refreshEnv = useCallback(async () => {
    const e = (await window.api.invoke(IpcChannels.APPIUM_ENV_CHECK)) as AppiumEnvStatus
    setEnv(e)
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

  const handleRefreshDevices = useCallback(async () => {
    await Promise.all([refreshDevices(), refreshAvds()])
  }, [refreshDevices, refreshAvds])

  useEffect(() => {
    void refreshStatus()
    void refreshEnv()
    void refreshDrivers()
    const interval = setInterval(refreshStatus, 3000)
    return () => clearInterval(interval)
  }, [refreshStatus, refreshEnv, refreshDrivers])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  async function handleToggleServer() {
    setBusy(true)
    try {
      await window.api.invoke(
        serverStatus.running ? IpcChannels.APPIUM_STOP : IpcChannels.APPIUM_START,
      )
      await refreshStatus()
      await refreshEnv()
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
      if (!res?.ok && res?.error) addAppiumLog(`Driver install failed: ${res.error}`, 'error')
      await refreshDrivers()
    } catch (err) {
      addAppiumLog(`Driver install error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setInstallingDriver(null)
    }
  }

  async function handleConnect() {
    if (selectedAvd?.udid && selectedAvd.state === 'device') {
      await connect({
        platform: 'android',
        deviceName: selectedAvd.avdName,
        udid: selectedAvd.udid,
        bundleId: bundleId.trim() || undefined,
      })
    } else if (selectedIos) {
      await connect({
        platform: 'ios',
        deviceName: selectedIos.name,
        udid: selectedIos.udid,
        platformVersion: selectedIos.platformVersion,
        bundleId: bundleId.trim() || undefined,
      })
    }
  }

  const appiumMissing = env != null && !env.appiumInstalled
  const noMobileSdk = env != null && !env.androidSdk && !env.xcode

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Server status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                serverStatus.running ? 'bg-green-500' : 'bg-muted-foreground/40',
              )}
            />
            <span className="text-xs text-muted-foreground truncate">
              {serverStatus.running ? `Server · PID ${serverStatus.pid ?? '?'}` : 'Server stopped'}
            </span>
            {settings && (
              <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
                {settings.appium.host}:{settings.appium.port}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 gap-1"
              onClick={() => setGuideOpen(true)}
              title="Setup guide"
            >
              <BookOpen className="w-3 h-3" />
              Guide
            </Button>
            <Button
              size="sm"
              variant={serverStatus.running ? 'destructive' : 'default'}
              className="h-6 text-xs px-2"
              disabled={busy || appiumMissing}
              onClick={handleToggleServer}
            >
              {busy ? '…' : serverStatus.running ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>

        {/* Env banners */}
        {appiumMissing && (
          <Banner onGuide={() => setGuideOpen(true)}>
            Appium not found. Install it with{' '}
            <span className="font-mono">npm install -g appium</span>. Then restart the IDE so the
            updated PATH is picked up.
          </Banner>
        )}
        {!appiumMissing && noMobileSdk && (
          <Banner onGuide={() => setGuideOpen(true)}>
            Android SDK with emulator is required. Install Android Studio or the command-line tools.
          </Banner>
        )}

        {/* Device mirror: toolbar + stream */}
        <div className="flex-1 min-h-0 flex flex-col bg-black/40">
          <div className="shrink-0 flex justify-center px-2 pt-2 pb-1 overflow-x-auto">
            <DeviceToolbar
              session={session}
              avdEntries={avdEntries}
              iosDevices={iosDevices}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              bootingAvd={bootingAvd}
              showIos={window.api.platform === 'darwin'}
              onRefreshDevices={handleRefreshDevices}
              onPressButton={pressButton}
              onScreenshot={screenshot}
            />
          </div>
          <div className="flex-1 min-h-0">
            {session ? (
              <DeviceMirror session={session} onTap={tap} onSwipe={swipe} />
            ) : selectedAvd?.state === 'device' && selectedAvd.udid ? (
              // Mirror starts as soon as AVD is running — no Appium session needed
              <AndroidMirror
                serial={selectedAvd.udid}
                onTap={session ? tap : () => {}}
                onSwipe={session ? swipe : () => {}}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/25 select-none">
                <Smartphone className="w-14 h-14" strokeWidth={1} />
                <span className="text-xs">
                  {isBooting ? 'Booting emulator…' : 'Select a running device'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Connect row */}
        <div className="px-3 py-2 border-t border-border shrink-0 flex gap-1.5">
          <Input
            value={bundleId}
            onChange={(e) => setBundleId(e.target.value)}
            placeholder="Bundle ID / package (optional)"
            className="h-7 text-xs flex-1 min-w-0"
            disabled={!!session}
          />
          {session ? (
            <Button size="sm" variant="destructive" className="h-7 text-xs px-3" onClick={disconnect}>
              Disconnect
            </Button>
          ) : isBooting ? (
            <Button size="sm" className="h-7 text-xs px-3" disabled>
              Booting…
            </Button>
          ) : isStopped ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-3"
              disabled={!!bootingAvd}
              onClick={() => selectedAvd && startAvd(selectedAvd.avdName)}
            >
              Launch
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              disabled={!canConnect || connecting || !serverStatus.running}
              onClick={handleConnect}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>

        {/* Interaction log */}
        <div
          ref={logRef}
          className="h-20 overflow-auto border-t border-border p-2 font-mono text-[10px] bg-background/20 shrink-0"
        >
          {log.length === 0 ? (
            <div className="text-muted-foreground/40 italic text-center mt-2">Ready. Connect to start.</div>
          ) : (
            <div className="flex flex-col gap-0.5 select-text">
              {log.slice(-60).map((l) => (
                <div
                  key={l.id}
                  className={cn(
                    'whitespace-pre-wrap leading-relaxed',
                    l.kind === 'action' && 'text-green-400',
                    l.kind === 'error' && 'text-red-400',
                    l.kind === 'info' && 'text-foreground/60',
                  )}
                >
                  <span className="text-muted-foreground/40 select-none">{l.time} </span>
                  {l.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <AppiumGuideDialog
          open={guideOpen}
          onOpenChange={setGuideOpen}
          env={env}
          drivers={drivers}
          loadingDrivers={loadingDrivers}
          installingDriver={installingDriver}
          onInstall={handleInstall}
          onRefreshDrivers={refreshDrivers}
        />
      </div>
    </TooltipProvider>
  )
}
