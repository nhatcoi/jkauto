# Contributing to JKAuto

Thank you for considering contributing to JKAuto. Contributions are welcome from everyone.

## Before You Start

- Check [open issues](https://github.com/nhatcoi/jkauto/issues) — your bug or feature may already be tracked.
- For large changes, open an issue first to discuss the approach before writing code.

## Development Setup

```bash
git clone https://github.com/nhatcoi/jkauto.git
cd jkauto
pnpm install
pnpm dev
```

Requires Node.js 22+ and pnpm 11+.

## Project Layout

```
apps/desktop/     Electron shell — main process, preload bridge, React renderer
packages/core/    Zod schemas + IPC contract (shared types — no runtime deps)
packages/engine/  Playwright runner + keyword executor (ESM)
packages/ui/      Shared shadcn components
```

**Key rules:**

- `packages/core` must have zero runtime dependencies — only `zod`.
- `@jkauto/engine` is ESM; keep it in `devDependencies` of `apps/desktop` so electron-vite bundles it.
- `@playwright/test` must stay in `dependencies` (runtime, not bundled).
- Renderer never touches the filesystem directly — all FS calls go through IPC channels defined in `packages/core/src/ipc-contract.ts`.
- File length limit: keep files under ~400 lines. Extract components, hooks, or helpers if exceeded.

## Making Changes

1. Fork the repo and create a feature branch from `main`.
2. Write your change. Keep commits focused — one logical change per commit.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) format:
   ```
   feat(explorer): add drag-and-drop reorder
   fix(engine): handle step timeout correctly
   refactor(core): extract schema validators
   ```
4. Run type checks before opening a PR:
   ```bash
   pnpm typecheck
   ```
5. Open a pull request against `main`. Fill in the PR template.

## Commit Scope Reference

| Scope | What it covers |
|---|---|
| `explorer` | File tree, context menu, FS ops |
| `test-cases` | Test case editor and step management |
| `test-suites` | Suite composer |
| `engine` | Playwright runner, keyword executor |
| `core` | Schemas, IPC contract |
| `appearance` | Theme, zoom, density settings |
| `keymaps` | Keyboard shortcuts |
| `agent` | AI chat pane |

## Code Style

- TypeScript strict mode — no `any`.
- Prefer named exports.
- No inline comments explaining *what* the code does — only *why* when non-obvious.
- Tailwind for styles; extract shared primitives to `packages/ui` rather than copying classes.

## Reporting Bugs

Open an issue with:
- OS and version
- Steps to reproduce
- Expected vs. actual behavior
- Console errors if any (DevTools → Console)

## License

By contributing, you agree your changes will be licensed under the [MIT License](LICENSE).
