# test-cases feature

## Purpose
Table-based editor for `.test.json` / `.test.yaml` files. Each file = one TestCase with ordered Steps. Steps execute via Playwright (web/mobile/desktop) or Appium (native mobile) engine in Electron main process.

## File structure
```
test-cases/
├── TestCaseEditor.tsx           # root component (full editor + run controls)
├── keywords.ts                  # fallback keyword resolver; full list comes over IPC
├── types.ts                     # TestCase, TestStep interfaces (renderer-local)
├── utils/
│   └── import-parser.ts         # parse imported step JSON/YAML files
├── hooks/
│   ├── useKeywords.ts           # fetch + cache engine keyword registry over IPC, filter by platform
│   └── useObjectItems.ts        # load .objects.json refs for objectRef autocomplete
└── components/
    ├── StepRow.tsx              # one table row per step (inline editing)
    ├── StepContextMenu.tsx      # right-click menu on a step row
    ├── RunHistoryPanel.tsx      # collapsible run history panel below table
    └── ImportStepsDialog.tsx    # import steps from another test file
```

## Data model (renderer `types.ts` — subset of `@jkauto/core` TestCaseSchema)
```typescript
interface TestStep {
  id: string              // stable UUID, never changes on rename
  keyword: string         // e.g. 'navigate-to', 'tap', 'assert-text'
  description: string
  objectRef: string       // CSS selector, accessibility ID, or object-repo ref
  input: string           // URL / text / distance px / option value / key name
  expected: string        // assertion expected value
  enabled: boolean
  continueOnFailure: boolean
  timeout: number | null  // ms; null = default 30 000
}
interface TestCase {
  schemaVersion: number
  id: string
  name: string
  description: string
  platform?: 'web' | 'mobile' | 'desktop' | 'api'  // overrides project.type
  device?: string    // mobile: "iPhone 14", "Pixel 7" etc; undefined = adapter default
  steps: TestStep[]
}
```

Full canonical schema: `packages/core/src/schemas/test-case.ts` (adds `tags`, `createdAt`, `updatedAt`).

## Platform + Device picker (toolbar)
- Platform select: `inherit | web | mobile | desktop | api`
  - `inherit` = use `activeProject.project.type` at runtime
  - Saved to `tc.platform` in file
- Device input (datalist, only shown when `platform === 'mobile'`):
  - Suggestions: iPhone 14/14 Pro/14 Plus/SE/13, Pixel 7/5, Galaxy S8/Tab S4, iPad gen7/Mini
  - Free text allowed (any Playwright device descriptor)
  - Saved to `tc.device`; forwarded to engine as `{ device }` in run payload

## Keyword system
Keywords NOT hardcoded in renderer — fetched from engine over IPC.
1. `useKeywords(platform?)` → calls `ENGINE_GET_KEYWORDS` once, caches module-wide.
2. List filtered by `k.platforms.includes(platform)` when platform provided.
3. `getKeyword(list, name)` returns match or `fallbackKeyword(name)` (generic, all columns active).
4. `StepRow` uses `kw.hasObject/hasInput/hasExpected` to enable/disable table columns.

## Full keyword set (engine, as of M4)

### Web / Desktop / Mobile-emulation
| id | label | object | input | expected |
|----|-------|--------|-------|----------|
| navigate-to | Navigate To | ✗ | URL | ✗ |
| click | Click | ✓ | ✗ | ✗ |
| type-text | Type Text | ✓ | ✓ text | ✗ |
| clear-text | Clear Text | ✓ | ✗ | ✗ |
| hover | Hover | ✓ | ✗ | ✗ |
| select-option | Select Option | ✓ | ✓ value | ✗ |
| press-key | Press Key | ✗ | ✓ key | ✗ |
| scroll-to | Scroll To | ✓ | ✗ | ✗ |
| get-text | Get Text | ✓ | ✗ | ✗ |
| assert-text | Assert Text | ✓ | ✗ | ✓ |
| assert-url-contains | Assert URL | ✗ | ✗ | ✓ substring |
| assert-visible | Assert Visible | ✓ | ✗ | ✗ |
| assert-hidden | Assert Hidden | ✓ | ✗ | ✗ |
| wait-for-element | Wait For Element | ✓ | timeout ms | ✗ |
| wait-ms | Wait | ✗ | ✓ ms | ✗ |

### Mobile-only (`platforms: ['mobile', 'appium']`)
| id | label | object | input | notes |
|----|-------|--------|-------|-------|
| tap | Tap | ✓ | ✗ | Playwright `page.tap()` or Appium driver |
| swipe-up | Swipe Up | ✗ | ✓ px | JS scroll or Appium touchAction |
| swipe-down | Swipe Down | ✗ | ✓ px | JS scroll or Appium touchAction |
| long-press | Long Press | ✓ | ✗ | Playwright touchscreen or Appium touchAction |

