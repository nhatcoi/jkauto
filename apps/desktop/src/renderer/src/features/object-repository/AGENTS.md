# object-repository feature

## Purpose
REST API client for `.request.json` files (like Postman/Bruno). Supports sending HTTP requests, OpenAPI import, cURL import/export, env variable resolution, response history, and save-to-env auth chaining.

## File structure
```
object-repository/
├── RequestEditor.tsx         # root component — orchestrates all panels
├── ObjectEditor.tsx          # editor for .objects.json (multi-locator repo)
├── ImportOpenApiDialog.tsx   # import OpenAPI/Swagger spec dialog
├── api.ts                    # IPC call wrappers
├── types.ts                  # re-exports from @jkauto/core + AssertionResult
├── components/
│   ├── MethodUrlBar.tsx      # method select + URL input + Send/Save buttons
│   ├── KeyValueTable.tsx     # reusable key-value editor (params/headers)
│   ├── BodyEditor.tsx        # body type selector + editor (json/text/form)
│   ├── AuthPanel.tsx         # auth type selector (none/bearer/basic/api-key)
│   ├── AssertionsPanel.tsx   # test assertions editor + results display
│   ├── ResponsePanel.tsx     # Body/Headers/History tabs + → ENV panel
│   └── CurlImportDialog.tsx  # paste cURL → parse → fill request fields
├── hooks/
│   └── useRequestEditor.ts   # all request editor state and logic
└── utils/
    └── curl.ts               # parseCurl() and toCurl() utilities
```

## Data model (`@jkauto/core`)
```typescript
interface ApiRequest {
  schemaVersion: number
  id: string
  name: string
  description: string
  method: HttpMethod              // GET POST PUT PATCH DELETE HEAD OPTIONS
  url: string                     // supports {{varName}} template syntax
  params: KeyValueItem[]          // { key, value, enabled }
  headers: KeyValueItem[]
  auth: AuthConfig                // see below
  body: BodyConfig                // see below
  assertions: Assertion[]         // { id, target, op, expected, path? }
}

type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' }

type BodyConfig =
  | { type: 'none' }
  | { type: 'raw-json'; content: string }
  | { type: 'raw-text'; content: string }
  | { type: 'form-urlencoded'; items: KeyValueItem[] }
```

## useRequestEditor hook
Single source of truth for request editor state:
```typescript
{
  request: ApiRequest | null   // loaded from file
  error: string                // load error
  saving: boolean
  sending: boolean
  response: HttpResponse | null
  assertionResults: AssertionResult[]
  sendError: string
  history: RequestHistoryRecord[]   // last 30 sends, loaded on mount
  mutate(fn): void             // update request + mark tab dirty
  save(): Promise<void>        // write to disk
  send(): Promise<void>        // send request + eval assertions + save history
}
```

**send() flow:**
1. Load active profile vars via `readEnv(projectPath/profiles/<profile>.env.json)`
2. `invoke(HTTP_SEND_REQUEST, { request, profileVariables })`
3. Main resolves `{{var}}` in URL/headers/body/auth before fetching
4. Response → `setResponse` + `evaluateAssertions` + append to `history` state + `HTTP_HISTORY_SAVE` (fire-and-forget)

## Variable resolution (`{{varName}}`)
- Resolved in **main process** just before fetch — never in renderer
- Source: active profile file `profiles/<name>.env.json` → `variables` record
- Switch active profile via status bar ENV button → EnvManagerDialog
- Unresolved vars left as `{{varName}}` (not stripped)

## Assertions engine (`evaluateAssertions` in useRequestEditor)
Runs client-side after each response:

| target | path needed | description |
|--------|-------------|-------------|
| status | ✗ | HTTP status code (string comparison) |
| response-time | ✗ | durationMs |
| header | path = header name | response header value |
| body-json-path | path = dot-notation | JSON body field (e.g. `data.token`) |

Operators: `eq`, `ne`, `contains`, `not-contains`, `exists`, `not-exists`, `lt`, `gt`

