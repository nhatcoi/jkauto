import { create } from 'zustand'

interface LayoutState {
  bottomCollapsed: boolean
  toggleBottom: () => void
  setBottomCollapsed: (v: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  bottomCollapsed: false,
  toggleBottom: () => set((s) => ({ bottomCollapsed: !s.bottomCollapsed })),
  setBottomCollapsed: (v) => set({ bottomCollapsed: v }),
}))
