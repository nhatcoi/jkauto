import { Menu } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { IpcChannels } from '@jkauto/core'
import { getSettings, setSettings } from './services/settings.service'

const MIN = 0.5
const MAX = 3
const STEP = 0.1

async function applyZoom(win: BrowserWindow, factor: number): Promise<void> {
  const clamped = Math.round(Math.min(MAX, Math.max(MIN, factor)) * 10) / 10
  win.webContents.setZoomFactor(clamped)
  win.webContents.send(IpcChannels.APP_ZOOM_CHANGED, clamped)
  const settings = await getSettings()
  await setSettings({ appearance: { ...settings.appearance, zoomFactor: clamped } })
}

export function setupMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' as const },
    { role: 'editMenu' as const },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => applyZoom(win, 1),
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => applyZoom(win, win.webContents.getZoomFactor() + STEP),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => applyZoom(win, win.webContents.getZoomFactor() - STEP),
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    { role: 'windowMenu' as const },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