## cURL import/export (`utils/curl.ts`)
**parseCurl(raw: string):**
- Tokenizer handles: single-quoted strings, double-quoted strings, `$'...'` ANSI-C quoting, `\` line continuation
- Extracts: `-X` method, `-H` headers, `-d/--data-raw` body, `-u` basic auth
- Auto-detects body type: JSON (try parse) vs form-urlencoded (content-type header) vs raw-text
- Extracts Bearer/Basic from Authorization header → moves to `auth` field
- Parses query params from URL

**toCurl(request, vars):**
- Resolves `{{vars}}` first
- Builds: `curl -X METHOD 'url' \ -H '...' \ --data-raw '...'`
- Correct shell quoting: single-quote with `'\\''` escaping

**UI:** two small buttons in toolbar strip (below URL bar in RequestEditor):
- `Import cURL` → opens CurlImportDialog (paste + Ctrl+Enter to confirm)
- `Copy cURL` → clipboard + 2s "Copied!" feedback

## OpenAPI import (`ImportOpenApiDialog` + main `http.handler.ts`)
1. User provides URL or file path to OpenAPI/Swagger spec
2. Main: `SwaggerParser.dereference()` resolves all `$ref`
3. Collection folder: `targetDir/<info.title>/` — auto-increment if exists (`ECM API 2`, `ECM API 3`)
4. Tag-based subfolders: `<collection>/<tag-slug>/`
5. File per operation: `<method>-<path-slug>.request.json`
6. If no `servers`: URL set to `{{baseUrl}}/path`
7. Auth auto-detected from `securitySchemes` → fills `auth` field
8. Query params, path params, request body (JSON/form) all extracted

## Request history (`HTTP_HISTORY_GET` / `HTTP_HISTORY_SAVE`)
- Stored: `.autotest/request-history/<slug>.json` (max 30 per file)
- Slug derived from filename without extension
- Project root found by walking up dirs looking for `project.json`
- Loaded on mount in useRequestEditor, prepended after each send
- **History tab** in ResponsePanel: list shows status badge, method, timestamp, duration; click row → view that response body

## Save-to-Env (`→ ENV` in ResponsePanel)
- Appears only when response body is valid JSON
- Toggle `→ ENV` button in body tab toolbar
- Form: JSON dot-path (e.g. `data.accessToken`) + env var name (e.g. `authToken`)
- Live preview of extracted value updates as user types path
- Save: `readEnv(profilePath)` → merge → `writeEnv(profilePath, { ...existing, [varName]: value })`
- Use case: POST /login → copy `data.token` → `authToken` → use `{{authToken}}` in subsequent requests

## ResponsePanel tabs
| Tab | Content |
|-----|---------|
| Body | Formatted JSON (pretty-print) or raw text. `→ ENV` button when JSON. |
| Headers | Grid of response headers key/value |
| History | Chronological list of past sends for this file. Click → full response body |

## Explorer integration
- `.request.json` files show Globe icon in explorer tree
- Opening file → `openTab` → `MidPanel` renders `RequestEditor`
- Delete file → tab closed automatically (`closeTab`)
- Rename file → tab path updated (`renameTab`)
- Rename folder → all tabs under that path updated (`renameTabsUnderPath`)

## IPC channels used
| Channel | Direction | Purpose |
|---------|-----------|---------|
| FS_READ_FILE | invoke | load .request.json |
| FS_WRITE_FILE | invoke | save |
| HTTP_SEND_REQUEST | invoke | send HTTP request (main resolves vars, fetches) |
| HTTP_IMPORT_OPENAPI | invoke | parse spec + create .request.json files |
| HTTP_HISTORY_GET | invoke | load history records for a file |
| HTTP_HISTORY_SAVE | invoke | persist one history record |
| ENV_READ | invoke | read profile variables |
| ENV_WRITE | invoke | write profile variables (save-to-env) |

## Known design decisions
- Vars resolved in **main process only** (not renderer) — keeps renderer pure, avoids timing issues with profile switching
- History stored as JSON files not SQLite — simpler, no migration needed, consistent with project FS-first approach
- AssertionResults computed **client-side** in renderer (no IPC round-trip needed)
- cURL tokenizer custom-written (no dependencies) to handle edge cases from browser DevTools copy (ANSI-C quoting)
