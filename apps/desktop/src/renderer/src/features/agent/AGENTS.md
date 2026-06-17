# Agent Feature — Architecture & Logic

## Tổng quan

Agent panel là chatbot AI embedded trong JKAuto. Kiến trúc 4 lớp:

```
Layer 1: Chat Sessions     — SQLite per-project, persistent across restarts
Layer 2: Message History   — full history in DB, trim to last 20 for LLM
Layer 3: Context Snapshot  — live app state + active file + project files
Layer 4: Artifacts/Actions — extract apply-steps blocks, log tool calls
```

## Sơ đồ kiến trúc

```
┌─────────────────────────────── RENDERER ───────────────────────────────────┐
│                                                                              │
│  AgentPanel.tsx                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  SessionHeader ── [Ask▾] New chat · 10:32          [ask] [+] [🗑]   │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  MessageList                                                          │   │
│  │   • user: "thêm bước assert-text vào login test"                    │   │
│  │   • assistant: "Đây là steps đã cập nhật:"                          │   │
│  │     ```apply-steps [...]```  ← [Apply] button                        │   │
│  │   • [typing bubble: "▊"] ← streamingContent accumulate               │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  ChatInput  [type here…]                           [Cmd+Enter ▶]    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  session.store (Zustand)          store (Zustand)                           │
│  ├─ sessions[]                    ├─ messages[]                             │
│  ├─ activeSessionId               ├─ streamingContent                       │
│  ├─ artifacts[]                   ├─ sendState                              │
│  └─ actions[]                     └─ error / usage                          │
│                                                                              │
└──────────────┬──────────────────────────────────┬───────────────────────────┘
               │ IPC invoke: AGENT_CHAT            │ IPC push: AGENT_STREAM_CHUNK
               │ payload: { messages,              │   chunk: "thêm bước..."
               │   context, sessionId }            │   → appendStreamChunk()
               ▼                                   │
┌─────────────────────────────── MAIN PROCESS ───────────────────────────────┐
│                                                  │                           │
│  agent.handler.ts                                │                           │
│  └─ chatWithAgent(payload, settings, onChunk ───►┘                          │
│                                                                              │
│  agent.service.ts  chatWithAgent()                                           │
│  ├─ 1. buildAgentContext(snapshot)                                           │
│  │       context-builder.ts                                                  │
│  │       ├─ serialize AgentContextSnapshot (project, tabs, run, logs)        │
│  │       └─ readFile(activeTab) if .test.json/.yaml (max 18 000 chars)      │
│  │                                                                            │
│  ├─ 2. resolve/create Session                                                │
│  │       session.service.ts ──► agent-db.ts (better-sqlite3)                │
│  │       DB: <project>/.autotest/agent.db                                    │
│  │       ┌──────────────────┐  ┌─────────────────┐                          │
│  │       │ agent_sessions   │  │ agent_messages  │                          │
│  │       │ agent_artifacts  │  │ agent_actions   │                          │
│  │       └──────────────────┘  └─────────────────┘                          │
│  │                                                                            │
│  ├─ 3. getSessionMessages()  → full history from DB                          │
│  │      saveMessage(user)    → persist user msg                              │
│  │                                                                            │
│  ├─ 4. buildProjectContext(projectPath)                                       │
│  │       project-context.ts                                                   │
│  │       ├─ keywords/*.keywords.{json,yaml}  (≤5 files × 4 000 chars)        │
│  │       ├─ test-cases/*.test.*              (names only)                    │
│  │       └─ profiles/*.env.json             (≤5 files × 4 000 chars)        │
│  │                                                                            │
│  ├─ 5. McpManager.setup()                                                    │
│  │       ┌─────────────────┬──────────────────────┬─────────────────────┐   │
│  │       │  jkauto MCP     │  filesystem MCP       │  playwright MCP     │   │
│  │       │  (in-process)   │  (npx stdio)          │  (npx stdio)        │   │
│  │       │  jkauto tools   │  read/write files     │  browser control    │   │
│  │       │                 │  scoped: projectPath  │  Chromium via npx   │   │
│  │       └─────────────────┴──────────────────────┴─────────────────────┘   │
│  │       editMode filter:                                                     │
│  │         ask            → hide write_file/edit_file/delete_file/...        │
│  │         auto           → expose all tools                                 │
│  │         auto-with-rollback → expose all + backup file before each write   │
│  │                              to .autotest/agent-backups/<sessionId>/      │
│  │                                                                            │
│  └─ 6. streamAgentChat()                                                     │
│          llm-client.ts                                                        │
│          ┌────────────────────────────────────────────────────────────┐      │
│          │ streamText(                                                 │      │
│          │   model: createOpenAI({ fetch: filteredFetch })(model)     │      │
│          │   system: [mode prompt]─[session memory]─[project ctx]     │      │
│          │            ─[app state]─[skill files]                      │      │
│          │   messages: history.slice(-20) → ModelMessage[]            │      │
│          │   tools: dynamicTool() × N MCP tools                       │      │
│          │   maxSteps: 20   ← agentic loop                            │      │
│          │ )                                                           │      │
│          │  fullStream → text-delta → part.text                       │      │
│          │   └─ onChunk(text) → AGENT_STREAM_CHUNK push               │      │
│          │  error-delta → throw                                        │      │
│          │  tool-call → McpManager.callTool() → tool-result           │      │
│          └────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  Post-LLM:                                                                   │
│  ├─ saveMessage(assistant, content + metadata{model,usage,toolCalls})        │
│  ├─ extractApplyStepsArtifacts() → regex ```apply-steps → JSON.parse        │
│  │   └─ saveArtifact() → agent_artifacts                                    │
│  └─ updateSession(updated_at)                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

