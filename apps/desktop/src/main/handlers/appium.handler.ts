import type { IpcMain, WebContents } from 'electron'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { AppiumEnvStatus } from '@jkauto/core'
import { getSettings } from '../services/settings.service'

let appiumProcess: ChildProcess | null = null

// Electron GUI apps on macOS don't inherit the user's shell PATH.
// Resolve the appium binary location at startup via the login shell.
function resolveAppiumBin(): string {
  const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
  for (const shell of shells) {
    try {
      const bin = execSync(`${shell} -lc "which appium"`, { encoding: 'utf-8', timeout: 3000 }).trim()
      if (bin) return bin
    } catch { /* try next */ }
  }
  // Fallback: common install locations + search all nvm versions (newest first)
  const home = homedir()
  const nvmNodeDir = join(home, '.nvm', 'versions', 'node')
  const nvmCandidates: string[] = []
  if (existsSync(nvmNodeDir)) {
    try {
      const vers = readdirSync(nvmNodeDir)
        .filter((v) => v.startsWith('v'))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      for (const v of vers) nvmCandidates.push(join(nvmNodeDir, v, 'bin', 'appium'))
    } catch { /* ignore */ }
  }
  const candidates = [
    '/usr/local/bin/appium',
    '/opt/homebrew/bin/appium',
    join(home, '.nvm', 'versions', 'node', 'current', 'bin', 'appium'),
    ...nvmCandidates,
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error(
    'Appium not found. Install it with: npm install -g appium\n' +
    'Then restart the IDE so the updated PATH is picked up.',
  )
}

let appiumBin: string | null = null
function getAppiumBin(): string {
  if (!appiumBin) appiumBin = resolveAppiumBin()
  return appiumBin
}

/** Probe host for appium + Android SDK + Xcode. Non-throwing — every field is best-effort. */
function checkEnv(): AppiumEnvStatus {
  let appiumInstalled = false
  let appiumPath: string | undefined
  try {
    appiumPath = getAppiumBin()
    appiumInstalled = !!appiumPath
  } catch { /* not installed */ }

  const has = (cmd: string): boolean => {
    const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
    for (const shell of shells) {
      try {
        const out = execSync(`${shell} -lc "which ${cmd}"`, { encoding: 'utf-8', timeout: 3000 }).trim()
        if (out) return true
      } catch { /* try next */ }
    }
    return false
  }

  return {
    appiumInstalled,
    appiumPath,
    androidSdk: detectAndroidSdk(has),
    xcode: process.platform === 'darwin' ? has('xcrun') : false,
  }
}

/**
 * Android SDK detection. Electron GUI apps don't inherit the user's shell PATH,
 * so `which adb` alone is unreliable. Probe, in order:
 *  1. ANDROID_HOME / ANDROID_SDK_ROOT env vars → verify platform-tools/emulator exists
 *  2. Standard SDK install dirs per platform
 *  3. `adb` or `emulator` resolvable on the login-shell PATH
 */
function detectAndroidSdk(has: (cmd: string) => boolean): boolean {
  const home = homedir()
  const sdkRoots = [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    join(home, 'Android', 'Sdk'),              // Linux default (Android Studio)
    join(home, 'Library', 'Android', 'sdk'),   // macOS default
    join(home, 'AppData', 'Local', 'Android', 'Sdk'), // Windows default
  ].filter((p): p is string => !!p)

  for (const root of sdkRoots) {
    if (
      existsSync(join(root, 'platform-tools')) ||
      existsSync(join(root, 'emulator')) ||
      existsSync(join(root, 'cmdline-tools'))
    ) {
      return true
    }
  }

  return has('adb') || has('emulator')
}

// The appium binary is a Node script (#!/usr/bin/env node). Electron GUI apps on
// macOS don't inherit the shell PATH, so `env node` fails. Build an env that
// prepends the node binary's directory so spawned appium processes can find it.
let appiumEnv: NodeJS.ProcessEnv | null = null
function getAppiumEnv(): NodeJS.ProcessEnv {
  if (appiumEnv) return appiumEnv
  let nodeDir = ''
  const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
  for (const shell of shells) {
    try {
      const bin = execSync(`${shell} -lc "which node"`, { encoding: 'utf-8', timeout: 3000 }).trim()
      if (bin) { nodeDir = bin.replace(/\/node$/, ''); break }
    } catch { /* try next */ }
  }
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', nodeDir].filter(Boolean).join(':')
  const sdkRoot = resolveAndroidSdkRoot()
  const sdkEnv = sdkRoot
    ? {
        ANDROID_HOME: sdkRoot,
        ANDROID_SDK_ROOT: sdkRoot,
        PATH: `${extra}:${join(sdkRoot, 'platform-tools')}:${join(sdkRoot, 'emulator')}:${process.env['PATH'] ?? ''}`,
      }
    : { PATH: `${extra}:${process.env['PATH'] ?? ''}` }
  appiumEnv = { ...process.env, ...sdkEnv }
  return appiumEnv
}

/** Find the Android SDK root dir (for ANDROID_HOME export to spawned appium). */
function resolveAndroidSdkRoot(): string | undefined {
  const home = homedir()
  const roots = [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    join(home, 'Android', 'Sdk'),
    join(home, 'Library', 'Android', 'sdk'),
    join(home, 'AppData', 'Local', 'Android', 'Sdk'),
  ].filter((p): p is string => !!p)
  return roots.find(
    (r) => existsSync(join(r, 'platform-tools')) || existsSync(join(r, 'emulator')),
  )
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string) => s.replace(ANSI_RE, '')

function pipeToRenderer(proc: ChildProcess, webContents: WebContents): void {
  const send = (msg: string, level: 'info' | 'error') => {
    if (!webContents.isDestroyed()) {
      webContents.send(IpcChannels.APPIUM_LOG, { level, message: stripAnsi(msg) })
    }
  }
  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) send(line, 'info')
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) send(line, 'error')
  })
  proc.on('error', (err) => send(`Appium process error: ${err.message}`, 'error'))
}

