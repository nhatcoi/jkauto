import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { RefreshCw, Trash2, Copy } from 'lucide-react'
import { DeviceMirror } from './DeviceMirror'
import { useAppiumSession } from './useAppiumSession'

export function MobileInspector() {
  const {
    session,
    devices,
    connecting,
    log,
    connect,
    disconnect,
    tap,
    swipe,
    refreshDevices,
    clearLog,
  } = useAppiumSession()

  const [selectedUdid, setSelectedUdid] = useState<string>('')
  const [bundleId, setBundleId] = useState('')

  const selectedDevice = useMemo(
    () => devices.find((d) => d.udid === selectedUdid),
    [devices, selectedUdid],
  )

  async function handleConnect() {
    if (!selectedDevice) return
    await connect({
      platform: selectedDevice.platform,
      deviceName: selectedDevice.name,
      platformVersion: selectedDevice.platformVersion,
      bundleId: bundleId.trim() || undefined,
    })
  }

  function copyLog() {
    void navigator.clipboard.writeText(log.map((l) => `${l.time} ${l.message}`).join('\n'))
  }

  return (
    <div className="flex h-screen min-h-0 bg-card text-foreground">
      {/* Left: device mirror */}
      <div className="flex-1 min-w-0 border-r border-border flex flex-col">
        <div className="h-9 shrink-0 border-b border-border flex items-center px-3 text-xs font-medium">
          {session ? `${session.deviceName} · ${session.width}×${session.height}` : 'No device'}
        </div>
        <div className="flex-1 min-h-0">
          {session ? (
            <DeviceMirror mjpegPort={session.mjpegPort} onTap={tap} onSwipe={swipe} />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50">
              Connect a device to start mirroring
            </div>
          )}
        </div>
      </div>

      {/* Right: controls + log */}
      <div className="w-80 shrink-0 flex flex-col min-h-0">
        <div className="p-3 border-b border-border space-y-2 shrink-0">
          <div
            className={cn(
              'text-xs rounded px-2 py-1.5 border',
              session
                ? 'text-green-400 border-green-500/30 bg-green-500/5'
                : 'text-muted-foreground border-border',
            )}
          >
            {session ? 'Connected (WebDriverAgent)' : 'Not connected'}
          </div>

          <div className="flex gap-1.5">
            <Select value={selectedUdid} onValueChange={setSelectedUdid} disabled={!!session}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.udid} value={d.udid} className="text-xs">
                    {d.name}
                    {d.platformVersion ? ` (${d.platform} ${d.platformVersion})` : ` (${d.platform})`}
                    {d.state === 'Booted' || d.state === 'device' ? ' ●' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={refreshDevices}
              disabled={!!session}
              title="Refresh devices"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Input
            value={bundleId}
            onChange={(e) => setBundleId(e.target.value)}
            placeholder="Bundle ID / package (optional)"
            className="h-8 text-xs"
            disabled={!!session}
          />

          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-8 text-xs flex-1"
              disabled={!selectedDevice || connecting || !!session}
              onClick={handleConnect}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs flex-1"
              disabled={!session}
              onClick={disconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Interactions
          </span>
          <div className="flex gap-1">
            <button
              onClick={copyLog}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Copy log"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={clearLog}
              className="text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Clear log"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-2 font-mono text-[11px] space-y-0.5">
          {log.length === 0 ? (
            <div className="text-muted-foreground/40 italic text-center mt-6">
              Ready. Click Connect to start.
            </div>
          ) : (
            log.map((l) => (
              <div
                key={l.id}
                className={cn(
                  'whitespace-pre-wrap leading-relaxed',
                  l.kind === 'action' && 'text-green-400',
                  l.kind === 'error' && 'text-red-400',
                  l.kind === 'info' && 'text-foreground/70',
                )}
              >
                <span className="text-muted-foreground/50 select-none">{l.time} </span>
                {l.message}
              </div>
            ))
          )}
        </div>

        {session && (
          <div className="border-t border-border p-3 shrink-0 text-[10px] text-muted-foreground space-y-0.5">
            <div>
              Session{' '}
              <span className="font-mono text-foreground/70">{session.sessionId.slice(0, 18)}…</span>
            </div>
            <div>
              State <span className="text-foreground/70">{session.platform}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
