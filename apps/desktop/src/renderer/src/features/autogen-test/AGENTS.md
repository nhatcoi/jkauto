# autogen-test feature

- **AutogenPanel:** Main UI — 4-phase flow: idle (repo form) → indexing (progress) → selecting (target + type picker, tabs) → done (generated test preview). Auto-switches to results tab when generating.
- **useRepoIndex:** IPC `autogen:start-index` → clone + index, streams `autogen:index-progress`. Also `loadExisting()` on mount to restore from previous index session.
- **useTestGeneration:** IPC `autogen:generate` → streams `autogen:generate-progress` per targetId. Supports streaming buffer display before final JSON arrives.
- **store (Zustand):** Full `AutogenState` — repoUrl, status, progress, stack, codeMap, targets, selectedTargets, selectedTypes, generatedTests (with streamBuffer per test).
- **api.ts:** All IPC via `window.api.invoke` / `window.api.on` (preload bridge). No direct ipcRenderer import.
- **types.ts:** Local copies of indexer types (CodeMap, DetectedStack, etc.) — avoids bundling Node.js modules in renderer.
