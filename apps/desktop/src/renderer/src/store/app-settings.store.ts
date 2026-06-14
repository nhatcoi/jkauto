import { create } from 'zustand'
import type { AppSettings } from '@jkauto/core'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'

interface AppSettingsStore {
  settings: AppSettings | null
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  syncZoom: (factor: number) => Promise<void>
}

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  settings: null,

  load: async () => {
    const settings = await invoke<AppSettings>(IpcChannels.APP_SETTINGS_GET)
    set({ settings })
    applyTheme(settings.appearance.theme)
    invoke(IpcChannels.APP_ZOOM_SET, settings.appearance.zoomFactor)
  },

  update: async (patch) => {
    const current = get().settings
    if (!current) return
    const merged: AppSettings = {
      ...current,
      ...patch,
      agent: { ...current.agent, ...patch.agent },
      execution: { ...current.execution, ...patch.execution },
      appearance: { ...current.appearance, ...patch.appearance },
      explorer: { ...current.explorer, ...patch.explorer },
    }
    const saved = await invoke<AppSettings>(IpcChannels.APP_SETTINGS_SET, merged)
    set({ settings: saved })
    if (patch.appearance?.theme) applyTheme(saved.appearance.theme)
    if (patch.appearance?.zoomFactor !== undefined) {
      invoke(IpcChannels.APP_ZOOM_SET, saved.appearance.zoomFactor)
    }
  },

  syncZoom: async (factor: number) => {
    const current = get().settings
    if (!current) return
    const merged: AppSettings = {
      ...current,
      appearance: { ...current.appearance, zoomFactor: factor },
    }
    const saved = await invoke<AppSettings>(IpcChannels.APP_SETTINGS_SET, merged)
    set({ settings: saved })
  },
}))

export function applyTheme(theme: AppSettings['appearance']['theme']) {
  const root = document.documentElement
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('light', !dark)
  } else {
    root.classList.toggle('light', theme === 'light')
  }
}
