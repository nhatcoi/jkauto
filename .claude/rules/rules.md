# Project Rules: jkauto

## Code Organization & Structure
- **Modularity:** Avoid large files (> 500 lines). Extract types, subcomponents (e.g., table rows, modals, context menus) into separate files in `components/`, `utils/`, or `types.ts`.
- **Reusable UI Components:** Prefer reusing/building shared primitive UI elements under `components/ui/` (e.g., Buttons, Inputs, Dialogs) rather than rewriting custom markup in feature files.
- **Tailwind Styles:** Limit writing long inline Tailwind utility classes directly inside feature modules. Use shared UI components or extract style utilities where styles become excessive.
- **Typing:** Keep interfaces strictly typed. Avoid `any` types. Re-use types from `types.ts` rather than duplicating them.

## Monorepo & Dependencies
- **ESM/CJS Interop:** `@jkauto/engine` is ESM and must be bundled by electron-vite (kept in `devDependencies` of `apps/desktop`). `@playwright/test` must be externalized (kept in runtime `dependencies`).
- **Node Environment:** Requires Node 22+ to support `node:sqlite`. Keep `@types/node` updated accordingly.

## Database & Runtime Files
- **SQLite Databases:** Do not commit temporary SQLite write-ahead logging files (`*.db-wal`, `*.db-shm`). Clean them up or ensure they are ignored.

## Commits & Git
- **Commit Granularity:** Separate refactorings, feature implementations, and test template updates into clean, structured commits.
