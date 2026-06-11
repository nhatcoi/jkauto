import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerProjectHandlers } from './handlers/project.handler'
import { registerFsHandlers } from './handlers/fs.handler'
import { registerWorkspaceHandlers } from './handlers/workspace.handler'
import { registerDialogHandlers } from './handlers/dialog.handler'
import { registerEngineHandlers } from './handlers/engine.handler'
import { registerRunHandlers } from './handlers/run.handler'

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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
