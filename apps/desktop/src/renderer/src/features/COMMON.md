# Common — Shared Infrastructure Notes

- **MenuBar + AppDialogs:** Custom menubar row (`components/layout/MenuBar.tsx`) cho Windows/Linux; ẩn trên macOS (dùng native system menu). Dialogs app-level (NewProject, Settings, ProjectSettings, EnvManager) tập trung tại `AppDialogs.tsx`, trạng thái qua `store/ui-dialogs.store.ts`. macOS nhận native menu events qua `IpcChannels.MENU_EVENT` → `hooks/useMenuEvents.ts`. ExplorerTree lắng nghe `jkauto:refresh-explorer` CustomEvent để reload tree.
