import { useEffect, useRef, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import { Smartphone, WifiOff } from 'lucide-react'

const TAP_THRESHOLD = 0.02

interface Props {
  udid: string
  screenshotRequest?: number
}

export function IosSimulatorMirror({ udid, screenshotRequest = 0 }: Props) {
  const frameRef = useRef('')
  const imageRef = useRef<HTMLImageElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [frame, setFrame] = useState('')
  const [status, setStatus] = useState<'starting' | 'streaming' | 'failed'>('starting')
  const [failReason, setFailReason] = useState('')

  useEffect(() => {
    let cancelled = false
    let inFlight = false

    async function refreshFrame() {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const res = (await window.api.invoke(IpcChannels.IOS_SIMULATOR_SCREENSHOT, udid)) as
          | { ok: true; data: string }
          | { ok: false; error?: string }
        if (cancelled) return
        if (res.ok) {
          const src = `data:image/png;base64,${res.data}`
          frameRef.current = src
          setFrame(src)
          setStatus('streaming')
          setFailReason('')
        } else {
          setFailReason(res.error ?? 'unknown error')
          setStatus('failed')
        }
      } catch (err) {
        if (!cancelled) {
          setFailReason(err instanceof Error ? err.message : String(err))
          setStatus('failed')
        }
      } finally {
        inFlight = false
      }
    }

    setStatus('starting')
    setFailReason('')
    frameRef.current = ''
    setFrame('')
    void refreshFrame()
    const interval = setInterval(refreshFrame, 750)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [udid])

  useEffect(() => {
    if (!screenshotRequest || !frameRef.current) return
    const a = document.createElement('a')
    a.href = frameRef.current
    a.download = `screenshot-${Date.now()}.png`
    a.click()
  }, [screenshotRequest])

  function norm(e: React.MouseEvent): { x: number; y: number } | null {
    const el = imageRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  function handleDown(e: React.MouseEvent) {
    const pos = norm(e)
    if (!pos) return
    startRef.current = pos
  }

  async function handleUp(e: React.MouseEvent) {
    const start = startRef.current
    const end = norm(e)
    startRef.current = null
    if (!start || !end) return
    try {
      const dist = Math.hypot(end.x - start.x, end.y - start.y)
      const res = dist >= TAP_THRESHOLD
        ? await window.api.invoke(IpcChannels.IOS_SIMULATOR_SWIPE, {
            udid,
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            durationMs: 400,
          })
        : await window.api.invoke(IpcChannels.IOS_SIMULATOR_TAP, {
            udid,
            x: start.x,
            y: start.y,
          })
      if ((res as { ok?: boolean; error?: string })?.ok === false) {
        setFailReason((res as { error?: string }).error ?? 'input failed')
        setStatus('failed')
      }
    } catch (err) {
      setFailReason(err instanceof Error ? err.message : String(err))
      setStatus('failed')
    }
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50 text-xs px-4 text-center">
        <WifiOff className="w-8 h-8" />
        <span>iOS Simulator mirror unavailable</span>
        {failReason && (
          <span className="text-muted-foreground/40 font-mono text-[10px] max-w-xs break-all">
            {failReason}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full w-full bg-black/40 p-2 select-none relative">
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 text-xs">
          <Smartphone className="w-10 h-10 animate-pulse" strokeWidth={1} />
          <span>Starting simulator mirror...</span>
        </div>
      )}
      {frame && (
        <img
          ref={imageRef}
          src={frame}
          alt="iOS simulator mirror"
          draggable={false}
          onMouseDown={handleDown}
          onMouseUp={handleUp}
          className="max-h-full max-w-full object-contain rounded-2xl cursor-crosshair shadow-2xl"
        />
      )}
    </div>
  )
}
