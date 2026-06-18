import { Menu, shell } from 'electron'
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

function send(win: BrowserWindow, event: string, detail?: unknown) {
  win.webContents.send('menu-event', { event, detail })
}

export function setupMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),

    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => send(win, 'open-dialog', 'newProject'),
        },
        {
          label: 'Open Project…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send(win, 'open-project'),
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => send(win, 'open-dialog', 'settings'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    { role: 'editMenu' as const },

    {
      label: 'Project',
      submenu: [
        {
          label: 'Refresh Explorer',
          click: () => send(win, 'refresh-explorer'),
        },
        {
          label: 'Project Settings…',
          click: () => send(win, 'open-dialog', 'projectSettings'),
        },
        { type: 'separator' },
        {
          label: 'Open Folder in Finder',
          click: () => send(win, 'open-folder'),
        },
      ],
    },

    {
      label: 'Run',
      submenu: [
        {
          label: 'Run Test Case',
          accelerator: 'F5',
          click: () => send(win, 'run', { debug: false }),
        },
        {
          label: 'Debug Test Case',
          accelerator: 'F6',
          click: () => send(win, 'run', { debug: true }),
        },
        {
          label: 'Stop',
          accelerator: 'Shift+F5',
          click: () => send(win, 'stop'),
        },
        { type: 'separator' },
        {
          label: 'Run Test Suite',
          click: () => send(win, 'run-suite'),
        },
      ],
    },

    {
      label: 'Tools',
      submenu: [
        {
          label: 'Environment Manager…',
          click: () => send(win, 'open-dialog', 'envManager'),
        },
        {
          label: 'Reports',
          click: () => send(win, 'open-tab', 'reports'),
        },
        { type: 'separator' },
        {
          label: 'Keyword Manager',
          click: () => send(win, 'open-tab', 'keywords'),
        },
      ],
    },

    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
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
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },

    { role: 'windowMenu' as const },

    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://jkauto.io/docs').catch(() => {}),
        },
        { type: 'separator' },
        {
          label: 'About JKAuto',
          click: () => send(win, 'about'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
