import { create } from 'zustand'

type DialogKey = 'newProject' | 'settings' | 'projectSettings' | 'envManager'

interface UiDialogsState {
  newProject: boolean
  settings: boolean
  projectSettings: boolean
  envManager: boolean
  open: (key: DialogKey) => void
  close: (key: DialogKey) => void
}

export const useUiDialogsStore = create<UiDialogsState>((set) => ({
  newProject: false,
  settings: false,
  projectSettings: false,
  envManager: false,
  open: (key) => set({ [key]: true }),
  close: (key) => set({ [key]: false }),
}))
