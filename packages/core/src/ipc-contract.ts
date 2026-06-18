import type { ApiRequest } from './schemas/api-request'

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
  ENGINE_GET_ALL_RUNS: 'engine:get-all-runs',
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
  AGENT_STREAM_CHUNK: 'agent:stream-chunk',
  AGENT_GET_CONTEXT: 'agent:get-context',
  AGENT_CANCEL: 'agent:cancel',

  AGENT_SESSION_LIST: 'agent:session:list',
  AGENT_SESSION_CREATE: 'agent:session:create',
  AGENT_SESSION_UPDATE: 'agent:session:update',
  AGENT_SESSION_DELETE: 'agent:session:delete',
  AGENT_SESSION_MESSAGES: 'agent:session:messages',
  AGENT_SESSION_ARTIFACTS: 'agent:session:artifacts',
  AGENT_SESSION_ACTIONS: 'agent:session:actions',

  APP_SETTINGS_GET: 'app-settings:get',
  APP_SETTINGS_SET: 'app-settings:set',

  APP_ZOOM_GET: 'app:zoom:get',
  APP_ZOOM_SET: 'app:zoom:set',
  APP_ZOOM_CHANGED: 'app:zoom:changed',

  APPIUM_START: 'appium:start',
  APPIUM_STOP: 'appium:stop',
  APPIUM_STATUS: 'appium:status',
  APPIUM_LOG: 'appium:log',
  APPIUM_DRIVERS_GET: 'appium:drivers:get',
  APPIUM_DRIVER_INSTALL: 'appium:driver:install',

  // Live inspector session (mirror + interactions), independent of test runs.
  APPIUM_SESSION_START: 'appium:session:start',
  APPIUM_SESSION_STOP: 'appium:session:stop',
  APPIUM_SESSION_STATUS: 'appium:session:status',
  APPIUM_SESSION_SOURCE: 'appium:session:source',
  APPIUM_SESSION_TAP: 'appium:session:tap',
  APPIUM_SESSION_SWIPE: 'appium:session:swipe',
  APPIUM_SESSION_DEVICES: 'appium:session:devices',
  APPIUM_SESSION_BUTTON: 'appium:session:button',
  APPIUM_SESSION_SCREENSHOT: 'appium:session:screenshot',
  APPIUM_ENV_CHECK: 'appium:env:check',
  APPIUM_INSPECTOR_OPEN: 'appium:inspector:open',
  APPIUM_AVD_LIST: 'appium:avd:list',
  APPIUM_AVD_START: 'appium:avd:start',

  // Android scrcpy mirror — H.264 stream (push events from main → renderer)
  SCRCPY_START: 'scrcpy:start',
  SCRCPY_STOP: 'scrcpy:stop',
  SCRCPY_VIDEO_PACKET: 'scrcpy:video-packet',
  SCRCPY_INJECT_TOUCH: 'scrcpy:inject-touch',
  SCRCPY_PRESS_BUTTON: 'scrcpy:press-button',
  SCRCPY_ENV_CHECK: 'scrcpy:env:check',
  SCRCPY_INSTALL: 'scrcpy:install',
  SCRCPY_LOG: 'scrcpy:log',

  // iOS Simulator mirror — PNG frame polling via xcrun simctl
  IOS_SIMULATOR_OPEN: 'ios-simulator:open',
  IOS_SIMULATOR_SCREENSHOT: 'ios-simulator:screenshot',
  IOS_SIMULATOR_TAP: 'ios-simulator:tap',
  IOS_SIMULATOR_SWIPE: 'ios-simulator:swipe',
  IDB_ENV_CHECK: 'idb:env:check',
  IDB_INSTALL: 'idb:install',
  IDB_LOG: 'idb:log',

  // Appium global install (npm install -g appium) — logs piped via APPIUM_LOG
  APPIUM_GLOBAL_INSTALL: 'appium:global-install',

  // Maestro CLI env check + install
  MAESTRO_ENV_CHECK: 'maestro:env:check',
  MAESTRO_INSTALL: 'maestro:install',
  MAESTRO_LOG: 'maestro:log',

  MENU_EVENT: 'menu-event',
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
  error?: string
}