`mobile` = Playwright mobile emulation; `appium` = native iOS/Android via WebDriverIO.

## TestCaseEditor state
```
tc: TestCase | null              — loaded from filePath
platform: Platform               — tc.platform ?? activeProject.project.type
keywords: KeywordMeta[]          — useKeywords(platform), filtered by platform
selectedIdx: number | null       — selected row
draggedIdx / dragOverIdx         — DnD state
clipboard: Partial<TestStep>     — copy/cut buffer
contextMenu: { x, y, visible, stepIdx }
showHistory: boolean
showImport: boolean
```
`useRunStore` holds run state (global — only one run at a time).

## Toolbar actions
| Button | Condition | Action |
|--------|-----------|--------|
| Add Step | always | append default `click` step |
| Import Steps | always | open ImportStepsDialog |
| ↑ / ↓ | step selected | swap adjacent steps |
| Platform select | always | change tc.platform |
| Device input | platform=mobile | change tc.device |
| Run | not running | save → load profile env → ENGINE_RUN_CASE |
| Debug | not running | same + debugMode=true (pauses each step) |
| Next Step | running + debug + paused | ENGINE_DEBUG_NEXT |
| Stop | running | ENGINE_STOP → stopRun() |
| History | always | toggle RunHistoryPanel |
| Save | always | FS_WRITE_FILE + markTabDirty(false) |

## Run flow
1. Auto-save (`FS_WRITE_FILE`)
2. Load active profile: `readEnv(projectPath/profiles/<activeProfile>.env.json)`
3. `invoke(ENGINE_RUN_CASE, { filePath, debugMode, profileVariables, projectPath, device })`
4. Main streams `ENGINE_STEP_EVENT` per step → `stepStatuses[idx]`
5. `ENGINE_RUN_COMPLETE` → persist record via `ENGINE_SAVE_RUN`

## Step DnD
HTML5 drag events, no external lib. `draggedIdx` tracked, `onDrop` splices steps array.

## Context menu (right-click)
Insert Before/After, Copy, Cut, Paste Before/After, Toggle Continue on Failure, Delete.
Clipboard = local state; UUIDs regenerated on paste.

## Step detail bar (bottom, when step selected)
- Continue on failure checkbox
- Timeout (ms) input (null = 30 000ms default)

## Run history (RunHistoryPanel)
- Loaded on mount via `ENGINE_GET_RUNS`
- Appended after run via `ENGINE_SAVE_RUN` (`.autotest/runs/<slug>.json`)
- Panel: max-height 208px, collapsible rows, status/date/duration/step counts

## Keyboard shortcuts
| Action | Key |
|--------|-----|
| Save | Ctrl/Cmd+S |
| Add Step | Alt+A |
| Delete Step | Del (row selected) |
| Move Up/Down | Alt+↑/↓ |
| Duplicate | Alt+D |
| Run | F5 |
| Debug | F6 |
| Stop | Shift+F5 |

## IPC channels
| Channel | Direction | Purpose |
|---------|-----------|---------|
| FS_READ_FILE | invoke | load .test.json |
| FS_WRITE_FILE | invoke | save |
| ENGINE_GET_KEYWORDS | invoke | fetch keyword registry (cached module-wide) |
| ENGINE_RUN_CASE | invoke | start run → { runId } |
| ENGINE_STOP | invoke | abort |
| ENGINE_DEBUG_NEXT | invoke | advance one debug step |
| ENGINE_STEP_EVENT | on | step status update |
| ENGINE_RUN_COMPLETE | on | run finished |
| ENGINE_GET_RUNS | invoke | load run history |
| ENGINE_SAVE_RUN | invoke | persist run record |

## Design decisions
- Keyword metadata from engine over IPC, not hardcoded — engine is single source of truth.
- Platform stored per test-case file, not project — allows per-file platform override.
- Device picker = datalist (free text + suggestions) — not a fixed enum, new devices need no code change.
- `useKeywords(platform)` filters so dropdown shows only relevant keywords for current platform.
- `keywords.ts` only exports `fallbackKeyword()` — no longer hardcodes the list.

## Recent changes
- **Undo/Redo:** `tc` state migrated to `useHistory<TestCase>` hook. `mutate()` calls `history.update(fn)`. `setInitial()` resets stack on file load/save. `Cmd+Z` / `Cmd+Shift+Z` via `window` keydown listener (skips when focus in input). Undo/Redo buttons added to toolbar. Key files: `hooks/useHistory.ts`, `TestCaseEditor.tsx`.
