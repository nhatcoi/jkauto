export const IpcChannels = {
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_OPEN_DIALOG: 'project:open-dialog',
  PROJECT_GET_RECENT: 'project:get-recent',
  PROJECT_GET_INFO: 'project:get-info',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_CREATE_FILE: 'fs:create-file',
  FS_LIST_DIR: 'fs:list-dir',
  FS_TREE: 'fs:tree',
  FS_CREATE_DIR: 'fs:create-dir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_COPY: 'fs:copy',
  FS_OPEN_CONTAINING_FOLDER: 'fs:open-containing-folder',
  FS_WATCH_START: 'fs:watch-start',
  FS_WATCH_STOP: 'fs:watch-stop',
  FS_WATCH_EVENT: 'fs:watch-event',

  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',

  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_SET: 'workspace:set',
  WORKSPACE_PROJECTS_GET: 'workspace:projects:get',
  WORKSPACE_PROJECTS_SET: 'workspace:projects:set',

  ENGINE_RUN_CASE: 'engine:run-case',
  ENGINE_RUN_SUITE: 'engine:run-suite',
  ENGINE_STOP: 'engine:stop',
  ENGINE_STEP_EVENT: 'engine:step-event',
  ENGINE_RUN_COMPLETE: 'engine:run-complete',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface CreateProjectPayload {
  name: string
  type: 'web' | 'mobile' | 'desktop' | 'api'
  description: string
  repoUrl: string
  location: string
  format: 'json' | 'yaml'
}

export interface UpdateProjectPayload {
  projectPath: string
  name: string
  type: 'web' | 'mobile' | 'desktop' | 'api'
  description: string
  repoUrl: string
}

export interface RecentProject {
  name: string
  path: string
  type: string
  openedAt: string
}

export interface FsEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  ext?: string
}

export interface FsTreeNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  ext?: string
  children?: FsTreeNode[]
}

export interface FsWatchEvent {
  eventType: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  path: string
}

export interface StepEvent {
  runId: string
  testCaseId: string
  stepIndex: number
  status: 'running' | 'passed' | 'failed' | 'skipped'
  message?: string
  screenshotPath?: string
  durationMs?: number
}

export interface RunCompleteEvent {
  runId: string
  status: 'passed' | 'failed' | 'stopped'
  totalSteps: number
  passedSteps: number
  failedSteps: number
  durationMs: number
}

export interface WorkspaceState {
  openTabs: Array<{ path: string; isDirty: boolean; title: string }>
  activeTabPath: string | null
  layout: Record<string, number>
  selectedFile: string | null
  activeProfile: string
}

export interface WorkspaceProjectEntry {
  path: string
  activeProfile: string
}
