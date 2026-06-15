import { useRef, useState } from 'react'
import { Smartphone } from 'lucide-react'

interface Props {
  mjpegPort: number
  onTap: (x: number, y: number) => void
  onSwipe: (x1: number, y1: number, x2: number, y2: number) => void
}

// Below this drag distance (fraction of screen) a gesture counts as a tap.
const TAP_THRESHOLD = 0.02

export function DeviceMirror({ mjpegPort, onTap, onSwipe }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [failed, setFailed] = useState(false)

  function norm(e: React.MouseEvent): { x: number; y: number } | null {
    const el = imgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
  }

  function handleDown(e: React.MouseEvent) {
    startRef.current = norm(e)
  }

  function handleUp(e: React.MouseEvent) {
    const start = startRef.current
    const end = norm(e)
    startRef.current = null
    if (!start || !end) return
    const dist = Math.hypot(end.x - start.x, end.y - start.y)
    if (dist < TAP_THRESHOLD) {
      onTap(start.x, start.y)
    } else {
      onSwipe(start.x, start.y, end.x, end.y)
    }
  }

  // cache-bust so a reconnect re-opens the stream
  const src = `http://127.0.0.1:${mjpegPort}/?t=${mjpegPort}`

  return (
    <div className="flex items-center justify-center h-full w-full bg-black/40 p-2 select-none">
      {failed ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground/50 text-xs">
          <Smartphone className="w-8 h-8" />
          <span>Mirror stream unavailable on port {mjpegPort}</span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={src}
          alt="device mirror"
          draggable={false}
          onMouseDown={handleDown}
          onMouseUp={handleUp}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain rounded-2xl cursor-crosshair shadow-2xl"
        />
      )}
    </div>
  )
}
