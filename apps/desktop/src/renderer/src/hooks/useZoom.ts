import { useEffect } from 'react'
import { IpcChannels } from '@jkauto/core'
import { useAppSettingsStore } from '@/store/app-settings.store'

const MIN = 0.5
const MAX = 3
const STEP = 0.1

export function useZoom() {
  const { settings, update, syncZoom } = useAppSettingsStore()
  const zoomFactor = settings?.appearance.zoomFactor ?? 1

  useEffect(() => {
    const unsub = window.api.on(IpcChannels.APP_ZOOM_CHANGED, (factor: unknown) => {
      syncZoom(factor as number)
    })
    return unsub
  }, [syncZoom])

  function setZoom(factor: number) {
    const clamped = Math.round(Math.min(MAX, Math.max(MIN, factor)) * 10) / 10
    update({ appearance: { ...settings!.appearance, zoomFactor: clamped } })
  }

  return {
    zoomPercent: Math.round(zoomFactor * 100),
    zoomFactor,
    zoomIn: () => setZoom(zoomFactor + STEP),
    zoomOut: () => setZoom(zoomFactor - STEP),
    reset: () => setZoom(1),
    setZoom,
    canZoomIn: zoomFactor < MAX,
    canZoomOut: zoomFactor > MIN,
  }
}
