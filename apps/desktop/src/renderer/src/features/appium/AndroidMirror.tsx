import { useRef, useEffect, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { ScrcpyVideoPacket } from '@jkauto/core'
import { Smartphone, WifiOff } from 'lucide-react'

const TAP_THRESHOLD = 0.02

interface Props {
  serial: string
  onTap: (x: number, y: number) => void
  onSwipe: (x1: number, y1: number, x2: number, y2: number) => void
}

interface DecoderState {
  decoder: VideoDecoder
  configRaw: Uint8Array
  codec: string
  configured: boolean
}

export function AndroidMirror({ serial, onTap, onSwipe }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const stateRef = useRef<DecoderState | null>(null)
  const streamingRef = useRef(false)
  const [status, setStatus] = useState<'starting' | 'streaming' | 'failed'>('starting')

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function makeDecoder(): VideoDecoder {
      return new VideoDecoder({
        output: (frame) => {
          if (cancelled || !canvas) { frame.close(); return }
          if (canvas.width !== frame.displayWidth) canvas.width = frame.displayWidth
          if (canvas.height !== frame.displayHeight) canvas.height = frame.displayHeight
          ctx.drawImage(frame, 0, 0)
          frame.close()
          if (!streamingRef.current) { streamingRef.current = true; setStatus('streaming') }
        },
        error: () => { if (!cancelled) setStatus('failed') },
      })
    }

    function handlePacket(raw: unknown) {
      if (cancelled) return
      const packet = raw as ScrcpyVideoPacket

      if (packet.type === 'configuration') {
        if (stateRef.current) {
          try { stateRef.current.decoder.close() } catch { /* ignore */ }
          stateRef.current = null
        }
        if (!packet.codec) return
        stateRef.current = {
          decoder: makeDecoder(),
          configRaw: packet.data,
          codec: packet.codec,
          configured: false,
        }
        return
      }

      const state = stateRef.current
      if (!state || state.decoder.state === 'closed') return

      if (packet.keyframe) {
        if (state.decoder.decodeQueueSize > 0) {
          state.decoder.reset()
          state.configured = false
        }
        if (!state.configured) {
          state.decoder.configure({
            codec: state.codec,
            optimizeForLatency: true,
            hardwareAcceleration: 'no-preference',
          })
          state.configured = true
          // Annex B: prepend SPS/PPS to first IDR frame
          const combined = new Uint8Array(state.configRaw.length + packet.data.length)
          combined.set(state.configRaw, 0)
          combined.set(packet.data, state.configRaw.length)
          state.decoder.decode(new EncodedVideoChunk({ type: 'key', timestamp: 0, data: combined }))
          return
        }
      }

      if (!state.configured) return

      state.decoder.decode(
        new EncodedVideoChunk({
          type: packet.keyframe === false ? 'delta' : 'key',
          timestamp: 0,
          data: packet.data,
        }),
      )
    }

    void window.api.invoke(IpcChannels.SCRCPY_START, { serial })
    const off = window.api.on(IpcChannels.SCRCPY_VIDEO_PACKET, handlePacket)

    const timeout = setTimeout(() => {
      if (!cancelled && !streamingRef.current) setStatus('failed')
    }, 12000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      off()
      void window.api.invoke(IpcChannels.SCRCPY_STOP)
      if (stateRef.current) {
        try { stateRef.current.decoder.close() } catch { /* ignore */ }
        stateRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial])

  function norm(e: React.MouseEvent): { x: number; y: number } | null {
    const el = canvasRef.current
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

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50 text-xs">
        <WifiOff className="w-8 h-8" />
        <span>Scrcpy stream unavailable for {serial}</span>
        <span className="text-muted-foreground/30">Check adb connection &amp; restart IDE</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full w-full bg-black/40 p-2 select-none relative">
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 text-xs">
          <Smartphone className="w-10 h-10 animate-pulse" strokeWidth={1} />
          <span>Starting scrcpy…</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseUp={handleUp}
        className="max-h-full max-w-full object-contain rounded-2xl cursor-crosshair shadow-2xl"
        style={{ display: status === 'starting' ? 'none' : 'block' }}
      />
    </div>
  )
}
