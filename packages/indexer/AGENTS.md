# @jkauto/indexer package

Core codebase analysis package — runs in Electron main process only. Never import in renderer.

## Parsers

- **parsers/ast-ts.ts:** `@typescript-eslint/typescript-estree` AST — extracts `data-testid`, `aria-label`, `<input>` fields, component names from `.tsx/.jsx/.ts/.js`. Handles dynamic testid expressions (template literals, member expressions).
- **parsers/elements.ts:** Regex fallback for JSX elements — faster but misses dynamic attrs.
- **parsers/routes.ts:** Route extraction per framework — Next.js (app/ + pages/), React Router (path= regex), Angular (app-routing.module.ts).
- **parsers/openapi.ts:** `swagger-parser` → `ApiEndpoint[]` from OpenAPI/Swagger spec.
- **parsers/node-routes.ts:** Regex — Node backend route extraction (express/fastify/koa verb calls `app.get('/x')`, fastify `.route({method,url})`, NestJS `@Controller`+`@Get` decorators). Static fallback when no OpenAPI spec. `walkNodeRoutes(root, framework)`.
- **parsers/java.ts:** Regex — Spring `@GetMapping/@PostMapping` etc., class-level `@RequestMapping` base path.
- **parsers/go.ts:** Regex — Gin/Echo/Fiber/Chi route registration, stdlib `HandleFunc`.
- **parsers/python.ts:** Regex — Flask `@app.route`, FastAPI `@app.get/post`, Django `path()`.
- **parsers/rust.ts:** Regex — Actix `#[get]`, Axum `.route()`, Rocket `#[get=]`.

## Core modules

- **cloner.ts:** `simple-git` shallow clone (`--depth 1 --filter=blob:none`). Cache at `.autotest/repo-cache/<base64url-hash>`. Pull if `.git` exists.
- **detector.ts:** Detect framework + language from `package.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `composer.json`, `requirements.txt`. `findOpenApi` recursively scans (depth ≤4, skips build dirs) for `openapi/swagger/api-docs.{json,yaml}` — shallowest match wins (catches nested `API/openapi.json`).
- **indexer.ts:** Orchestrator — detect → routes → AST parse → lang-specific parse → OpenAPI → return `CodeMap`. Emits `IndexProgress` at each phase. `mergeEndpoints` unions OpenAPI (schemas) + static-parsed routes, normalizing `:id`↔`{id}` param syntax to dedupe.
- **context-builder.ts:** RAG context assembly. BM25-style keyword scoring. Token budget: 12k tokens. Top-K ranked chunks by relevance to user query.
- **OpenAPI parameters:** `parseOpenApi` now extracts query/path/header `parameters` (merging path-level + operation-level, deduped) into `ApiEndpoint.parameters` (`{name, in, required, type}`). Captures required query params like `/search?q=` that were previously dropped.
