# agent-test feature

Workspace for configuring an AI-assisted QA run from the Explorer — JKAuto's "AI QA Engineer".

Opened from the top-level `agent-test` Explorer folder, rendered in the center panel via `AGENT_TEST_TAB_PATH`.

## Current scope

Config-only. The feature builds an agent harness, a deterministic preview plan, and local draft artifacts. It does **not** launch a real agent, MCP server, or test engine yet.

The user configures:

- **Test type:** `exploratory`, `regression`, `smoke`, `bug-reproduce`, `api`, `performance`, `accessibility`, `security`
- **Harness:** goal, scope, constraints
- **Target app:** url, port, platform (`web`/`android`/`ios`/`desktop`), username/password
- **Agent:** `auto`, `codex`, `claude-code`
- **Engine:** `playwright`, `appium`, `maestro`
- **Strategy:** `happy-path`, `negative`, `boundary`, `exploratory`, `chaos`, `risk-based`, `full-coverage`
- **Skills / MCP:** `browser-control`, `screenshot`, `video-record`, `file-editor`, `terminal`, `api-client`, `database`, `git`
- **Run mode:** `generate-only`, `generate-review`, `generate-execute`, `execute-existing`, `autonomous-qa`
- **Agent drafts (outputs):** `test-cases`, `test-suites`, `api-requests`, `bug-reports`, `suggestions`
- **QA team pipeline:** `planner` → `test-writer` → `executor` → `reporter` (toggle roles)
- **Templates:** one-click presets (Web Smoke, Mobile Regression, API Security, Accessibility, Exploratory QA)

## Files

```text
agent-test/
├── AGENTS.md
├── AgentTestView.tsx              # orchestrator (header + aside + main layout)
├── types.ts                       # all feature types
├── constants.ts                   # option arrays + templates
├── utils.ts                       # pure helpers + draft content builders
├── hooks/
│   └── useAgentTestConfig.ts      # state controller: load/save/plan/createOutputs
└── components/
    ├── primitives.tsx             # PanelSection, Field, SummaryItem, OptionGrid
    ├── TemplatesBar.tsx
    ├── HarnessPanel.tsx           # target / scope / constraints / agent / engine
    ├── StrategyRunPanel.tsx       # test-type / strategy / run-mode / skills / drafts
    ├── QaTeamFlow.tsx             # multi-agent pipeline viz
    ├── PlanPreview.tsx
    └── ResultDashboard.tsx        # empty-state until runtime is wired
```

State + IPC live in `useAgentTestConfig`. View and components are presentational.

## Explorer integration

Top-level folder `agent-test`. Related wiring (unchanged):

- `features/explorer/ExplorerTree.tsx` — shows `agent-test` with a `Bot` icon, opens the `Agent Test` tab
- `components/layout/MidPanel.tsx` — maps `AGENT_TEST_TAB_PATH` to `AgentTestView`
- `shared/keymaps.ts` — exports `AGENT_TEST_TAB_PATH`
- `main/handlers/project.handler.ts` — creates `agent-test` for new projects
- `main/handlers/fs.handler.ts` — auto-creates `agent-test` for existing projects during tree load
- `packages/core/src/schemas/app-settings.ts` — adds `agent-test` to default Explorer order and aliases

## Persisted config

Saved/loaded at `.autotest/agent-test.config.json` via `FS_CREATE_DIR` / `FS_WRITE_FILE` / `FS_READ_FILE`.

```ts
interface AgentTestConfig {
  testType: TestType
  targetApp: { url; port; platform; username; password }
  harness: { goal; scope; constraints }
  agent: 'auto' | 'codex' | 'claude-code'
  engines: EngineId[]
  strategy: StrategyId
  skills: SkillId[]
  runMode: RunModeId
  drafts: DraftId[]
  qaTeam: AgentRole[]
  updatedAt: string
}
```

(Full unions in `types.ts`.) Load merges parsed config over `defaultConfig()` so older/partial files stay valid.

## Output artifacts

`Create drafts` writes the selected `drafts`:

| Draft | Path |
|---|---|
| `test-cases` | `test-cases/agent-drafts/<slug>.test.yaml` (opened in editor) |
| `test-suites` | `test-cases/agent-drafts/<slug>.suite.yaml` |
| `api-requests` | `api-request/agent-drafts/<slug>.request.json` |
| `bug-reports` | `.autotest/agent-output/<slug>.bug-report.md` |
| `suggestions` | `.autotest/agent-output/<slug>.suggestions.md` |

Content builders are in `utils.ts`. Platform maps `android`/`ios` → `mobile`; runner = `maestro` > `appium` > `playwright`.

## Execution plan

`buildPlan(config)` (in `utils.ts`) creates a deterministic preview from test type, strategy, skills, and drafts. No LLM/MCP call. Strategy-specific probes added for `boundary` / `negative` / `chaos`.

## Runtime status

Not yet implemented: launching Codex/Claude Code, MCP calls, running Playwright/Appium/Maestro, real screenshots/video, real auto-fix diffs, severity classification, the Result Dashboard numbers.

## Intended next step

Add an agent-test runtime service in Electron main:

```text
renderer AgentTestView -> IPC agent-test:run -> main service -> agent CLI/API -> engine/MCP -> output writer
```

Suggested channels: `AGENT_TEST_RUN`, `AGENT_TEST_STOP`, `AGENT_TEST_EVENT`, `AGENT_TEST_GET_RUNS`.
Suggested service: `apps/desktop/src/main/services/agent-test/` (service, runner, mcp-capabilities, output-writer).

Keep `AgentTestView.tsx` focused on configuration, preview, and approval. Execution belongs in main.
