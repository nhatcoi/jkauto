# PLAN — Platform Automation Test (Katalon-style IDE)

> Trạng thái: đã chốt **Electron**. Monorepo: pnpm + turborepo.

## 1. Tech stack

| Layer | Chọn | Lý do |
|---|---|---|
| Shell | **Electron** (chốt) | Cần FS access, "open containing folder", spawn process. Playwright + better-sqlite3 chạy native trên Node — cùng runtime, không cần sidecar |
| FE | React + Vite + TypeScript + shadcn/ui + Tailwind | Theo yêu cầu |
| Tree | `react-arborist` | Virtualized, drag-drop, rename inline, context menu |
| Resize panes | `react-resizable-panels` | Chuẩn shadcn ecosystem |
| State | Zustand + TanStack Query | Zustand cho UI state, Query cho data từ engine |
| Engine | Node (main process hoặc local service) + Playwright | Runner, FS, SQLite |
| SQLite | `better-sqlite3` | Sync API, nhanh, đúng cho cache/index/runs |
| Auth | Clerk | Sync project chỉ sau khi login |
| Schema | Zod | Validate project.json, test.json, suite.json — single source of truth, generate JSON Schema cho editor autocomplete |
| YAML | `yaml` package | Parse/stringify giữ comment |

**Quyết định nền tảng:** JSON/YAML = source of truth (git-friendly). SQLite chỉ là derived data (cache, index, run history) — xóa `.autotest/` rebuild lại được.

## 2. Project structure (file user tạo ra)

```
MyAutoTestProject/
├─ project.json              # name, type, repoUrl, description, format (json|yaml), schemaVersion
├─ profiles/
│  ├─ default.env.json
│  └─ staging.env.json
├─ test-cases/
│  └─ login-success.test.json
├─ object-repository/
│  └─ login-page.objects.json
├─ test-suites/
│  └─ smoke.suite.json
├─ keywords/
│  └─ auth.keywords.json
├─ reports/                  # <run-id>/ screenshots, html report
├─ data-files/
├─ checkpoints/
├─ plugins/
└─ .autotest/                # derived, gitignore
   ├─ cache.db
   ├─ index.db
   ├─ runs.db
   └─ workspace.json         # open_tabs, layout, selected file
```

Dialog khởi tạo project: name, type (web, mobile, desktop, api...), repo url, location, description, format (json/yaml) — Cancel / OK.

## 3. Monorepo structure

```
jkauto/
├─ apps/
│  ├─ desktop/              # Electron shell
│  │  ├─ main/              # main process: FS, dialog, spawn runner
│  │  ├─ preload/           # IPC bridge, typed contracts
│  │  └─ renderer/          # React app
│  └─ web/                  # (sau) web dashboard, Clerk, sync
├─ packages/
│  ├─ core/                 # domain: schemas (Zod), entities, không phụ thuộc gì
│  ├─ engine/               # Playwright runner, keyword executor
│  ├─ project-fs/           # đọc/ghi project files, JSON↔YAML adapter
│  ├─ storage/              # SQLite: runs.db, cache.db, index.db
│  └─ ui/                   # shared shadcn components
└─ turbo.json / pnpm-workspace.yaml
```

## 4. Clean architecture per feature (vertical slice)

```
renderer/src/features/
├─ project/          # init dialog, open, recent
├─ explorer/         # tree, context menu, file ops
├─ test-cases/       # table editor, step CRUD
├─ object-repository/# selector editor, capture
├─ test-suites/      # suite composer
├─ keywords/         # custom keyword manager
├─ execution/        # run, progress, live log
├─ reports/          # run history, step results
├─ bottom-panel/     # problems, console, event log
└─ agent/            # chatbot sinh test
```

Mỗi feature: `components/`, `hooks/`, `store.ts`, `api.ts` (IPC calls), `types.ts`. Feature không import internals của feature khác — chỉ qua public index.

**IPC contract:** typed qua 1 file `shared/ipc-contract.ts`, Zod validate 2 chiều. Renderer không bao giờ đụng FS trực tiếp.

## 5. UI layout

```
┌──────────────────────────────────────────────────┐
│ TitleBar: project name, run controls, user menu  │
├────────┬───────────────────────────┬─────────────┤
│ Left   │ Mid (tabs)                │ Right       │
│ Tree   │ ┌───────────────────────┐ │ Job progress│
│ explorer│ │ TestCase table editor│ │ ─────────── │
│        │ │ (steps: keyword,     │ │ AI Agent    │
│        │ │  object, input,      │ │ chat        │
│        │ │  expected)           │ │             │
│        │ ├───────────────────────┤ │             │
│        │ │ Bottom: Problems |   │ │             │
│        │ │ Console | Event Log  │ │             │
├────────┴───────────────────────────┴─────────────┤
│ StatusBar: env profile, run status, sync state   │
└──────────────────────────────────────────────────┘
```

