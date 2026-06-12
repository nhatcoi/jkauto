# test-suites feature

## Purpose
Composer and runner for `.suite.json` files. Each suite references an ordered list of test cases by path + ID. Runs them sequentially via `ENGINE_RUN_SUITE`, streams per-case status back to UI.

## File structure
```
test-suites/
└── SuiteEditor.tsx    # single-file feature (composer + runner)
```

## Data model (`@jkauto/core` TestSuite schema)
```typescript
interface SuiteItem {
  testCaseId: string     // stable UUID from test case file
  testCasePath: string   // absolute path to .test.json
  enabled: boolean
  order: number          // 0-based; determines run order
}
interface TestSuite {
  schemaVersion: 1
  id: string
  name: string
  description: string
  profile: string           // profile name (e.g. 'default', 'staging')
  continueOnFailure: boolean
  items: SuiteItem[]
  createdAt: string         // ISO datetime
  updatedAt: string         // ISO datetime, updated on every mutate
}
```

Legacy format support: files with `testCaseIds: string[]` are normalized by `normalizeSuite()` on load — converts to `items[]` with `testCasePath = testCaseId`.

## SuiteEditor state
```
suite: TestSuite | null         — loaded from filePath
testCases: TestCaseOption[]     — all .test.json/.test.yaml in project tree (for picker)
selectedPath: string            — currently selected case in "Add Case" dropdown
selectedIdx: number | null      — selected row in suite list
sortedItems: SuiteItem[]        — memoized items sorted by .order
caseStatuses: Record<path, CaseStatus>  — per-case run status (idle/running/passed/failed/skipped)
caseMessages: Record<path, string>      — per-case error message on failure
saving: boolean
```

## Toolbar
| Element | Action |
|---------|--------|
| Name input | edit suite name |
| Profile input | change suite-level profile override |
| Continue on failure checkbox | toggle suite-level continueOnFailure |
| Test case dropdown | select case to add (lists all .test.json in project) |
| Add Case | append selected case to items (no-op if already present) |
| ↑ / ↓ | reorder selected item |
| Run Suite / Stop | start or abort suite run |
| Save | write to disk |

## Suite table columns
| Column | Content |
|--------|---------|
| Run (checkbox) | toggle item.enabled |
| Status icon | idle/running/passed/failed/skipped indicator |
| Order | 1-based index |
| Test Case | name resolved from testCases list (fallback: basename without extension) |
| Path | absolute path (truncated, monospace) |
| Delete | remove item, re-index order |

Double-click row → opens that test case in a new mid-panel tab.

## Run flow
1. Auto-save suite before run
2. Load profile env: `readEnv(projectPath/profiles/<profile>.env.json)` — uses `suite.profile` or `activeProfile` fallback
3. `invoke(ENGINE_RUN_SUITE, { filePath, profileVariables })`
4. Main streams `ENGINE_SUITE_EVENT`:
   - `case-start` → `caseStatuses[path] = 'running'`
   - `case-complete` → `caseStatuses[path] = status` (status='stopped' maps to 'skipped')
5. Main also streams `ENGINE_STEP_EVENT` per step → step-level failure propagates to case status
6. `ENGINE_RUN_COMPLETE` → `appendRunRecord` + `ENGINE_SAVE_RUN`

## Test case discovery
`loadTestCases()` calls `FS_TREE` on project root → `collectTestCasePaths()` recursively finds `*.test.json|yaml|yml` → reads each to extract `id + name` (fallback: basename). Sorted alphabetically.

## normalizeSuite (legacy compat)
Files may have `testCaseIds: string[]` (old format). `normalizeSuite()` converts:
```
testCaseIds → items[{ testCaseId: id, testCasePath: id, enabled: true, order: i }]
```
Auto-generates missing `id`, `name`, `description`, `profile`, `createdAt`, `updatedAt`.

## IPC channels
| Channel | Direction | Purpose |
|---------|-----------|---------|
| FS_READ_FILE | invoke | load .suite.json |
| FS_WRITE_FILE | invoke | save |
| FS_TREE | invoke | discover all test cases in project |
| ENGINE_RUN_SUITE | invoke | start suite run → { runId } |
| ENGINE_STOP | invoke | abort run |
| ENGINE_SUITE_EVENT | on | per-case start/complete events |
| ENGINE_STEP_EVENT | on | per-step events (for case-level failure tracking) |
| ENGINE_RUN_COMPLETE | on | run finished |
| ENGINE_SAVE_RUN | invoke | persist run record |

## Design decisions
- Suite references test cases by both `testCaseId` (stable) and `testCasePath` (for display/open). Resolution tries id first, then path.
- Profile can be set at suite level, overriding the project-level active profile — useful for running smoke suite on staging without changing global profile.
- `updatedAt` updated on every `mutate()` call automatically (not just on save).
- Case discovery reads all files in tree on mount — avoids stale list if cases added externally.
- No YAML support in suite files currently (JSON only). `.suite.yaml` would need a trivial extension to `loadSuite`.
