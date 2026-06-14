import type { ApiRequest } from './schemas/object-repository'

export const IpcChannels = {
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_OPEN_DIALOG: 'project:open-dialog',
  PROJECT_GET_RECENT: 'project:get-recent',
  PROJECT_GET_INFO: 'project:get-info',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_DUPLICATE: 'project:duplicate',

  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_CREATE_FILE: 'fs:create-file',
  FS_LIST_DIR: 'fs:list-dir',
  FS_TREE: 'fs:tree',
  FS_CREATE_DIR: 'fs:create-dir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_RENAME_DISPLAY: 'fs:rename-display',
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
  ENGINE_SUITE_EVENT: 'engine:suite-event',
  ENGINE_RUN_COMPLETE: 'engine:run-complete',
  ENGINE_GET_RUNS: 'engine:get-runs',
  ENGINE_SAVE_RUN: 'engine:save-run',
  ENGINE_DEBUG_NEXT: 'engine:debug-next',
  ENGINE_GET_KEYWORDS: 'engine:get-keywords',

  HTTP_SEND_REQUEST: 'http:send-request',
  HTTP_IMPORT_OPENAPI: 'http:import-openapi',
  HTTP_HISTORY_GET: 'http:history:get',
  HTTP_HISTORY_SAVE: 'http:history:save',

  ENV_LIST: 'env:list',
  ENV_READ: 'env:read',
  ENV_WRITE: 'env:write',
  ENV_CREATE: 'env:create',
  ENV_DELETE: 'env:delete',

  AGENT_CHAT: 'agent:chat',
  AGENT_GET_CONTEXT: 'agent:get-context',
  AGENT_CANCEL: 'agent:cancel',

  APP_SETTINGS_GET: 'app-settings:get',
  APP_SETTINGS_SET: 'app-settings:set',

  APP_ZOOM_GET: 'app:zoom:get',
  APP_ZOOM_SET: 'app:zoom:set',
  APP_ZOOM_CHANGED: 'app:zoom:changed',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export interface CreateProjectPayload {
  name: string
  type: 'web' | 'mobile' | 'desktop' | 'api'
  icon?: string
  description: string
  repoUrl: string
  location: string
  format: 'json' | 'yaml'
}

export interface UpdateProjectPayload {
  projectPath: string
  name: string
  type: 'web' | 'mobile' | 'desktop' | 'api'
  icon?: string
  description: string
  repoUrl: string
}

export interface DuplicateProjectPayload {
  sourcePath: string
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
  displayName?: string
  path: string
  type: 'file' | 'directory'
  ext?: string
  children?: FsTreeNode[]
}

export interface FsWatchEvent {
  eventType: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  path: string
}

export interface KeywordMetaParam {
  name: string
  description: string
  required: boolean
}

// Serializable keyword metadata (no executor fn) — single source for renderer UI.
export interface KeywordMeta {
  name: string
  label: string
  color: string
  description: string
  platforms: Array<'web' | 'mobile' | 'desktop' | 'api' | 'appium'>
  params: KeywordMetaParam[]
  hasObject: boolean
  hasInput: boolean
  hasExpected: boolean
  inputPlaceholder?: string
  objectPlaceholder?: string
  expectedPlaceholder?: string
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

export interface SuiteEvent {
  runId: string
  suiteId: string
  suiteName: string
  type: 'suite-start' | 'case-start' | 'case-complete' | 'suite-complete'
  caseIndex?: number
  totalCases?: number
  testCaseId?: string
  testCasePath?: string
  testCaseName?: string
  status?: 'running' | 'passed' | 'failed' | 'skipped' | 'stopped'
  message?: string
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

export interface RunRecord {
  runId: string
  filePath: string
  status: 'passed' | 'failed' | 'stopped'
  totalSteps: number
  passedSteps: number
  failedSteps: number
  durationMs: number
  startedAt: string
  endedAt: string
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

export interface HttpSendRequestPayload {
  request: ApiRequest
  profileVariables?: Record<string, string>
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
}

export interface HttpImportOpenApiPayload {
  source: string
  targetDir: string
  nameSource?: 'summary' | 'operationId' | 'methodPath'
}

export interface HttpImportOpenApiResult {
  created: string[]
}

export interface EnvEntry {
  name: string
  path: string
}

export interface EnvWritePayload {
  filePath: string
  variables: Record<string, string>
}

export interface EnvCreatePayload {
  projectPath: string
  name: string
}

export interface RequestHistoryRecord {
  id: string
  requestedAt: string
  method: string
  url: string
  status: number
  statusText: string
  durationMs: number
  size: number
  headers: Record<string, string>
  body: string
}

export interface HttpHistorySavePayload {
  filePath: string
  record: RequestHistoryRecord
}

export type AgentRole = 'system' | 'user' | 'assistant'

export interface AgentMessage {
  id: string
  role: Exclude<AgentRole, 'system'>
  content: string
  createdAt: string
}

export interface AgentContextSnapshot {
  activeProject?: {
    path: string
    name: string
    type: string
    description?: string
    activeProfile?: string
  }
  activeTab?: {
    path: string
    title: string
    isDirty: boolean
  }
  openTabs?: Array<{
    path: string
    title: string
    isDirty: boolean
  }>
  run?: {
    status: 'idle' | 'running' | 'passed' | 'failed' | 'stopped'
    runId: string | null
    isDebugMode: boolean
    isDebugPaused: boolean
    latestLogs: Array<{
      time: string
      level: 'info' | 'success' | 'error' | 'warn'
      message: string
      stepIndex?: number
    }>
    latestEvents: Array<{
      time: string
      message: string
    }>
    stepMessages: Record<number, string>
  }
}

export interface AgentChatPayload {
  messages: AgentMessage[]
  context?: AgentContextSnapshot
}

export interface AgentChatResult {
  message: AgentMessage
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface AgentContextResult {
  summary: string
}