System prompt layers (join by ---):
  ┌────────────────────────────────────────────────────┐
  │ 1. Mode prompt (ask / edit / debug / generate-test) │
  │ 2. Session memory  (session.summary if set)         │
  │ 3. Project context (keywords + test names + profiles│
  │ 4. App state       (snapshot JSON + active file)    │
  │ 5. Skills          (injected .md files)             │
  └────────────────────────────────────────────────────┘

Session modes:
  ask           → suggest only, apply-steps for review, NO write tools
  edit          → direct file write via MCP, apply-steps optional
  debug         → diagnose run failures, rank hypotheses, fix steps
  generate-test → generate full scenario test case from description
```


BASE:
 -Renderer (AgentPanel) ──IPC──▶ Main (agent.handler.ts)
        9 -                                      │
       10 -                          agent.service.ts (chatWithAgent)
       11 -                                      │
       12 -                          llm-client.ts (streamAgentChat)
       13 -                                      │
       14 -                        @ai-sdk/openai + Vercel AI SDK (streamText)
       15 -                                      │
       16 -                          McpManager (mcp-manager.ts)
       17 -                         ┌────────────┼─────────────┐
       18 -                    jkauto-mcp   filesystem MCP   playwright MCP
       19 -                   (in-process)  (npx stdio)     (npx stdio)


---

## File Map

### Renderer (UI)

| File | Vai trò |
|------|---------|
| `AgentPanel.tsx` | Root component, orchestrate UI + submit flow + edit mode toggle |
| `SessionHeader.tsx` | Dropdown chọn/tạo/đổi tên/xóa session, switch mode |
| `MessageList.tsx` | Render messages, detect `apply-steps` blocks, nút Apply |
| `ChatInput.tsx` | Textarea + Cmd+Enter submit |
| `session.store.ts` | Zustand: sessions, activeSessionId, artifacts, actions |
| `store.ts` | Zustand: messages, sendState, streamingContent, error, usage |
| `api.ts` | `sendAgentMessage()` → IPC `AGENT_CHAT` |
| `types.ts` | Re-export types từ `@jkauto/core` |

### Main Process (Backend)

| File | Vai trò |
|------|---------|
| `agent.handler.ts` | Register IPC handlers cho tất cả `AGENT_*` channels |
| `agent.service.ts` | Orchestration: resolve session → load history → call LLM → save results |
| `session.service.ts` | CRUD operations on `agent.db` (better-sqlite3) |
| `agent-db.ts` | Singleton DB per project path, khởi tạo 4 tables |
| `llm-client.ts` | `streamAgentChat()` — Vercel AI SDK v6, streamText, dynamicTool |
| `mcp-manager.ts` | Quản lý multiple MCP clients, filter write tools theo editMode, backup files |
| `mcp-client.ts` | Raw MCP client wrapper (McpClient class, StdioClientTransport) |
| `prompt.ts` | System prompts per mode (ask/edit/debug/generate-test) |
| `project-context.ts` | Đọc `keywords/`, `test-cases/`, `profiles/` vào string context |
| `context-builder.ts` | Đọc active tab file + serialize renderer snapshot |

---

## Flow: User gửi message

```
Renderer                         Main Process
─────────                        ────────────
1. AgentPanel.handleSubmit()
   ├─ createMessage('user', content, sessionId)
   ├─ addMessage() → store (hiện ngay)
   ├─ startStreaming() → showingSpinner
   └─ sendAgentMessage(payload)
        │  IPC: AGENT_CHAT
        ▼
2. agent.handler.ts
   ├─ getSettings() → editMode, mcpServers, skillPaths
   └─ chatWithAgent(payload, settings, onChunk)
        │  mỗi onChunk: event.sender.send(AGENT_STREAM_CHUNK, chunk)
        ▼
3. agent.service.chatWithAgent()
   ├─ buildAgentContext(snapshot)        → context.summary (app state + active file)
   ├─ loadSkills(skillPaths)             → skills[]
   ├─ resolve session từ DB (hoặc tạo mới nếu không có)
   ├─ getSessionMessages() từ DB         → full history (source of truth)
   ├─ saveMessage(user msg) vào DB
   ├─ buildProjectContext(projectPath)   → keywords + test names + profiles
   ├─ McpManager.setup(projectPath, servers, editMode, sessionId)
   │    ├─ addInProcess('jkauto', createJkautoMcpClient)
   │    ├─ addStdio('filesystem', '@modelcontextprotocol/server-filesystem', projectPath)
   │    └─ addStdio('playwright', '@playwright/mcp@latest', '--browser chromium')
   ├─ streamAgentChat(messages, context, projectCtx, sessionSummary, mode, manager, skills)
   │    └─ [xem LLM layer]
   ├─ saveMessage(assistant msg + metadata) vào DB
   ├─ extractApplyStepsArtifacts(content) → save vào agent_artifacts
   └─ updateSession(updated_at)

        │  result: AgentChatResult
        ▼
4. Renderer nhận
   ├─ finalizeStream() → streamingContent = null
   ├─ addMessage(result.message) → message list
   ├─ setMetadata(model, usage)
   └─ refreshArtifacts(projectPath, sessionId)
```

### Streaming chunks

```
Main:     event.sender.send(AGENT_STREAM_CHUNK, textChunk)
              ↓ IPC push
Renderer: window.api.on(AGENT_STREAM_CHUNK, chunk => appendStreamChunk(chunk))
              → store.streamingContent += chunk
              → UI render typing bubble với accumulated content
```

---

## LLM Layer (llm-client.ts)

```typescript
streamText({
  model: createOpenAI({ baseURL, apiKey, fetch: createFilteredFetch() })(model),
  system: buildSystemPrompt(mode, contextSummary, projectContext, sessionSummary, skills),
  messages: buildMessages(history),   // slice(-20) → ModelMessage[]
  tools: buildMcpTools(manager),      // dynamicTool() per MCP tool
  maxSteps: 20,                       // agentic loop rounds
})
```

**System prompt** (join bằng `\n\n---\n\n`):
1. Mode-specific base prompt (`prompt.ts`)
2. Session memory (`session.summary` nếu có)
3. Project context (keywords, test names, profiles)
4. Current app state (renderer snapshot JSON + active file content)
5. Skill files (nội dung từ `skillPaths`)

**Message trimming**: `slice(-20)` trước khi gửi LLM. Full history lưu DB.

**Filtered fetch**: `TransformStream` lọc `data: null` lines khỏi SSE stream trước khi AI SDK parse — fix parse error do local proxy emit null events.

**`dynamicTool()`**: MCP tools có schema dynamic ở runtime → dùng `dynamicTool()` (không phải `tool()`). `tool<Record<string,unknown>>` không fit `ToolSet = Record<string, Tool<never,never>>` → TypeScript overload mismatch. `dynamicTool` thiết kế cho trường hợp này.

**AI SDK v6 API notes**:
- `ModelMessage` (không phải `CoreMessage` — không export)
- `part.text` trên `text-delta` event (không phải `part.textDelta`)
- `tc.toolName` + `tc.input` trong `onStepFinish` (không phải `name`/`args`)
- `usage.inputTokens` / `usage.outputTokens` (không phải `promptTokens`/`completionTokens`)
- Iterate `result.fullStream` thay vì `result.textStream` — tránh `AI_NoOutputGeneratedError` khi response là tool-only

---

## MCP Layer (mcp-manager.ts)

3 MCP servers khởi động mỗi khi `chatWithAgent` chạy:
- `jkauto` — in-process client, tools nội bộ JKAuto
- `filesystem` — `@modelcontextprotocol/server-filesystem`, scoped tới `projectPath`
- `playwright` — `@playwright/mcp@latest`, Chromium browser automation

**Edit mode** kiểm soát filesystem write tools:

| Edit Mode | Write tools visible to LLM | File backup |
|-----------|----------------------------|-------------|
| `ask` | Không (filter ra khỏi tool list) | Không |
| `auto` | Có | Không |
| `auto-with-rollback` | Có | Đọc file gốc, lưu vào `.autotest/agent-backups/<sessionId>/<ts>-<filename>` |

Write tools bị filter: `write_file`, `edit_file`, `create_directory`, `move_file`, `delete_file`.

**Edit mode toggle** (AgentPanel header pill): `ask` → `auto` → `auto-with-rollback` → `ask`. Lưu vào `app-settings.agent.editMode` → persist sang disk.

---

## Session Layer

**DB**: `<projectPath>/.autotest/agent.db` (better-sqlite3, WAL mode, foreign keys ON)

**4 tables**:
```sql
agent_sessions (id, project_path, title, mode, status, summary, active_tab_path, created_at, updated_at)
agent_messages (id, session_id, role, content, metadata_json, created_at)
agent_artifacts(id, session_id, type, content_json, target_path, created_at)
agent_actions  (id, session_id, type, status, payload_json, result_json, backup_path, created_at)
```

**Session lifecycle**:
- `status`: `'active'` | `'archived'` (soft delete — không hard delete)
- Delete từ UI → `updateSession({ status: 'archived' })`
- `listSessions()`: filter `status != 'deleted'`, limit 50, order `updated_at DESC`

**Auto-create**: khi project mở, nếu không có session active → tự tạo session `mode='ask'`.

**Session modes** + system prompt:
| Mode | LLM behavior | MCP write |
|------|-------------|-----------|
| `ask` | Suggest only, dùng apply-steps cho review | Không (ask editMode) |
| `edit` | Write files trực tiếp qua MCP khi được yêu cầu | Có nếu editMode=auto |
| `debug` | Diagnose run failures, rank hypotheses, propose fixes | Có nếu editMode=auto |
| `generate-test` | Generate full test case từ mô tả scenario | Có nếu editMode=auto |

**Session store** (`session.store.ts`): Zustand. Renderer owns display state; on session switch, fetch messages từ DB qua `AGENT_SESSION_MESSAGES` IPC.

---

## Context Layer

**`buildAgentContext(snapshot)`** (context-builder.ts) — runtime:
- Serialize `AgentContextSnapshot` (project info, open tabs, run state, logs/events)
- Đọc content active file nếu là `.test.json/.test.yaml` (max 18 000 chars)

**`buildProjectContext(projectPath)`** (project-context.ts) — static:
- `keywords/*.keywords.{json,yaml}` — max 5 files × 4 000 chars
- `test-cases/*.test.{json,yaml}` — chỉ liệt kê tên file (không đọc content)
- `profiles/*.env.json` — max 5 files × 4 000 chars

---

## Artifact Layer

**apply-steps format** trong LLM response:
````
```apply-steps
[{ "keyword": "navigate-to", "input": "/login", ... }]
```
````

`extractApplyStepsArtifacts()` regex-parse JSON, lưu vào `agent_artifacts` (`type='apply-steps'`, `target_path` = active tab path lúc chat).

**Apply flow** (`AgentPanel.handleApplySteps`):
1. `FS_READ_FILE` → đọc file test case hiện tại
2. Parse JSON/YAML
3. Normalize steps: add `id` (UUID), default `enabled=true`, `continueOnFailure=false`, `timeout=null`
4. Replace toàn bộ `steps` array
5. Serialize lại sang YAML
6. `FS_WRITE_FILE` → ghi file
7. `triggerTabReload(path)` → editor reload

---

## IPC Channels

| Channel | Direction | Handler |
|---------|-----------|---------|
| `AGENT_CHAT` | invoke | `chatWithAgent` |
| `AGENT_STREAM_CHUNK` | push main→renderer | `appendStreamChunk` |
| `AGENT_GET_CONTEXT` | invoke | `getAgentContext` |
| `AGENT_CANCEL` | invoke | stub (placeholder) |
| `AGENT_SESSION_LIST` | invoke | `listAgentSessions` |
| `AGENT_SESSION_CREATE` | invoke | `createAgentSession` |
| `AGENT_SESSION_UPDATE` | invoke | `updateAgentSession` |
| `AGENT_SESSION_DELETE` | invoke | soft delete via `updateSession` |
| `AGENT_SESSION_MESSAGES` | invoke | `getSessionMessages` |
| `AGENT_SESSION_ARTIFACTS` | invoke | `getSessionArtifacts` |
| `AGENT_SESSION_ACTIONS` | invoke | `getSessionActions` |

---

## Settings

`app-settings.ts` → `settings.agent`:
```typescript
{
  editMode: 'ask' | 'auto' | 'auto-with-rollback'  // default: 'ask'
  baseUrl?: string        // LLM endpoint, default: 127.0.0.1:20128/v1
  apiKey?: string
  model?: string
  mcpServers?: McpServerConfig[]   // thêm vào 3 built-in servers
  skillPaths?: string[]             // markdown files inject vào system prompt
}
```

---

## Known Constraints

- **Electron 32 bundles Node 20**: `node:sqlite` không hoạt động (cần Node 22.5+) → dùng `better-sqlite3` (native module, cần `electron-rebuild` sau install)
- **AI SDK v6 breaking changes**: xem notes ở LLM layer
- **SSE null filter**: local LLM proxy emit `data: null` → lọc bằng `TransformStream` trong `createFilteredFetch()`
- **`dynamicTool` vs `tool()`**: MCP tools phải dùng `dynamicTool()` — xem LLM layer