- Panes resize tự do (`react-resizable-panels`), layout persist vào `.autotest/workspace.json`
- Mid = tab system, mỗi file 1 tab, dirty indicator
- Context menu tree: New Folder / New Test Case / New Suite / Rename / Copy / Delete / Open Containing Folder / Properties — định nghĩa per node-type (registry pattern, mỗi feature đăng ký menu items của nó)

## 6. Data model

### Test case step

```json
{
  "keyword": "type-text",
  "description": "Enter username",
  "objectRef": "LoginPage.usernameInput",
  "input": "admin",
  "expected": "",
  "enabled": true,
  "continueOnFailure": false,
  "timeout": null
}
```

### Object repository — multi-locator fallback

```json
{
  "name": "usernameInput",
  "locators": [
    { "strategy": "testid", "value": "username" },
    { "strategy": "css", "value": "#username" }
  ]
}
```

### Keyword registry

Built-in keywords (navigate-to, click, type-text, assert-text, wait-for...) định nghĩa bằng metadata: name, params schema (Zod), executor fn. Custom keywords trong `keywords/` compose từ built-ins. Registry feed autocomplete cho table editor + context cho AI agent.

### SQLite

```sql
test_runs(id, test_case_id, suite_id, profile, status, started_at, ended_at)
step_results(id, run_id, step_index, status, message, duration_ms, screenshot_path)
-- index.db: file_index(path, type, name, mtime) cho search nhanh
-- workspace.json: file thường, không cần SQLite
```

## 7. Execution engine

- Runner chạy **process riêng** (child process từ Electron main) — crash không sập IDE, kill được
- Flow: resolve suite/case → load profile env → resolve objectRefs → execute steps qua keyword registry → emit events (step-start, step-pass, step-fail, log, screenshot) qua IPC stream
- FE nghe event stream → update job progress pane + console realtime
- Kết quả ghi `runs.db` + screenshots vào `reports/<run-id>/`
- Profile env (`profiles/*.env.json`) inject vào input qua template `${baseUrl}/login`

## 8. Roadmap milestones

| # | Milestone | Nội dung | Status |
|---|---|---|---|
| M0 | Scaffold | Monorepo, Electron + Vite + shadcn, IPC typed contract, layout panes resize được | ✅ |
| M1 | Project lifecycle | Dialog init (name, type, repo url, location, description, format json/yaml), generate folder structure, open/recent project | ✅ |
| M2 | Explorer | react-arborist tree, watch FS (chokidar), context menu đầy đủ, file ops | ✅ |
| M3 | Test case editor | Table editor steps, keyword autocomplete, objectRef picker, save JSON/YAML, dirty/undo | ☐ |
| M4 | Engine v1 | Keyword registry ~15 built-ins, Playwright runner, chạy 1 test case, console + progress realtime | ☐ |
| M5 | Object repo + Suites | Object editor, multi-locator, suite composer, chạy suite | ☐ |
| M6 | Reports + SQLite | runs.db, run history view, step results, screenshots, problems pane | ☐ |
| M7 | Profiles + Data-driven | Env switching, data-files CSV/JSON binding vào steps | ☐ |
| M8 | Clerk + Sync | Login, chỉ sync khi login, project metadata lên cloud | ☐ |
| M9 | AI Agent | Chat pane, context = keyword registry + object repo, sinh test case draft, user review rồi save | ☐ |
| M10 | Polish | Recorder (Playwright codegen → steps), import/export, plugins API | ☐ |

## 9. Nguyên tắc đã chốt

1. **Schema versioning từ đầu** — `"schemaVersion": 1` trong mọi file. Migration sau đỡ đau.
2. **ID stable, name mutable** — rename test case không đổi `id`, suite ref bằng id không phải path.
3. **YAML/JSON quyết tại project level** (`project.json: "format"`), có convert command 2 chiều.
4. **Recorder để M10** — table editor + AI gen đủ value trước, recorder ngốn effort khủng.
5. **Engine v1 chỉ web** (Playwright). Type khác (mobile/desktop) = engine adapter interface từ đầu, implement sau (Appium...).
6. **AI agent output = JSON theo Zod schema** test case, không freetext — validate trước khi đưa vào editor.
