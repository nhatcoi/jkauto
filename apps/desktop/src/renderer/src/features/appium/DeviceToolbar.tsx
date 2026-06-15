import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AppiumButton, AppiumDeviceEntry, AppiumSessionInfo } from '@jkauto/core'
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

interface Props {
  session: AppiumSessionInfo | null
  devices: AppiumDeviceEntry[]
  selectedUdid: string
  onSelectUdid: (udid: string) => void
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

export function DeviceToolbar({
  session,
  devices,
  selectedUdid,
  onSelectUdid,
  onRefreshDevices,
  onPressButton,
  onScreenshot,
}: Props) {
  const connected = !!session
  const label = session?.deviceName ?? 'Select device'

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-background/60 rounded-full border border-border shadow-sm shrink-0">
      {/* Device pill */}
      <div className="flex items-center gap-1.5 pl-1.5 pr-1 min-w-0">
        <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
        {connected ? (
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-xs font-semibold truncate">{label}</span>
            <span className="text-[10px] text-green-400">Connected</span>
          </div>
        ) : (
          <Select value={selectedUdid} onValueChange={onSelectUdid}>
            <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-xs gap-1 focus:ring-0 shadow-none">
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <SelectValue placeholder="Select device" />
                <span className="text-[10px] text-muted-foreground">Not connected</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {devices.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No devices found</div>
              ) : (
                devices.map((d) => (
                  <SelectItem key={d.udid} value={d.udid} className="text-xs">
                    {d.name}
                    {d.platformVersion ? ` (${d.platformVersion})` : ''}
                    {d.state === 'Booted' || d.state === 'device' ? ' ●' : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

      {/* Refresh devices (only useful before connect) */}
      {!connected && (
        <ToolButton label="Refresh devices" onClick={onRefreshDevices}>
          <RotateCw className="w-4 h-4" />
        </ToolButton>
      )}

      {/* Hardware / nav buttons */}
      {BUTTONS.map((b) => (
        <ToolButton
          key={b.id}
          label={b.label}
          disabled={!connected}
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
