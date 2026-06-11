• Dưới đây là plan tổng để phát triển JKAuto AI Agent real, có chat thật, đọc context app, đề xuất/sửa
  test case, và có đường nâng cấp lên MCP.

  Mục Tiêu
  Agent trong RightPanel không chỉ chat, mà hỗ trợ thực tế:

  - Chat với local OpenAI-compatible endpoint:
    http://localhost:3000/v1/chat/completions

  - Hiểu context hiện tại của app: project, active file, test case, run logs, problems.
  - Gợi ý sửa test case, object selector, timeout, expected value.
  - Có thể apply thay đổi qua tool an toàn.
  - Sau này bọc tool layer thành MCP-compatible server/client.

  Kiến Trúc Tổng
  Luồng chính:

  Renderer AgentPanel
    -> IPC agent:chat
    -> Electron main agent.handler
    -> Agent service gọi LLM local
    -> Nếu có tool request:
         gọi internal JKAuto tools
         validate schema
         apply patch / run test / read logs
    -> trả message về UI

  Không để renderer gọi API key trực tiếp.

  Cấu Trúc File Đề Xuất

  apps/desktop/src/
  ├─ main/
  │  ├─ handlers/
  │  │  ├─ agent.handler.ts              # IPC agent:chat, agent:tool-apply
  │  │  ├─ engine.handler.ts             # đã có run/debug real
  │  │  └─ run.handler.ts                # đã có run history
  │  │
  │  ├─ services/
  │  │  └─ agent/
  │  │     ├─ agent.service.ts           # orchestrate chat + tool calls
  │  │     ├─ llm-client.ts              # gọi /v1/chat/completions
  │  │     ├─ prompt.ts                  # system prompt JKAuto agent
  │  │     ├─ context-builder.ts         # build context app hiện tại
  │  │     ├─ tool-runner.ts             # dispatch tool calls
  │  │     ├─ tools.ts                   # tool definitions
  │  │     └─ safety.ts                  # validate, permission, safe/confirm mode
  │  │
  │  └─ index.ts                         # registerAgentHandlers(ipcMain)
  │
  ├─ renderer/src/
  │  ├─ components/layout/
  │  │  └─ RightPanel.tsx                # chỉ render <AgentPanel />
  │  │
  │  ├─ features/
  │  │  └─ agent/
  │  │     ├─ AgentPanel.tsx             # UI chính
  │  │     ├─ MessageList.tsx
  │  │     ├─ ChatInput.tsx
  │  │     ├─ ToolCallCard.tsx           # hiển thị tool/action/diff
  │  │     ├─ AgentDiffPreview.tsx       # before/after khi sửa file
  │  │     ├─ api.ts                     # invoke IPC
  │  │     ├─ store.ts                   # Zustand chat/session state
  │  │     ├─ types.ts                   # AgentMessage, ToolCall, Patch
  │  │     └─ prompts.ts                 # prompt UI presets nếu cần
  │
  packages/core/src/
  ├─ ipc-contract.ts                     # thêm AGENT_* channels/types
  └─ schemas/
     └─ agent.ts                         # Zod schema cho messages/tools/patch

  IPC Channels Cần Thêm
  Trong packages/core/src/ipc-contract.ts:

  AGENT_CHAT: 'agent:chat',
  AGENT_APPLY_PATCH: 'agent:apply-patch',
  AGENT_GET_CONTEXT: 'agent:get-context',
  AGENT_CANCEL: 'agent:cancel',

  Payload chính:

  interface AgentChatPayload {
    messages: AgentMessage[]
    mode: 'suggest' | 'confirm' | 'auto'
    activeFilePath?: string
    activeProjectPath?: string
  }

  interface AgentChatResult {
    message: AgentMessage
    toolCalls?: AgentToolCall[]
    patches?: AgentPatch[]
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }

  Agent Tools V1
  Tool nội bộ nên bắt đầu với nhóm an toàn:

  get_project_context
  get_active_test_case
  get_run_logs
  get_problems
  suggest_test_case_patch
  apply_test_case_patch
  insert_test_steps
  update_test_step
  run_test_case

  V1 chưa cần MCP thật ngay. Làm internal tools trước để ổn định schema và quyền sửa.

  Agent Tools V2
  Mở rộng:

  read_object_repository
  update_object_locator
  create_test_case
  create_object_file
  import_curl_as_request
  generate_api_assertions
  debug_failed_step
  rerun_failed_test

  MCP V3
  Sau khi internal tools ổn:

  packages/
  └─ agent-mcp/
     ├─ package.json
     ├─ src/
     │  ├─ server.ts
     │  ├─ tools/
     │  │  ├─ test-case.ts
     │  │  ├─ object-repository.ts
     │  │  ├─ runner.ts
     │  │  └─ project.ts
     │  └─ schemas.ts

  Tool internal hiện tại có thể được bọc lại thành MCP tools. Electron main có thể gọi trực tiếp internal
  tool runner hoặc qua MCP client.

  Phân Kỳ Phát Triển
  M1: Chat real

  - Tạo features/agent.
  - Tạo agent.handler.ts.
  - Gọi endpoint local bằng API key.
  - Hiển thị messages/loading/error.
  - RightPanel render agent thật.

  M2: Context real

  - Agent nhận project context.
  - Nhận active file/test case.
  - Nhận run logs/problems.
  - Trả lời dựa trên trạng thái thật của app.

  M3: Suggest patch

  - Agent tạo patch sửa test case.
  - UI hiển thị before/after.
  - User bấm Apply.
  - Validate schema trước khi ghi file.

  M4: Auto fix loop

  - User: “fix test đang fail”.
  - Agent đọc logs.
  - Đọc test case.
  - Sửa step.
  - Run lại.
  - Báo pass/fail.

  M5: MCP-compatible

  - Chuẩn hóa tools.
  - Tách tool definitions.
  - Có thể export thành MCP server riêng.

  Chế Độ An Toàn
  Nên có 3 mode:

  Suggest: chỉ gợi ý, không sửa.
  Confirm: tạo patch, user duyệt rồi apply.
  Auto: tự sửa các thay đổi safe, vẫn hỏi khi delete/overwrite lớn.

  Mặc định nên dùng Confirm.

  Ưu Tiên Làm Trước
  Tôi đề xuất thứ tự code:

  1. AgentPanel UI real.
  2. agent.handler.ts gọi local LLM.
  3. agent.service.ts, llm-client.ts.
  4. Build context từ app state.
  5. Tool get_active_test_case, get_run_logs.
  6. Patch preview + apply test case patch.
  7. Auto fix loop.

  Kết quả sau phase đầu: RightPanel có chat real, hỏi được mọi thứ về app và test đang mở. Sau phase
  patch: agent bắt đầu tự sửa test case có kiểm soát.
