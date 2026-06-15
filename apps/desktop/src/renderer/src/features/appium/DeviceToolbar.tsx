import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppiumButton, AppiumDeviceEntry, AppiumSessionInfo, AvdEntry } from '@jkauto/core'
import {
  Smartphone,
  ChevronDown,
  House,
  ChevronLeft,
  Square,
  Lock,
  ChevronUp,
  Camera,
  RotateCw,
} from 'lucide-react'

type PlatformTab = 'android' | 'ios'

interface Props {
  session: AppiumSessionInfo | null
  avdEntries: AvdEntry[]
  iosDevices: AppiumDeviceEntry[]
  selectedId: string
  onSelectId: (id: string) => void
  bootingAvd: string | null
  showIos: boolean
  onRefreshDevices: () => void
  onPressButton: (button: AppiumButton) => void
  onScreenshot: () => void
}

const BUTTONS: { id: AppiumButton; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'back', label: 'Back', icon: ChevronLeft },
  { id: 'appswitch', label: 'App switcher', icon: Square },
  { id: 'lock', label: 'Lock / power', icon: Lock },
  { id: 'volup', label: 'Volume up', icon: ChevronUp },
  { id: 'voldown', label: 'Volume down', icon: ChevronDown },
]

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground',
            'hover:text-foreground hover:bg-muted/40 disabled:opacity-30 disabled:hover:bg-transparent',
            'transition-colors',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Buttons not available on iOS (no back/appswitch).
const IOS_UNSUPPORTED = new Set<AppiumButton>(['back', 'appswitch'])

export function DeviceToolbar({
  session,
  avdEntries,
  iosDevices,
  selectedId,
  onSelectId,
  bootingAvd,
  showIos,
  onRefreshDevices,
  onPressButton,
  onScreenshot,
}: Props) {
  const connected = !!session
  const [activeTab, setActiveTab] = useState<PlatformTab>('android')

  function handleTabChange(tab: PlatformTab) {
    if (tab === activeTab) return
    setActiveTab(tab)
    onSelectId('')
  }

  const isIosTab = activeTab === 'ios'

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-background/60 rounded-full border border-border shadow-sm shrink-0">
      {/* Android / iOS toggle */}
      {!connected && (
        <>
          <div className="flex items-center rounded-full bg-muted/50 p-0.5 shrink-0">
            <button
              onClick={() => handleTabChange('android')}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                activeTab === 'android'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Android
            </button>
            <button
              onClick={() => showIos && handleTabChange('ios')}
              disabled={!showIos}
              title={!showIos ? 'iOS available on macOS only' : undefined}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                activeTab === 'ios'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                !showIos && 'opacity-30 cursor-not-allowed hover:text-muted-foreground',
              )}
            >
              iOS
            </button>
          </div>
          <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
        </>
      )}

      {/* Device pill */}
      <div className="flex items-center gap-1.5 pl-1.5 pr-1 min-w-0">
        <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
        {connected ? (
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-semibold truncate">{session.deviceName}</span>
            <span className="text-[10px] text-green-400">Connected</span>
          </div>
        ) : (
          <Select value={selectedId} onValueChange={onSelectId}>
            <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-xs gap-1 focus:ring-0 shadow-none">
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <SelectValue placeholder="Select device" />
                <span className="text-[10px] text-muted-foreground">Not connected</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {isIosTab ? (
                iosDevices.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No devices found</div>
                ) : (
                  iosDevices.map((d) => {
                    const booted = d.state === 'Booted' || d.state === 'device'
                    return (
                      <SelectItem
                        key={`ios:${d.udid}`}
                        value={`ios:${d.udid}`}
                        className="text-xs"
                      >
                        {d.name}
                        {d.platformVersion ? ` (${d.platformVersion})` : ''}
                        {booted ? ' ●' : ''}
                      </SelectItem>
                    )
                  })
                )
              ) : avdEntries.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No emulators / devices found</div>
              ) : (
                avdEntries.map((e) => {
                  const booting = bootingAvd === e.avdName
                  const ready = e.state === 'device'
                  const stopped = e.state === 'stopped'
                  const offline = !ready && !stopped && !booting
                  return (
                    <SelectItem
                      key={`avd:${e.avdName}`}
                      value={`avd:${e.avdName}`}
                      className="text-xs"
                      disabled={offline}
                    >
                      {e.displayName}
                      {booting ? ' (booting…)' : ready ? ' ●' : stopped ? ' (stopped)' : ' (offline)'}
                    </SelectItem>
                  )
                })
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

      {!connected && (
        <ToolButton label="Refresh devices" onClick={onRefreshDevices}>
          <RotateCw className="w-4 h-4" />
        </ToolButton>
      )}

      {BUTTONS.map((b) => (
        <ToolButton
          key={b.id}
          label={b.label}
          disabled={!connected || (isIosTab && IOS_UNSUPPORTED.has(b.id))}
          onClick={() => onPressButton(b.id)}
        >
          <b.icon className="w-4 h-4" />
        </ToolButton>
      ))}

      <ToolButton label="Screenshot" disabled={!connected} onClick={onScreenshot}>
        <Camera className="w-4 h-4" />
      </ToolButton>
    </div>
  )
}
