# explorer feature

## Purpose
Left-panel file tree for all open projects. Renders project folders as collapsible sections (`ProjectSection`) each containing a virtualized `react-arborist` tree (`ExplorerTree`). Supports file/folder CRUD, drag-drop, rename, per-feature context menus.

## File structure
```
explorer/
├── ProjectSection.tsx   # per-project header + context menu + collapse toggle
├── ExplorerTree.tsx     # react-arborist tree with per-feature context menus, rename, DnD
├── NewItemDialog.tsx    # name input dialog for new file/folder
├── useExplorerTree.ts   # loads tree via FS_TREE, watches for changes via FS_WATCH_*
└── utils.ts             # randomUUID helper
```

## Recent changes
- **Project context menu:** Replaced `DropdownMenu` (hover button trigger) with `ContextMenu` (right-click on full header row). Items: Set as Active, Duplicate, Open Containing Folder, Project Settings, Remove from Workspace.
- **Set as Active:** `setActiveProject(path)` action added to `project.store` — directly sets `activeProjectPath`/`activeProject`, active project shows violet dot indicator in header.
- **Duplicate project:** `PROJECT_DUPLICATE` IPC channel — copies project folder via `fs.cp`, generates new UUID + appends " Copy" to name, writes updated `project.json`, adds to workspace.
- **Remove from Workspace confirm dialog:** `Dialog` with project name + "files stay on disk" note before `removeProject()`.
- **ProjectSettingsDialog icon picker:** Added icon picker grid (same options as NewProjectDialog). `UpdateProjectPayload` extended with `icon?: string`. Main handler persists `icon` field on update.
