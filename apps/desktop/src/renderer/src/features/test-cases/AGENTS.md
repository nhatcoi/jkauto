# test-cases feature

## Purpose
Table-based editor for `.test.json` files. Each file = one TestCase with ordered Steps. Steps execute via Playwright engine in Electron main process.

## File structure
```
test-cases/
├── TestCaseEditor.tsx       # root component (full editor + run controls)
├── keywords.ts              # renderer-side keyword metadata (UI only)
├── types.ts                 # TestCase, TestStep interfaces
├── utils/                   # (reserved)
└── components/
    ├── StepRow.tsx          # one table row per step (inline editing)
    ├── StepContextMenu.tsx  # right-click menu on a step row
    ├── RunHistoryPanel.tsx  # collapsible history panel below table
    └── ImportStepsDialog.tsx # import steps from another test file
```

## Data model
```typescript
// types.ts
interface TestStep {
  id: string            // stable UUID, never changes on rename
  keyword: string       // e.g. 'navigate-to', 'click', 'assert-text'
  description: string
  objectRef: string     // CSS selector or object-repo ref
  input: string         // URL / text to type / option value / key name
  expected: string      // assertion expected value
  enabled: boolean
  continueOnFailure: boolean
  timeout: number | null  // ms; null = default 30 000
}
interface TestCase {
  schemaVersion: number
  id: string
  name: string
  description: string
  steps: TestStep[]
}
```

## Keywords (renderer metadata — `keywords.ts`)
Controls which columns are active in StepRow. Maps `id` → `{ label, color, hasObject, hasInput, hasExpected, ...placeholders }`.

| id | label | object | input | expected |
|----|-------|--------|-------|----------|
| navigate-to | Navigate To | ✗ | URL | ✗ |
| click | Click | ✓ selector | ✗ | ✗ |
| type-text | Type Text | ✓ selector | ✓ text | ✗ |
| clear-text | Clear Text | ✓ selector | ✗ | ✗ |
| assert-text | Assert Text | ✓ selector | ✗ | ✓ expected text |
| assert-url-contains | Assert URL | ✗ | ✗ | ✓ substring |
| assert-visible | Assert Visible | ✓ selector | ✗ | ✗ |
| assert-hidden | Assert Hidden | ✓ selector | ✗ | ✗ |
| wait-for-element | Wait For Element | ✓ selector | timeout ms | ✗ |
| wait-ms | Wait | ✗ | ✓ ms | ✗ |
| hover | Hover | ✓ selector | ✗ | ✗ |
| select-option | Select Option | ✓ selector | ✓ value | ✗ |
| press-key | Press Key | ✗ | ✓ key name | ✗ |
| scroll-to | Scroll To | ✓ selector | ✗ | ✗ |
| get-text | Get Text | ✓ selector | ✗ | ✗ |

Engine keywords live in `packages/engine/src/keywords/registry.ts` — richer set (aliases, check/uncheck, take-screenshot, assert-element-value, etc). Renderer list is a subset for UI metadata only.

## TestCaseEditor — state
```
tc: TestCase | null           — loaded from filePath
selectedIdx: number | null    — selected row
draggedIdx / dragOverIdx      — DnD state
clipboard: Partial<TestStep>  — copy/cut buffer
contextMenu: { x, y, stepIdx }
showHistory: boolean
showImport: boolean
```
Uses `useRunStore` for run state (not local). Run state is global — only one test case runs at a time.

## Toolbar actions
| Button | Condition | Action |
|--------|-----------|--------|
| Add Step | always | append default `click` step |
| Import Steps | always | open ImportStepsDialog |
| ↑ / ↓ | step selected | swap adjacent steps |
| Run | not running | save → load profile env vars → ENGINE_RUN_CASE (debugMode=false) |
| Debug | not running | same but debugMode=true (pauses after each step) |
| Next Step | running + debug + paused | ENGINE_DEBUG_NEXT |
| Stop | running | ENGINE_STOP → stopRun() |
| History | always | toggle RunHistoryPanel |
| Save | always | FS_WRITE_FILE + markTabDirty(false) |

## Run flow
1. Auto-save before run (`FS_WRITE_FILE`)
2. Load active profile env vars via `readEnv(projectPath/profiles/<activeProfile>.env.json)`
3. `invoke(ENGINE_RUN_CASE, { filePath, debugMode, profileVariables })`
4. Main process streams `ENGINE_STEP_EVENT` per step → `handleStepEvent()` updates `stepStatuses[idx]`
5. `ENGINE_RUN_COMPLETE` → `handleRunComplete()` → persist record via `ENGINE_SAVE_RUN`

## Interpolation in engine
Engine (`packages/engine/src/runner.ts`) supports both:
- `{{varName}}` — app-wide convention (preferred)
- `${varName}` — legacy fallback

## Step DnD
HTML5 drag events. `draggedIdx` tracked in state. `onDrop` splices steps array. No external DnD library.

## Context menu (right-click on row)
- Insert Before / Insert After
- Copy / Cut / Paste Before / Paste After
- Toggle Continue on Failure
- Delete
Clipboard is local component state (`Partial<TestStep>`). UUIDs regenerated on paste.

## Run history (RunHistoryPanel)
- Loaded on mount via `ENGINE_GET_RUNS` (reads `.autotest/runs/<slug>.json`)
- After each run completes, record appended in-memory + persisted via `ENGINE_SAVE_RUN`
- Panel: max-height 208px, collapsible rows, shows status/date/duration/step counts
- Toggle with History button in toolbar

## Keyboard shortcuts
- `Ctrl/Cmd+S` — save

## IPC channels used
| Channel | Direction | Purpose |
|---------|-----------|---------|
| FS_READ_FILE | invoke | load .test.json |
| FS_WRITE_FILE | invoke | save |
| ENGINE_RUN_CASE | invoke | start run → returns { runId } |
| ENGINE_STOP | invoke | abort run |
| ENGINE_DEBUG_NEXT | invoke | advance one step in debug mode |
| ENGINE_STEP_EVENT | on (push) | step status update |
| ENGINE_RUN_COMPLETE | on (push) | run finished |
| ENGINE_GET_RUNS | invoke | load run history |
| ENGINE_SAVE_RUN | invoke | persist run record |
