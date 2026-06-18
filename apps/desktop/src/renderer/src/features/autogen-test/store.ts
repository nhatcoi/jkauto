import { create } from 'zustand'
import type { AutogenState, GenerateTarget, TestType, GeneratedTest, IndexProgress, CodeMap, DetectedStack } from './types'

interface AutogenStore extends AutogenState {
  setRepoUrl: (url: string) => void
  setProgress: (p: IndexProgress) => void
  setIndexResult: (stack: DetectedStack, map: CodeMap) => void
  setTargets: (targets: GenerateTarget[]) => void
  toggleTarget: (id: string) => void
  setTestTypes: (types: TestType[]) => void
  addGeneratedTest: (test: GeneratedTest) => void
  updateGeneratedTest: (targetId: string, patch: Partial<GeneratedTest>) => void
  streamChunk: (targetId: string, chunk: string) => void
  discardTest: (id: string) => void
  setStatus: (s: AutogenState['status'], error?: string) => void
  reset: () => void
}

const initial: AutogenState = {
  repoUrl: '',
  status: 'idle',
  progress: null,
  stack: null,
  codeMap: null,
  targets: [],
  selectedTargets: [],
  selectedTypes: ['e2e'],
  generatedTests: [],
  errorMessage: null,
}

export const useAutogenStore = create<AutogenStore>((set) => ({
  ...initial,

  setRepoUrl: (url) => set({ repoUrl: url }),

  setProgress: (progress) => set({ progress }),

  setIndexResult: (stack, codeMap) => {
    const targets: GenerateTarget[] = [
      ...codeMap.pages.map((p) => ({
        id: `page:${p.route}`,
        label: p.route,
        route: p.route,
        description: p.componentName,
      })),
      ...codeMap.endpoints.map((e) => ({
        id: `api:${e.method}:${e.path}`,
        label: `${e.method} ${e.path}`,
        endpoint: e.path,
        description: e.summary,
      })),
    ]
    set({ stack, codeMap, targets, status: 'selecting' })
  },

  setTargets: (targets) => set({ targets }),

  toggleTarget: (id) =>
    set((s) => ({
      selectedTargets: s.selectedTargets.includes(id)
        ? s.selectedTargets.filter((t) => t !== id)
        : [...s.selectedTargets, id],
    })),

  setTestTypes: (selectedTypes) => set({ selectedTypes }),

  addGeneratedTest: (test) =>
    set((s) => ({ generatedTests: [...s.generatedTests, test] })),

  updateGeneratedTest: (targetId, patch) =>
    set((s) => ({
      generatedTests: s.generatedTests.map((t) =>
        t.target.id === targetId ? { ...t, ...patch, streamBuffer: patch.status === 'draft' ? '' : t.streamBuffer } : t
      ),
    })),

  streamChunk: (targetId, chunk) =>
    set((s) => ({
      generatedTests: s.generatedTests.map((t) =>
        t.target.id === targetId ? { ...t, streamBuffer: (t.streamBuffer ?? '') + chunk } : t
      ),
    })),

  discardTest: (id) =>
    set((s) => ({ generatedTests: s.generatedTests.filter((t) => t.id !== id) })),

  setStatus: (status, errorMessage) => set({ status, errorMessage: errorMessage ?? null }),

  reset: () => set(initial),
}))
