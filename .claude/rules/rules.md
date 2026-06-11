# Project Rules: jkauto

## Clean Code & Folder Structure
- **File Length Limits:** Strictly limit file sizes. Prefer keeping files under 300–400 lines. Proactively refactor and split files by extracting subcomponents, custom hooks, or helpers once they exceed this threshold.
- **Folder Organization:** Group files modularly by feature area. Separate components, custom hooks, types, APIs, and utility helpers into structured subfolders (e.g., `components/`, `hooks/`, `utils/`, `types.ts`).
- **Reusable UI Components:** Prefer reusing/building shared primitive UI elements under `components/ui/` (e.g., Buttons, Inputs, Dialogs) rather than rewriting custom markup in feature files.
- **Tailwind Styles:** Limit writing long inline Tailwind utility classes directly inside feature modules. Use shared UI components or extract style utilities where styles become excessive.
- **Typing:** Keep interfaces strictly typed. Avoid `any` types. Re-use types from `types.ts` rather than duplicating them.
- **Readability:** Keep functions small, focused on a single responsibility, and use descriptive naming for files, variables, and functions.

## Monorepo & Dependencies
- **ESM/CJS Interop:** `@jkauto/engine` is ESM and must be bundled by electron-vite (kept in `devDependencies` of `apps/desktop`). `@playwright/test` must be externalized (kept in runtime `dependencies`).
- **Node Environment:** Requires Node 22+ to support `node:sqlite`. Keep `@types/node` updated accordingly.

## Database & Runtime Files
- **SQLite Databases:** Do not commit temporary SQLite write-ahead logging files (`*.db-wal`, `*.db-shm`). Clean them up or ensure they are ignored.

## Commits & Git
- **Commit Granularity:** Separate refactorings, feature implementations, and test template updates into clean, structured commits.
