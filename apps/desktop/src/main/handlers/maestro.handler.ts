import type { IpcMain, WebContents } from 'electron'
import { execSync, spawn } from 'node:child_process'
import { IpcChannels } from '@jkauto/core'
import type { MaestroEnvStatus } from '@jkauto/core'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g
const stripAnsi = (s: string) => s.replace(ANSI_RE, '')

function resolveMaestro(): string | undefined {
  const shells = [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']
  for (const shell of shells) {
    try {
      const bin = execSync(`${shell} -lc "which maestro"`, { encoding: 'utf-8', timeout: 3000 }).trim()
      if (bin) return bin
    } catch { /* try next */ }
  }
  const candidates = [
    `${process.env['HOME'] ?? ''}/.maestro/bin/maestro`,
    '/usr/local/bin/maestro',
    '/opt/homebrew/bin/maestro',
  ]
  for (const p of candidates) {
    try { execSync(`test -x "${p}"`); return p } catch { /* skip */ }
  }
  return undefined
}

function checkEnv(): MaestroEnvStatus {
  const path = resolveMaestro()
  return { installed: !!path, path }
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

export function registerMaestroHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.MAESTRO_ENV_CHECK, (): MaestroEnvStatus => checkEnv())

  ipcMain.handle(IpcChannels.MAESTRO_INSTALL, async (event) => {
    const isWin = process.platform === 'win32'
    if (isWin) {
      return {
        ok: false,
        error: 'Auto-install not supported on Windows. Use WSL or install manually.',
      }
    }
    try {
      const proc = spawn(
        process.env['SHELL'] ?? '/bin/bash',
        ['-c', 'curl -Ls "https://get.maestro.mobile.dev" | bash'],
        { stdio: 'pipe', shell: false },
      )
      pipeToRenderer(proc, event.sender, IpcChannels.MAESTRO_LOG)
      return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        proc.on('exit', (code) => resolve({ ok: code === 0 }))
        proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