// Kill any leftover/orphan process holding the port (e.g. an Appium started
// manually in a terminal, or one left behind after an unclean app exit).
function freePort(port: number): void {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8', timeout: 3000 })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const pid of pids) {
      try { process.kill(Number(pid), 'SIGKILL') } catch { /* already gone */ }
    }
  } catch { /* nothing on the port */ }
}

function spawnAppium(port: number, logLevel: string): ChildProcess {
  const bin = getAppiumBin()
  freePort(port)
  const proc = spawn(bin, ['--port', String(port), '--log-level', logLevel], {
    stdio: 'pipe',
    shell: false,
    env: getAppiumEnv(),
  })
  proc.on('exit', () => { appiumProcess = null })
  return proc
}

export function registerAppiumHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.APPIUM_GLOBAL_INSTALL, async (event) => {
    try {
      const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
      let nodeDir = ''
      for (const shell of shells) {
        try {
          const bin = execSync(`${shell} -lc "which node"`, { encoding: 'utf-8', timeout: 3000 }).trim()
          if (bin) { nodeDir = bin.replace(/\/node$/, ''); break }
        } catch { /* try next */ }
      }
      const extra = ['/opt/homebrew/bin', '/usr/local/bin', nodeDir].filter(Boolean).join(':')
      const env = { ...process.env, PATH: `${extra}:${process.env['PATH'] ?? ''}` }
      const proc = spawn('npm', ['install', '-g', 'appium'], { stdio: 'pipe', shell: false, env })
      pipeToRenderer(proc, event.sender)
      return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        proc.on('exit', (code) => resolve({ ok: code === 0 }))
        proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IpcChannels.APPIUM_START, async (event) => {
    if (appiumProcess) return { ok: true, pid: appiumProcess.pid }
    const settings = await getSettings()
    const { port, logLevel } = settings.appium
    try {
      appiumProcess = spawnAppium(port, logLevel)
      pipeToRenderer(appiumProcess, event.sender)
      return { ok: true, pid: appiumProcess.pid }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IpcChannels.APPIUM_STOP, async () => {
    if (!appiumProcess) return { ok: true }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        appiumProcess?.kill('SIGKILL')
        resolve()
      }, 4000)
      appiumProcess!.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
      appiumProcess!.kill()
    })
    appiumProcess = null
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.APPIUM_STATUS, () => ({
    running: appiumProcess != null,
    pid: appiumProcess?.pid,
  }))

  ipcMain.handle(IpcChannels.APPIUM_ENV_CHECK, (): AppiumEnvStatus => checkEnv())

  ipcMain.handle(IpcChannels.APPIUM_DRIVERS_GET, () => {
    try {
      const bin = getAppiumBin()
      const raw = execSync(`"${bin}" driver list --installed --json`, {
        encoding: 'utf-8',
        timeout: 15000,
        env: getAppiumEnv(),
      })
      // appium may emit a leading spinner/log line before the JSON — slice from first '{'.
      const jsonStart = raw.indexOf('{')
      if (jsonStart < 0) return {}
      const data = JSON.parse(raw.slice(jsonStart)) as Record<string, { version?: string }>
      const result: Record<string, { installed: boolean; version?: string }> = {}
      for (const [name, info] of Object.entries(data)) {
        result[name] = { installed: true, version: info.version }
      }
      return result
    } catch {
      return {}
    }
  })

  ipcMain.handle(IpcChannels.APPIUM_DRIVER_INSTALL, async (event, driverName: string) => {
    if (!driverName || typeof driverName !== 'string') {
      return { ok: false, error: 'No driver name provided' }
    }
    try {
      const bin = getAppiumBin()
      const proc = spawn(bin, ['driver', 'install', driverName], {
        stdio: 'pipe',
        shell: false,
        env: getAppiumEnv(),
      })
      pipeToRenderer(proc, event.sender)
      return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        proc.on('exit', (code) => resolve({ ok: code === 0 }))
        proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

/** Called by engine handler when autoStart is enabled. Waits 2 s for Appium to be ready. */
export async function ensureAppiumRunning(webContents: WebContents): Promise<void> {
  if (appiumProcess) return
  const settings = await getSettings()
  const { port, logLevel } = settings.appium
  appiumProcess = spawnAppium(port, logLevel)
  pipeToRenderer(appiumProcess, webContents)
  await new Promise<void>((resolve) => setTimeout(resolve, 2000))
}

export function getAppiumRunning(): boolean {
  return appiumProcess != null
}

/** Kill the spawned Appium process on app quit so it doesn't orphan the port. */
export function killAppiumOnQuit(): void {
  if (appiumProcess) {
    try { appiumProcess.kill('SIGKILL') } catch { /* already gone */ }
    appiumProcess = null
  }
}
