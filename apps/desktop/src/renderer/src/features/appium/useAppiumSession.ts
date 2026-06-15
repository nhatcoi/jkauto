import { useState, useCallback, useEffect } from 'react'
import { IpcChannels } from '@jkauto/core'
import type {
  AppiumSessionInfo,
  AppiumSessionStartPayload,
  AppiumSessionStartResult,
  AppiumDeviceEntry,
} from '@jkauto/core'

export interface InteractionLogEntry {
  id: string
  time: string
  message: string
  kind: 'info' | 'action' | 'error'
}

function now() {
  return new Date().toISOString().slice(11, 19)
}

export function useAppiumSession() {
  const [session, setSession] = useState<AppiumSessionInfo | null>(null)
  const [devices, setDevices] = useState<AppiumDeviceEntry[]>([])
  const [connecting, setConnecting] = useState(false)
  const [log, setLog] = useState<InteractionLogEntry[]>([])

  const addLog = useCallback((message: string, kind: InteractionLogEntry['kind'] = 'info') => {
    setLog((prev) => [
      ...prev.slice(-200),
      { id: crypto.randomUUID(), time: now(), message, kind },
    ])
  }, [])

  const refreshDevices = useCallback(async () => {
    const d = (await window.api.invoke(IpcChannels.APPIUM_SESSION_DEVICES)) as AppiumDeviceEntry[]
    setDevices(d)
    return d
  }, [])

  const refreshStatus = useCallback(async () => {
    const s = (await window.api.invoke(IpcChannels.APPIUM_SESSION_STATUS)) as AppiumSessionInfo | null
    setSession(s)
  }, [])

  useEffect(() => {
    void refreshStatus()
    void refreshDevices()
  }, [refreshStatus, refreshDevices])

  const connect = useCallback(
    async (payload: AppiumSessionStartPayload) => {
      setConnecting(true)
      addLog(`Connecting to ${payload.deviceName} via WebDriverAgent…`)
      try {
        const res = (await window.api.invoke(
          IpcChannels.APPIUM_SESSION_START,
          payload,
        )) as AppiumSessionStartResult
        if (res.ok && res.session) {
          setSession(res.session)
          addLog('Connected', 'action')
          addLog('Streaming through local mirror', 'action')
        } else {
          addLog(`Connect failed: ${res.error ?? 'unknown error'}`, 'error')
        }
        return res
      } catch (err) {
        addLog(`Connect error: ${err instanceof Error ? err.message : String(err)}`, 'error')
        return { ok: false, error: String(err) } as AppiumSessionStartResult
      } finally {
        setConnecting(false)
      }
    },
    [addLog],
  )

  const disconnect = useCallback(async () => {
    await window.api.invoke(IpcChannels.APPIUM_SESSION_STOP)
    setSession(null)
    addLog('Disconnected')
  }, [addLog])

  const tap = useCallback(
    async (x: number, y: number) => {
      try {
        await window.api.invoke(IpcChannels.APPIUM_SESSION_TAP, { x, y })
        addLog(`tap (${x.toFixed(3)}, ${y.toFixed(3)})`, 'action')
      } catch (err) {
        addLog(`tap failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    },
    [addLog],
  )

  const swipe = useCallback(
    async (x1: number, y1: number, x2: number, y2: number) => {
      try {
        await window.api.invoke(IpcChannels.APPIUM_SESSION_SWIPE, { x1, y1, x2, y2 })
        addLog(
          `swipe (${x1.toFixed(3)},${y1.toFixed(3)}) → (${x2.toFixed(3)},${y2.toFixed(3)})`,
          'action',
        )
      } catch (err) {
        addLog(`swipe failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    },
    [addLog],
  )

  const getSource = useCallback(async () => {
    return (await window.api.invoke(IpcChannels.APPIUM_SESSION_SOURCE)) as string
  }, [])

  const clearLog = useCallback(() => setLog([]), [])

  return {
    session,
    devices,
    connecting,
    log,
    connect,
    disconnect,
    tap,
    swipe,
    getSource,
    refreshDevices,
    clearLog,
  }
}
