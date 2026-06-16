import { useState, useEffect, useCallback, useRef } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { AppiumDriverMap, AppiumEnvStatus, IdbEnvStatus, ScrcpyEnvStatus } from '@jkauto/core'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EngineInstallBanner } from '@/components/engine-install/EngineInstallBanner'
import { useRunStore } from '@/store/run.store'
import { cn } from '@/lib/utils'
import { AlertCircle, Smartphone, BookOpen } from 'lucide-react'
import { DeviceMirror } from './DeviceMirror'
import { AndroidMirror } from './AndroidMirror'
import { IosSimulatorMirror } from './IosSimulatorMirror'
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
  // --- env state ---
  const [env, setEnv] = useState<AppiumEnvStatus | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [drivers, setDrivers] = useState<AppiumDriverMap>({})
  const [scrcpyEnv, setScrcpyEnv] = useState<ScrcpyEnvStatus | null>(null)
  const [idbEnv, setIdbEnv] = useState<IdbEnvStatus | null>(null)
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [installingDriver, setInstallingDriver] = useState<string | null>(null)
  const addAppiumLog = useRunStore((s) => s.addAppiumLog)

  // --- session / mirror state ---
  const {
    session, devices, avdEntries, bootingAvd,
    log,
    tap, swipe, pressButton, screenshot,
    refreshDevices, refreshAvds, startAvd, openIosSimulator,
  } = useAppiumSession()

  // selectedId: "avd:<avdName>" for android, "ios:<udid>" for iOS
  const [selectedId, setSelectedId] = useState('')
  const [androidScreenshotRequest, setAndroidScreenshotRequest] = useState(0)
  const [iosScreenshotRequest, setIosScreenshotRequest] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const prevBootingRef = useRef<string | null>(null)

  const iosDevices = devices.filter((d) => d.platform === 'ios')

  // Derived selection
  const selectedAvd = avdEntries.find((e) => `avd:${e.avdName}` === selectedId)
  const selectedIos = iosDevices.find((d) => `ios:${d.udid}` === selectedId)
  const isStopped = selectedAvd?.state === 'stopped'
  const isBooting = bootingAvd != null && selectedAvd?.avdName === bootingAvd
  const androidMirrorActive = !session && selectedAvd?.state === 'device' && !!selectedAvd.udid
  const iosSimulatorMirrorActive = !session && selectedIos?.kind === 'simulator' && !!selectedIos.udid
  const androidMirrorReady = androidMirrorActive && scrcpyEnv?.installed === true
  const iosSimulatorMirrorReady = iosSimulatorMirrorActive && idbEnv?.installed === true

  // Auto-select newly booted device
  useEffect(() => {
    const prev = prevBootingRef.current
    prevBootingRef.current = bootingAvd
    if (prev && !bootingAvd) {
      const booted = avdEntries.find((e) => e.avdName === prev && e.state === 'device')
      if (booted) setSelectedId(`avd:${booted.avdName}`)
    }
  }, [bootingAvd, avdEntries])

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

  const refreshMirrorTools = useCallback(async () => {
    const [scrcpy, idb] = await Promise.all([
      window.api.invoke(IpcChannels.SCRCPY_ENV_CHECK) as Promise<ScrcpyEnvStatus>,
      window.api.invoke(IpcChannels.IDB_ENV_CHECK) as Promise<IdbEnvStatus>,
    ])
    setScrcpyEnv(scrcpy)
    setIdbEnv(idb)
  }, [])

  const handleRefreshDevices = useCallback(async () => {
    await Promise.all([refreshDevices(), refreshAvds()])
  }, [refreshDevices, refreshAvds])

  const handleSelectId = useCallback(
    (id: string) => {
      setSelectedId(id)

      if (id.startsWith('avd:')) {
        const avdName = id.slice('avd:'.length)
        const avd = avdEntries.find((entry) => entry.avdName === avdName)
        if (avd?.state === 'stopped' && bootingAvd !== avd.avdName) {
          void startAvd(avd.avdName)
        }
        return
      }

      if (id.startsWith('ios:')) {
        const udid = id.slice('ios:'.length)
        const device = iosDevices.find((entry) => entry.udid === udid)
        if (device?.kind === 'simulator') {
          void openIosSimulator(device.udid, device.name).then(() => {
            void refreshDevices()
          })
        }
      }
    },
    [avdEntries, bootingAvd, iosDevices, openIosSimulator, refreshDevices, startAvd],
  )

  useEffect(() => {
    void refreshEnv()
    void refreshDrivers()
    void refreshMirrorTools()
  }, [refreshEnv, refreshDrivers, refreshMirrorTools])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

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

  const noMobileSdk = env != null && !env.androidSdk && !env.xcode

  async function handlePressButton(button: Parameters<typeof pressButton>[0]) {
    if (androidMirrorReady) {
      const res = (await window.api.invoke(IpcChannels.SCRCPY_PRESS_BUTTON, button)) as {
        ok: boolean
        error?: string
      }
      if (!res.ok) addAppiumLog(`scrcpy button failed: ${res.error ?? 'unknown'}`, 'error')
      return
    }
    await pressButton(button)
  }

  async function handleScreenshot() {
    if (androidMirrorReady) {
      setAndroidScreenshotRequest((value) => value + 1)
      return
    }
    if (iosSimulatorMirrorReady) {
      setIosScreenshotRequest((value) => value + 1)
      return
    }
    await screenshot()
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex justify-end px-3 py-1.5 border-b border-border shrink-0">
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
        </div>

        {/* Env banners */}
        {noMobileSdk && (
          <Banner onGuide={() => setGuideOpen(true)}>
            Android SDK with emulator is required. Install Android Studio or the command-line tools.
          </Banner>
        )}

        {/* Device mirror: toolbar + stream */}
        <div className="flex-1 min-h-0 flex flex-col bg-black/40">
          <div className="shrink-0 flex justify-center px-2 pt-2 pb-1 overflow-x-auto">
            <DeviceToolbar
              session={session}
              androidMirrorActive={androidMirrorReady}
              iosSimulatorMirrorActive={iosSimulatorMirrorReady}
              avdEntries={avdEntries}
              iosDevices={iosDevices}
              selectedId={selectedId}
              onSelectId={handleSelectId}
              bootingAvd={bootingAvd}
              showIos={window.api.platform === 'darwin'}
              onRefreshDevices={handleRefreshDevices}
              onPressButton={handlePressButton}
              onScreenshot={handleScreenshot}
            />
          </div>
          <div className="flex-1 min-h-0">
            {session ? (
              <DeviceMirror session={session} onTap={tap} onSwipe={swipe} />
            ) : androidMirrorReady ? (
              // Mirror + gestures work via scrcpy control channel — no Appium needed
              <AndroidMirror serial={selectedAvd.udid!} screenshotRequest={androidScreenshotRequest} />
            ) : androidMirrorActive ? (
              <div className="h-full flex items-center justify-center px-4">
                <EngineInstallBanner
                  engine="scrcpy"
                  className="w-full max-w-xl"
                  onInstalled={refreshMirrorTools}
                />
              </div>
            ) : iosSimulatorMirrorReady ? (
              <IosSimulatorMirror udid={selectedIos.udid} screenshotRequest={iosScreenshotRequest} />
            ) : iosSimulatorMirrorActive ? (
              <div className="h-full flex items-center justify-center px-4">
                <EngineInstallBanner
                  engine="idb"
                  className="w-full max-w-xl"
                  onInstalled={refreshMirrorTools}
                />
              </div>
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

        {(isBooting || isStopped) && (
          <div className="px-3 py-2 border-t border-border shrink-0 flex justify-end">
            {isBooting ? (
            <Button size="sm" className="h-7 text-xs px-3" disabled>
              Booting…
            </Button>
            ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-3"
              disabled={!!bootingAvd}
              onClick={() => selectedAvd && startAvd(selectedAvd.avdName)}
            >
              Launch
            </Button>
            )}
          </div>
        )}

        {/* Interaction log */}
        <div
          ref={logRef}
          className="h-20 overflow-auto border-t border-border p-2 font-mono text-[10px] bg-background/20 shrink-0"
        >
          {log.length === 0 ? (
            <div className="text-muted-foreground/40 italic text-center mt-2">Ready.</div>
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
