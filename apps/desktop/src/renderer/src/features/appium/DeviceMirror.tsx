import { useRef, useState } from 'react'
import { Smartphone } from 'lucide-react'
import type { AppiumSessionInfo } from '@jkauto/core'
import { AndroidMirror } from './AndroidMirror'

interface Props {
  session: AppiumSessionInfo
  onTap: (x: number, y: number) => void
  onSwipe: (x1: number, y1: number, x2: number, y2: number) => void
}

const TAP_THRESHOLD = 0.02

/** iOS mirror via WDA MJPEG stream. */
function MjpegMirror({
  mjpegPort,
  onTap,
  onSwipe,
}: {
  mjpegPort: number
  onTap: Props['onTap']
  onSwipe: Props['onSwipe']
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [failed, setFailed] = useState(false)

  function norm(e: React.MouseEvent) {
    const el = imgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }

  function handleDown(e: React.MouseEvent) { startRef.current = norm(e) }
  function handleUp(e: React.MouseEvent) {
    const start = startRef.current
    const end = norm(e)
    startRef.current = null
    if (!start || !end) return
    const dist = Math.hypot(end.x - start.x, end.y - start.y)
    if (dist < TAP_THRESHOLD) onTap(start.x, start.y)
    else onSwipe(start.x, start.y, end.x, end.y)
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full gap-2 text-muted-foreground/50 text-xs">
        <Smartphone className="w-8 h-8" />
        <span>MJPEG stream unavailable on port {mjpegPort}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full w-full bg-black/40 p-2 select-none">
      <img
        ref={imgRef}
        src={`http://127.0.0.1:${mjpegPort}/?t=${mjpegPort}`}
        alt="device mirror"
        draggable={false}
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain rounded-2xl cursor-crosshair shadow-2xl"
      />
    </div>
  )
}

/** Routes to AndroidMirror (screencap) or MjpegMirror (iOS WDA) by platform. */
export function DeviceMirror({ session, onTap, onSwipe }: Props) {
  if (session.platform === 'android') {
    const serial = session.udid ?? session.deviceName
    return <AndroidMirror serial={serial} onTap={onTap} onSwipe={onSwipe} />
  }
  return <MjpegMirror mjpegPort={session.mjpegPort} onTap={onTap} onSwipe={onSwipe} />
}
