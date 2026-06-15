import type { IpcMain } from 'electron'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type {
  AppiumSessionStartPayload,
  AppiumSessionStartResult,
  AppiumSessionInfo,
  AppiumDeviceEntry,
  AppiumTapPayload,
  AppiumSwipePayload,
  AppiumButtonPayload,
  AppiumScreenshotResult,
} from '@jkauto/core'
import { getSettings } from '../services/settings.service'

// One live inspector session at a time (mirror + manual interactions).
let session: AppiumSessionInfo | null = null
// Cached so quit-cleanup can reach the server without an async settings read.
let sessionBaseUrl = 'http://127.0.0.1:4723'

async function baseUrl(): Promise<string> {
  const settings = await getSettings()
  const { host, port } = settings.appium
  sessionBaseUrl = `http://${host === 'localhost' ? '127.0.0.1' : host}:${port}`
  return sessionBaseUrl
}

async function appiumFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = `${await baseUrl()}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let json: unknown
  try { json = JSON.parse(text) } catch { json = text }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'value' in json
        ? JSON.stringify((json as { value: unknown }).value)
        : text
    throw new Error(`Appium ${res.status}: ${msg}`)
  }
  return (json as { value?: unknown })?.value ?? json
}

// W3C pointer tap/swipe at absolute coordinates (device points).
function pointerActions(
  moves: Array<{ x: number; y: number; duration: number; down?: boolean; up?: boolean }>,
): unknown {
  const actions: unknown[] = []
  for (const m of moves) {
    actions.push({ type: 'pointerMove', duration: m.duration, x: Math.round(m.x), y: Math.round(m.y) })
    if (m.down) actions.push({ type: 'pointerDown', button: 0 })
    if (m.up) actions.push({ type: 'pointerUp', button: 0 })
  }
  return [{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions }]
}

// Android keyevent codes for the toolbar hardware buttons.
const ANDROID_KEYCODES: Record<string, number> = {
  home: 3,
  back: 4,
  appswitch: 187,
  lock: 26, // power
  volup: 24,
  voldown: 25,
}

// iOS `mobile: pressButton` names. back/appswitch have no iOS equivalent.
const IOS_BUTTONS: Record<string, string | undefined> = {
  home: 'home',
  lock: 'lock',
  volup: 'volumeUp',
  voldown: 'volumeDown',
  back: undefined,
  appswitch: undefined,
}

async function pressButton(button: string): Promise<void> {
  if (!session) throw new Error('No active session')
  const id = session.sessionId
  if (session.platform === 'android') {
    const keycode = ANDROID_KEYCODES[button]
    if (keycode == null) throw new Error(`Unsupported button: ${button}`)
    await appiumFetch(`/session/${id}/appium/device/press_keycode`, {
      method: 'POST',
      body: JSON.stringify({ keycode }),
    })
  } else {
    const name = IOS_BUTTONS[button]
    if (!name) throw new Error(`Button "${button}" not available on iOS`)
    await appiumFetch(`/session/${id}/execute/sync`, {
      method: 'POST',
      body: JSON.stringify({ script: 'mobile: pressButton', args: [{ name }] }),
    })
  }
}

function listSimulators(): AppiumDeviceEntry[] {
  try {
    const raw = execSync('xcrun simctl list devices available --json', {
      encoding: 'utf-8',
      timeout: 8000,
    })
    const data = JSON.parse(raw) as {
      devices: Record<string, Array<{ udid: string; name: string; state: string }>>
    }
    const out: AppiumDeviceEntry[] = []
    for (const [runtime, devices] of Object.entries(data.devices)) {
      // runtime key e.g. "com.apple.CoreSimulator.SimRuntime.iOS-18-6"
      const ver = runtime.match(/iOS-([\d-]+)/)?.[1]?.replace(/-/g, '.')
      for (const d of devices) {
        out.push({
          udid: d.udid,
          name: d.name,
          platform: 'ios',
          platformVersion: ver,
          state: d.state,
        })
      }
    }
    // Booted first
    return out.sort((a, b) => (a.state === 'Booted' ? -1 : 0) - (b.state === 'Booted' ? -1 : 0))
  } catch {
    return []
  }
}

// Electron GUI apps don't inherit the user's shell PATH, so a bare `adb` often
// fails. Resolve the binary from the SDK roots; fall back to PATH lookup.
let cachedAdb: string | null = null
function resolveAdb(): string {
  if (cachedAdb) return cachedAdb
  const home = homedir()
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const sdkRoots = [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    join(home, 'Android', 'Sdk'),
    join(home, 'Library', 'Android', 'sdk'),
    join(home, 'AppData', 'Local', 'Android', 'Sdk'),
  ].filter((p): p is string => !!p)

  for (const root of sdkRoots) {
    const p = join(root, 'platform-tools', exe)
    if (existsSync(p)) return (cachedAdb = p)
  }

  for (const shell of [process.env['SHELL'] ?? '/bin/zsh', '/bin/zsh', '/bin/bash']) {
    try {
      const bin = execSync(`${shell} -lc "which adb"`, { encoding: 'utf-8', timeout: 3000 }).trim()
      if (bin) return (cachedAdb = bin)
    } catch { /* try next */ }
  }
  return (cachedAdb = exe) // last resort: hope it's on PATH
}

function resolveAvdName(serial: string): string {
  // emulator-XXXX serials can report their AVD name via the emulator console protocol.
  if (!serial.startsWith('emulator-')) return serial
  try {
    const raw = execSync(`"${resolveAdb()}" -s ${serial} emu avd name`, {
      encoding: 'utf-8',
      timeout: 3000,
    })
    // Output is "AVD_NAME\r\nOK\r\n" — take the first non-empty line.
    const name = raw.split(/\r?\n/).map((s) => s.trim()).find(Boolean)
    return name && name !== 'OK' ? name : serial
  } catch {
    return serial
  }
}

function listAndroidDevices(): AppiumDeviceEntry[] {
  try {
    const raw = execSync(`"${resolveAdb()}" devices`, { encoding: 'utf-8', timeout: 5000 })
    return raw
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && l.includes('\t'))
      .map((l) => {
        const [udid, state] = l.split('\t')
        return { udid, name: resolveAvdName(udid), platform: 'android' as const, state }
      })
  } catch {
    return []
  }
}

export function registerAppiumSessionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.APPIUM_SESSION_DEVICES, () => {
    return [...listSimulators(), ...listAndroidDevices()]
  })

  ipcMain.handle(IpcChannels.APPIUM_SESSION_STATUS, () => session)

  ipcMain.handle(
    IpcChannels.APPIUM_SESSION_START,
    async (_e, payload: AppiumSessionStartPayload): Promise<AppiumSessionStartResult> => {
      if (session) return { ok: true, session }
      const mjpegPort = payload.mjpegPort ?? 9100
      const isIos = payload.platform === 'ios'
      const capabilities = {
        alwaysMatch: {
          platformName: isIos ? 'iOS' : 'Android',
          'appium:automationName': isIos ? 'XCUITest' : 'UiAutomator2',
          'appium:deviceName': payload.deviceName,
          'appium:mjpegServerPort': mjpegPort,
          ...(payload.platformVersion ? { 'appium:platformVersion': payload.platformVersion } : {}),
          ...(payload.bundleId ? { 'appium:bundleId': payload.bundleId } : {}),
          ...(payload.appPath ? { 'appium:app': payload.appPath } : {}),
          // No app/bundleId → XCUITest attaches to whatever is on screen (home).
        },
        firstMatch: [{}],
      }

      try {
        const value = (await appiumFetch('/session', {
          method: 'POST',
          body: JSON.stringify({ capabilities }),
        })) as { sessionId: string }
        const sessionId = value.sessionId

        // Device logical size for coordinate mapping.
        let width = 0
        let height = 0
        try {
          const rect = (await appiumFetch(`/session/${sessionId}/window/rect`)) as {
            width: number
            height: number
          }
          width = rect.width
          height = rect.height
        } catch { /* fall back to 0 — renderer can still map via img size */ }

        session = {
          sessionId,
          platform: payload.platform,
          deviceName: payload.deviceName,
          udid: payload.udid,
          width,
          height,
          mjpegPort,
        }
        return { ok: true, session }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(IpcChannels.APPIUM_SESSION_STOP, async () => {
    if (!session) return { ok: true }
    try {
      await appiumFetch(`/session/${session.sessionId}`, { method: 'DELETE' })
    } catch { /* session may already be dead */ }
    session = null
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.APPIUM_SESSION_SOURCE, async () => {
    if (!session) throw new Error('No active session')
    return (await appiumFetch(`/session/${session.sessionId}/source`)) as string
  })

  ipcMain.handle(IpcChannels.APPIUM_SESSION_TAP, async (_e, payload: AppiumTapPayload) => {
    if (!session) throw new Error('No active session')
    const x = payload.x * session.width
    const y = payload.y * session.height
    await appiumFetch(`/session/${session.sessionId}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        actions: pointerActions([{ x, y, duration: 0, down: true, up: true }]),
      }),
    })
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.APPIUM_SESSION_SWIPE, async (_e, payload: AppiumSwipePayload) => {
    if (!session) throw new Error('No active session')
    const { width, height } = session
    const dur = payload.durationMs ?? 400
    await appiumFetch(`/session/${session.sessionId}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        actions: pointerActions([
          { x: payload.x1 * width, y: payload.y1 * height, duration: 0, down: true },
          { x: payload.x2 * width, y: payload.y2 * height, duration: dur, up: true },
        ]),
      }),
    })
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.APPIUM_SESSION_BUTTON, async (_e, payload: AppiumButtonPayload) => {
    await pressButton(payload.button)
    return { ok: true }
  })

  ipcMain.handle(
    IpcChannels.APPIUM_SESSION_SCREENSHOT,
    async (): Promise<AppiumScreenshotResult> => {
      if (!session) return { ok: false, error: 'No active session' }
      try {
        const data = (await appiumFetch(`/session/${session.sessionId}/screenshot`)) as string
        return { ok: true, data }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

}

/** Tear down the inspector session on app quit. */
export function stopAppiumSessionOnQuit(): void {
  if (!session) return
  try {
    execSync(`curl -s -X DELETE ${sessionBaseUrl}/session/${session.sessionId}`, { timeout: 3000 })
  } catch { /* best effort */ }
  session = null
}