export interface StepResult {
  stepIndex: number
  status: 'passed' | 'failed' | 'skipped'
  message?: string
  screenshotPath?: string
  durationMs?: number
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
  stepResults?: StepResult[]
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
export type AgentSessionMode = 'ask' | 'edit' | 'debug' | 'generate-test'

export interface AgentMessageMeta {
  model?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  toolCalls?: Array<{ name: string; args: unknown }>
}

export interface AgentMessage {
  id: string
  sessionId?: string
  role: Exclude<AgentRole, 'system'>
  content: string
  createdAt: string
  metadata?: AgentMessageMeta
}

export interface AgentSession {
  id: string
  projectPath: string
  title: string
  mode: AgentSessionMode
  status: 'active' | 'archived'
  summary?: string
  activeTabPath?: string
  createdAt: string
  updatedAt: string
}

export interface AgentArtifact {
  id: string
  sessionId: string
  type: 'apply-steps' | 'generated-test' | 'patch' | 'diagnosis' | 'selector'
  contentJson: string
  targetPath?: string
  createdAt: string
}

export interface AgentAction {
  id: string
  sessionId: string
  type: 'read_file' | 'write_file' | 'apply_steps' | 'run_test' | 'backup_file' | 'tool_call'
  status: 'pending' | 'done' | 'error' | 'rolledback'
  payloadJson: string
  resultJson?: string
  backupPath?: string
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
  sessionId?: string
  messages: AgentMessage[]
  context?: AgentContextSnapshot
}

export interface AgentSessionListPayload { projectPath: string }
export interface AgentSessionCreatePayload { projectPath: string; mode?: AgentSessionMode; title?: string }
export interface AgentSessionUpdatePayload { projectPath: string; id: string; patch: Partial<Pick<AgentSession, 'title' | 'mode' | 'status' | 'summary'>> }
export interface AgentSessionDeletePayload { projectPath: string; id: string }
export interface AgentSessionDataPayload { projectPath: string; sessionId: string }

export interface AvdEntry {
  avdName: string
  displayName: string
  udid?: string
  state: 'stopped' | 'device' | 'offline'
}

export interface AvdStartPayload {
  avdName: string
}

export interface AppiumStatus {
  running: boolean
  pid?: number
}

export interface AppiumDriverMap {
  [driverName: string]: { installed: boolean; version?: string }
}

export interface AppiumSessionStartPayload {
  platform: 'ios' | 'android'
  deviceName: string
  /** adb serial (e.g. emulator-5554) — required for Android mirror polling */
  udid?: string
  platformVersion?: string
  bundleId?: string
  appPath?: string
  mjpegPort?: number
}

export interface AppiumSessionInfo {
  sessionId: string
  platform: 'ios' | 'android'
  deviceName: string
  /** adb serial, present for android sessions */
  udid?: string
  /** Device logical size (points) for normalized → absolute coord mapping. */
  width: number
  height: number
  mjpegPort: number
}

export interface ScrcpyStartPayload {
  serial: string
}

export interface ScrcpyVideoPacket {
  type: 'configuration' | 'data'
  /** H.264 codec string (e.g. "avc1.640028"), only set on configuration packets */
  codec?: string
  /** true = keyframe, false = delta frame, only set on data packets */
  keyframe?: boolean
  data: Uint8Array
}

/** action: 0=Down 1=Up 2=Move. x/y are actual video pixels. */
export interface ScrcpyInjectTouchPayload {
  action: 0 | 1 | 2
  x: number
  y: number
  width: number
  height: number
  pressure: number
}

export interface IosSimulatorTapPayload {
  udid: string
  /** normalized 0..1 coordinates relative to simulator screen */
  x: number
  y: number
}

export interface IosSimulatorSwipePayload {
  udid: string
  /** normalized 0..1 coordinates relative to simulator screen */
  x1: number
  y1: number
  x2: number
  y2: number
  durationMs?: number
}

export interface AppiumSessionStartResult {
  ok: boolean
  session?: AppiumSessionInfo
  error?: string
}

export interface AppiumDeviceEntry {
  udid: string
  name: string
  platform: 'ios' | 'android'
  platformVersion?: string
  state?: string
  /** iOS only: 'simulator' | 'device' */
  kind?: 'simulator' | 'device'
}

export interface AppiumTapPayload {
  /** normalized 0..1 coordinates relative to device screen */
  x: number
  y: number
}

export interface AppiumSwipePayload {
  x1: number
  y1: number
  x2: number
  y2: number
  durationMs?: number
}

export interface AppiumLogEvent {
  level: 'info' | 'error'
  message: string
}

/** Hardware / navigation buttons exposed in the device toolbar. */
export type AppiumButton =
  | 'home'
  | 'back'
  | 'appswitch'
  | 'lock'
  | 'volup'
  | 'voldown'

export interface AppiumButtonPayload {
  button: AppiumButton
}

export interface AppiumScreenshotResult {
  ok: boolean
  /** base64 PNG (no data: prefix) */
  data?: string
  error?: string
}

/** Result of probing the host for required mobile-automation tooling. */
export interface AppiumEnvStatus {
  /** appium CLI resolvable on PATH */
  appiumInstalled: boolean
  appiumPath?: string
  /** adb present → Android SDK platform-tools available */
  androidSdk: boolean
  /** xcrun present → Xcode command-line tools (iOS, macOS only) */
  xcode: boolean
}

export interface MaestroEnvStatus {
  installed: boolean
  path?: string
}

export interface ScrcpyEnvStatus {
  installed: boolean
  path?: string
}

export interface IdbEnvStatus {
  installed: boolean
  path?: string
  companionInstalled: boolean
  companionPath?: string
}

export interface AgentChatResult {
  message: AgentMessage
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  sessionId?: string
}

export interface AgentContextResult {
  summary: string
}
