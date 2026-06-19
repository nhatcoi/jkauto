import { create } from 'zustand'

interface LayoutState {
  bottomCollapsed: boolean
  leftCollapsed: boolean
  rightCollapsed: boolean
  toggleBottom: () => void
  toggleLeft: () => void
  toggleRight: () => void
  setBottomCollapsed: (v: boolean) => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  bottomCollapsed: false,
  leftCollapsed: false,
  rightCollapsed: false,
  toggleBottom: () => set((s) => ({ bottomCollapsed: !s.bottomCollapsed })),
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setBottomCollapsed: (v) => set({ bottomCollapsed: v }),
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),
}))
