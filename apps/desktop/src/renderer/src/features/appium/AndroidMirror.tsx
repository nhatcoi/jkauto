import { useRef, useEffect, useState, useCallback } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { ScrcpyVideoPacket } from '@jkauto/core'
import { Smartphone, WifiOff } from 'lucide-react'

const TAP_THRESHOLD = 0.02

interface Props {
  serial: string
  screenshotRequest?: number
}

interface DecoderState {
  decoder: VideoDecoder
  configRaw: Uint8Array
  codec: string
  configured: boolean
}

export function AndroidMirror({ serial, screenshotRequest = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const stateRef = useRef<DecoderState | null>(null)
  const streamingRef = useRef(false)
  const videoDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const [status, setStatus] = useState<'starting' | 'streaming' | 'failed'>('starting')
  const [failReason, setFailReason] = useState('')

  const injectTouch = useCallback(
    async (action: 0 | 1 | 2, nx: number, ny: number, pressure: number) => {
      const { w, h } = videoDimsRef.current
      if (!w || !h) return
      await window.api.invoke(IpcChannels.SCRCPY_INJECT_TOUCH, {
        action,
        x: Math.round(nx * w),
        y: Math.round(ny * h),
        width: w,
        height: h,
        pressure,
      })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function makeDecoder(): VideoDecoder {
      return new VideoDecoder({
        output: (frame) => {
          if (cancelled || !canvas) { frame.close(); return }
          if (canvas.width !== frame.displayWidth) {
            canvas.width = frame.displayWidth
            videoDimsRef.current.w = frame.displayWidth
          }
          if (canvas.height !== frame.displayHeight) {
            canvas.height = frame.displayHeight
            videoDimsRef.current.h = frame.displayHeight
          }
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

    void (async () => {
      const res = (await window.api.invoke(IpcChannels.SCRCPY_START, { serial })) as
        | { ok: true }
        | { ok: false; error: string }
      if (!res.ok && !cancelled) {
        setFailReason(res.error ?? 'unknown error')
        setStatus('failed')
      }
    })()
    const off = window.api.on(IpcChannels.SCRCPY_VIDEO_PACKET, handlePacket)

    const timeout = setTimeout(() => {
      if (!cancelled && !streamingRef.current) {
        setFailReason('Timeout — no video frames received after 12s')
        setStatus('failed')
      }
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

  useEffect(() => {
    if (!screenshotRequest || status !== 'streaming') return
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `screenshot-${Date.now()}.png`
    a.click()
  }, [screenshotRequest, status])

  function norm(e: React.MouseEvent): { x: number; y: number } | null {
    const el = canvasRef.current
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
    void injectTouch(0, pos.x, pos.y, 1)
  }

  function handleUp(e: React.MouseEvent) {
    const start = startRef.current
    const end = norm(e)
    startRef.current = null
    if (!start || !end) return
    const dist = Math.hypot(end.x - start.x, end.y - start.y)
    if (dist >= TAP_THRESHOLD) {
      // swipe: send move then up at end position
      void injectTouch(2, end.x, end.y, 1).then(() => injectTouch(1, end.x, end.y, 0))
    } else {
      void injectTouch(1, start.x, start.y, 0)
    }
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50 text-xs px-4 text-center">
        <WifiOff className="w-8 h-8" />
        <span>Scrcpy unavailable for <span className="font-mono">{serial}</span></span>
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
