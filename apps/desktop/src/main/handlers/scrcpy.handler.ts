import type { IpcMain, WebContents } from 'electron'
import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { AppiumButton, ScrcpyStartPayload, ScrcpyInjectTouchPayload } from '@jkauto/core'
import { Adb } from '@yume-chan/adb'
import { AdbServerClient } from '@yume-chan/adb'
import { AdbServerNodeTcpConnector } from '@yume-chan/adb-server-node-tcp'
import { AdbScrcpyClient, AdbScrcpyOptions3_1 } from '@yume-chan/adb-scrcpy'
import { DefaultServerPath, h264ParseConfiguration } from '@yume-chan/scrcpy'
import { AndroidKeyCode, AndroidKeyEventAction, AndroidKeyEventMeta } from '@yume-chan/scrcpy'
import type { ScrcpyControlMessageWriter, AndroidKeyCode as AndroidKeyCodeType } from '@yume-chan/scrcpy'

const hex2 = (n: number) => n.toString(16).padStart(2, '0')

let activeClient: { close(): Promise<void> } | null = null
let activeController: ScrcpyControlMessageWriter | null = null
let streamAbort: AbortController | null = null

const SCRCPY_BUTTON_KEYCODES: Record<AppiumButton, AndroidKeyCodeType | undefined> = {
  home: AndroidKeyCode.AndroidHome,
  back: AndroidKeyCode.AndroidBack,
  appswitch: AndroidKeyCode.AndroidAppSwitch,
  lock: AndroidKeyCode.Power,
  volup: AndroidKeyCode.VolumeUp,
  voldown: AndroidKeyCode.VolumeDown,
}

function getServerBinPath(): string {
  const appRoot = app.getAppPath()
  const candidates = [
    join(process.resourcesPath, 'scrcpy', 'server.bin'),
    join(appRoot, 'node_modules', '@yume-chan', 'fetch-scrcpy-server', 'scrcpy-server-v3.1'),
    join(appRoot, 'node_modules', '@yume-chan', 'fetch-scrcpy-server', 'server.bin'),
    // pnpm hoisting fallback
    join(appRoot, '..', '..', 'node_modules', '.pnpm',
      '@yume-chan+fetch-scrcpy-server@1.0.0', 'node_modules',
      '@yume-chan', 'fetch-scrcpy-server', 'scrcpy-server-v3.1'),
    join(appRoot, '..', '..', 'node_modules', '.pnpm',
      '@yume-chan+fetch-scrcpy-server@1.0.0', 'node_modules',
      '@yume-chan', 'fetch-scrcpy-server', 'server.bin'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error(`scrcpy server binary not found.\nLooked in:\n${candidates.join('\n')}`)
}

async function stopActive(): Promise<void> {
  streamAbort?.abort()
  streamAbort = null
  activeController = null
  if (activeClient) {
    try { await activeClient.close() } catch { /* already gone */ }
    activeClient = null
  }
}

async function launchScrcpy(serial: string, webContents: WebContents): Promise<void> {
  await stopActive()

  const connector = new AdbServerNodeTcpConnector({ port: 5037 })
  const serverClient = new AdbServerClient(connector)
  const transport = await serverClient.createTransport({ serial })
  const adb = new Adb(transport)

  // Push server JAR (90 KB, fast)
  const serverBin = await readFile(getServerBinPath())
  const binStream = new ReadableStream<Uint8Array>({
    start(ctrl) { ctrl.enqueue(serverBin); ctrl.close() },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await AdbScrcpyClient.pushServer(adb, binStream as any, DefaultServerPath)

  const isEmulator = serial.startsWith('emulator-')
  const options = new AdbScrcpyOptions3_1(
    {
      video: true,
      audio: false,
      control: true,
      videoCodec: 'h264',
      // Emulators lack hardware H264 encoder; force Google's software encoder
      ...(isEmulator ? { videoEncoder: 'OMX.google.h264.encoder' } : {}),
      videoBitRate: 4_000_000,
      maxFps: 30,
      maxSize: 1080,
      stayAwake: true,
    },
    { version: '3.1' },
  )

  const client = await AdbScrcpyClient.start(adb, DefaultServerPath, options)
  activeClient = client
  activeController = client.controller ?? null

  // Stream video packets in background — don't await
  void streamVideoPackets(client, webContents)
}

async function streamVideoPackets(
  client: Awaited<ReturnType<typeof AdbScrcpyClient.start>>,
  webContents: WebContents,
): Promise<void> {
  // videoStream is a Promise<AdbScrcpyVideoStream> when video:true
  const videoStreamPromise = client.videoStream as Promise<{ stream: ReadableStream<{ type: string; keyframe?: boolean; data: Uint8Array }> }> | undefined
  if (!videoStreamPromise) return
  const videoStream = await videoStreamPromise

  streamAbort = new AbortController()
  const { signal } = streamAbort
  const reader = videoStream.stream.getReader()

  try {
    while (!signal.aborted && !webContents.isDestroyed()) {
      const { done, value } = await reader.read()
      if (done) break

      if (value.type === 'configuration') {
        // Parse H.264 SPS/PPS to extract the codec string
        let codec: string | undefined
        try {
          const { profileIndex, constraintSet, levelIndex } = h264ParseConfiguration(value.data)
          codec = `avc1.${hex2(profileIndex)}${hex2(constraintSet)}${hex2(levelIndex)}`
        } catch { /* keep codec undefined — renderer will handle */ }
        webContents.send(IpcChannels.SCRCPY_VIDEO_PACKET, {
          type: 'configuration',
          codec,
          data: value.data,
        })
      } else {
        webContents.send(IpcChannels.SCRCPY_VIDEO_PACKET, {
          type: 'data',
          keyframe: value.keyframe,
          data: value.data,
        })
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function registerScrcpyHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.SCRCPY_START, async (event, payload: ScrcpyStartPayload) => {
    try {
      await launchScrcpy(payload.serial, event.sender)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IpcChannels.SCRCPY_STOP, async () => {
    await stopActive()
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.SCRCPY_INJECT_TOUCH, async (_event, payload: ScrcpyInjectTouchPayload) => {
    if (!activeController) return { ok: false, error: 'no controller' }
    try {
      await activeController.injectTouch({
        action: payload.action,
        pointerId: BigInt(0),
        pointerX: payload.x,
        pointerY: payload.y,
        videoWidth: payload.width,
        videoHeight: payload.height,
        pressure: payload.pressure,
        actionButton: 0,
        buttons: payload.action === 1 ? 0 : 1, // 0 on Up, primary button on Down/Move
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IpcChannels.SCRCPY_PRESS_BUTTON, async (_event, button: AppiumButton) => {
    if (!activeController) return { ok: false, error: 'no controller' }
    const keyCode = SCRCPY_BUTTON_KEYCODES[button]
    if (keyCode == null) return { ok: false, error: `unsupported button: ${button}` }

    const event = { keyCode, repeat: 0, metaState: AndroidKeyEventMeta.None }
    try {
      await activeController.injectKeyCode({ ...event, action: AndroidKeyEventAction.Down })
      await activeController.injectKeyCode({ ...event, action: AndroidKeyEventAction.Up })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function stopScrcpyOnQuit(): void {
  streamAbort?.abort()
  if (activeClient) {
    try { void activeClient.close() } catch { /* ignore */ }
    activeClient = null
  }
}
