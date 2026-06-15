import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerProjectHandlers } from './handlers/project.handler'
import { registerFsHandlers } from './handlers/fs.handler'
import { registerWorkspaceHandlers } from './handlers/workspace.handler'
import { registerDialogHandlers } from './handlers/dialog.handler'
import { registerEngineHandlers } from './handlers/engine.handler'
import { registerRunHandlers } from './handlers/run.handler'
import { registerHttpHandlers } from './handlers/http.handler'
import { registerEnvHandlers } from './handlers/env.handler'
import { registerHistoryHandlers } from './handlers/history.handler'
import { registerAgentHandlers } from './handlers/agent.handler'
import { registerSettingsHandlers } from './handlers/settings.handler'
import { registerAppiumHandlers, killAppiumOnQuit } from './handlers/appium.handler'
import {
  registerAppiumSessionHandlers,
  stopAppiumSessionOnQuit,
} from './handlers/appium-session.handler'
import { registerScrcpyHandlers, stopScrcpyOnQuit } from './handlers/scrcpy.handler'
import { IpcChannels } from '@jkauto/core'
import { setupMenu } from './menu'

let inspectorWindow: BrowserWindow | null = null

// Detached inspector window — loads the same renderer bundle with #inspector so
// the device mirror runs alongside the IDE instead of as a blocking modal.
function openInspectorWindow(): void {
  if (inspectorWindow && !inspectorWindow.isDestroyed()) {
    inspectorWindow.focus()
    return
  }
  inspectorWindow = new BrowserWindow({
    width: 1000,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    title: 'Mobile Inspector',
    backgroundColor: '#1a1d23',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  inspectorWindow.on('closed', () => {
    inspectorWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    inspectorWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#inspector`)
  } else {
    inspectorWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'inspector' })
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1d23',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerProjectHandlers(ipcMain)
  registerFsHandlers(ipcMain)
  registerWorkspaceHandlers(ipcMain)
  registerDialogHandlers(ipcMain)
  registerEngineHandlers(ipcMain)
  registerRunHandlers(ipcMain)
  registerHttpHandlers(ipcMain)
  registerEnvHandlers(ipcMain)
  registerHistoryHandlers(ipcMain)
  registerAgentHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerAppiumHandlers(ipcMain)
  registerAppiumSessionHandlers(ipcMain)
  registerScrcpyHandlers(ipcMain)
  ipcMain.handle(IpcChannels.APPIUM_INSPECTOR_OPEN, () => {
    openInspectorWindow()
    return { ok: true }
  })

  const win = createWindow()
  setupMenu(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      setupMenu(w)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopAppiumSessionOnQuit()
  killAppiumOnQuit()
  stopScrcpyOnQuit()
})
