# shared — renderer-wide hooks, keymaps, utilities

## Recent changes
- **`hooks/useHistory.ts`:** Generic undo/redo hook using `useReducer`. API: `setInitial(v)` (load/reset), `update(fn)` (mutate + push history), `undo()`, `redo()`, `clear()`, `canUndo`, `canRedo`. Hard limit 50 entries. Applied to TestCaseEditor, useSuite, useRequestEditor.
