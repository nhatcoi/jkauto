import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron'
import { execFile, execSync, spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { IpcChannels } from '@jkauto/core'
import type {
  IdbEnvStatus,
  IosSimulatorSwipePayload,
  IosSimulatorTapPayload,
  ScrcpyEnvStatus,
} from '@jkauto/core'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string) => s.replace(ANSI_RE, '')

function resolveBin(name: string): string | undefined {
  for (const shell of [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']) {
    try {
      const bin = execSync(`${shell} -lc "which ${name}"`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim()
      if (bin) return bin
    } catch { /* try next */ }
  }

  const home = homedir()
  for (const prefix of [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    `${home}/.local/bin`,
    `${home}/.pyenv/shims`,
  ]) {
    const candidate = `${prefix}/${name}`
    try {
      execSync(`test -x "${candidate}"`, { timeout: 1000 })
      return candidate
    } catch { /* skip */ }
  }

  return undefined
}

function pipeToRenderer(
  proc: ReturnType<typeof spawn>,
  webContents: WebContents,
  channel: string,
): void {
  const send = (msg: string, level: 'info' | 'error') => {
    if (!webContents.isDestroyed()) {
      webContents.send(channel, { level, message: stripAnsi(msg) })
    }
  }
  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) send(line, 'info')
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) send(line, 'error')
  })
  proc.on('error', (err) => send(`Process error: ${err.message}`, 'error'))
}

function runFile(file: string, args: string[], timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { encoding: 'utf-8', timeout }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr.trim() || err.message))
        return
      }
      resolve(stdout)
    })
  })
}

function checkScrcpy(): ScrcpyEnvStatus {
  const path = resolveBin('scrcpy')
  return { installed: !!path, path }
}

function checkIdb(): IdbEnvStatus {
  const path = resolveBin('idb')
  const companionPath = resolveBin('idb_companion')
  return {
    installed: !!path && !!companionPath,
    path,
    companionInstalled: !!companionPath,
    companionPath,
  }
}

function installCommand(tool: 'scrcpy' | 'idb'): string | null {
  if (process.platform === 'darwin') {
    return tool === 'scrcpy'
      ? 'brew install scrcpy'
      : 'brew tap facebook/fb && brew install idb-companion && python3 -m pip install --user fb-idb'
  }
  if (process.platform === 'linux') {
    return tool === 'scrcpy'
      ? 'sudo apt-get update && sudo apt-get install -y scrcpy'
      : 'python3 -m pip install --user fb-idb'
  }
  return null
}

async function installTool(
  event: IpcMainInvokeEvent,
  tool: 'scrcpy' | 'idb',
): Promise<{ ok: boolean; error?: string }> {
  const cmd = installCommand(tool)
  if (!cmd) return { ok: false, error: `${tool} auto-install is not supported on this OS` }

  try {
    const proc = spawn(process.env['SHELL'] ?? '/bin/bash', ['-lc', cmd], {
      stdio: 'pipe',
      shell: false,
    })
    pipeToRenderer(proc, event.sender, tool === 'scrcpy' ? IpcChannels.SCRCPY_LOG : IpcChannels.IDB_LOG)
    return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      proc.on('exit', (code) => resolve({ ok: code === 0 }))
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function idbBin(): string {
  const bin = resolveBin('idb')
  if (!bin) throw new Error('idb not found')
  return bin
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function findScreenSize(value: unknown): { width: number; height: number } | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const directWidth =
    readNumber(obj['width']) ??
    readNumber(obj['Width']) ??
    readNumber(obj['screen_width']) ??
    readNumber(obj['screenWidth'])
  const directHeight =
    readNumber(obj['height']) ??
    readNumber(obj['Height']) ??
    readNumber(obj['screen_height']) ??
    readNumber(obj['screenHeight'])
  if (directWidth && directHeight) return { width: directWidth, height: directHeight }

  for (const key of ['screen_dimensions', 'screenDimensions', 'ScreenDimensions', 'dimensions']) {
    const nested = findScreenSize(obj[key])
    if (nested) return nested
  }

  for (const child of Object.values(obj)) {
    const nested = findScreenSize(child)
    if (nested) return nested
  }

  return null
}

async function getIdbScreenSize(udid: string): Promise<{ width: number; height: number }> {
  const raw = await runFile(idbBin(), ['describe', '--udid', udid, '--json'], 15000)
  const parsed = JSON.parse(raw) as unknown
  const size = findScreenSize(parsed)
  if (!size) throw new Error('Cannot read simulator screen size from idb describe')
  return size
}

async function idbTap(udid: string, x: number, y: number): Promise<void> {
  await runFile(idbBin(), ['ui', 'tap', '--udid', udid, String(Math.round(x)), String(Math.round(y))])
}

async function idbSwipe(payload: IosSimulatorSwipePayload): Promise<void> {
  const size = await getIdbScreenSize(payload.udid)
  const args = [
    'ui',
    'swipe',
    '--udid',
    payload.udid,
    String(Math.round(payload.x1 * size.width)),
    String(Math.round(payload.y1 * size.height)),
    String(Math.round(payload.x2 * size.width)),
    String(Math.round(payload.y2 * size.height)),
  ]
  await runFile(idbBin(), args, Math.max(10000, (payload.durationMs ?? 400) + 5000))
}

export function registerMobileToolsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.SCRCPY_ENV_CHECK, (): ScrcpyEnvStatus => checkScrcpy())
  ipcMain.handle(IpcChannels.IDB_ENV_CHECK, (): IdbEnvStatus => checkIdb())

  ipcMain.handle(IpcChannels.SCRCPY_INSTALL, (event) => installTool(event, 'scrcpy'))
  ipcMain.handle(IpcChannels.IDB_INSTALL, (event) => installTool(event, 'idb'))

  ipcMain.handle(IpcChannels.IOS_SIMULATOR_TAP, async (_event, payload: IosSimulatorTapPayload) => {
    const size = await getIdbScreenSize(payload.udid)
    await idbTap(payload.udid, payload.x * size.width, payload.y * size.height)
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.IOS_SIMULATOR_SWIPE, async (_event, payload: IosSimulatorSwipePayload) => {
    await idbSwipe(payload)
    return { ok: true }
  })
}
