import type { IpcMain, WebContents } from 'electron'
import { shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar from 'chokidar'
import { parse as parseYaml } from 'yaml'
import { IpcChannels } from '@jkauto/core'
import { getSettings } from '../services/settings.service'
import { writeExplorerMetadata } from '../services/explorer-metadata'
import { shouldIgnoreExplorerWatchPath } from '../services/explorer-policy'
import { buildExplorerTree } from '../services/explorer-tree'
import { createBackup } from '../services/file-history'

type FSWatcher = ReturnType<typeof chokidar.watch>
const watchers = new Map<string, FSWatcher>()

function isMetadataFile(fileName: string): boolean {
  return (
    fileName.endsWith('.json') ||
    fileName.endsWith('.yaml') ||
    fileName.endsWith('.yml')
  )
}

function parseMetadata(raw: string, fileName: string): unknown {
  if (fileName.endsWith('.json')) return JSON.parse(raw)
  return parseYaml(raw)
}

export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.FS_READ_FILE, async (_, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(
    IpcChannels.FS_WRITE_FILE,
    async (_, filePath: string, content: string) => {
      await createBackup(filePath)
      await fs.writeFile(filePath, content, 'utf-8')
    },
  )

  ipcMain.handle(
    IpcChannels.FS_CREATE_FILE,
    async (_, filePath: string, content: string) => {
      await fs.writeFile(filePath, content, 'utf-8')
    },
  )

  ipcMain.handle(IpcChannels.FS_LIST_DIR, async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries.map((e) => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        type: e.isDirectory() ? 'directory' : 'file',
        ext: e.isFile() ? path.extname(e.name) : undefined,
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle(IpcChannels.FS_TREE, async (_, rootPath: string) => {
    const settings = await getSettings()
    return buildExplorerTree(rootPath, settings.explorer)
  })

  ipcMain.handle(
    IpcChannels.FS_CREATE_DIR,
    async (_, dirPath: string, displayName?: string) => {
      await fs.mkdir(dirPath, { recursive: true })
      if (displayName) await writeExplorerMetadata(dirPath, displayName)
    },
  )

  ipcMain.handle(IpcChannels.FS_DELETE, async (_, targetPath: string) => {
    await fs.rm(targetPath, { recursive: true, force: true })
  })

  ipcMain.handle(
    IpcChannels.FS_RENAME,
    async (_, oldPath: string, newPath: string) => {
      await fs.rename(oldPath, newPath)
    },
  )

  ipcMain.handle(
    IpcChannels.FS_RENAME_DISPLAY,
    async (
      _,
      oldPath: string,
      newPath: string,
      displayName: string,
      isDir: boolean,
    ) => {
      await fs.rename(oldPath, newPath)
      if (isDir) {
        await writeExplorerMetadata(newPath, displayName)
      } else if (isMetadataFile(path.basename(newPath))) {
        try {
          const raw = await fs.readFile(newPath, 'utf-8')
          const fileName = path.basename(newPath)
          const parsed = parseMetadata(raw, fileName) as Record<string, unknown>
          parsed.name = displayName
          const content = fileName.endsWith('.json')
            ? JSON.stringify(parsed, null, 2)
            : (await import('yaml')).stringify(parsed)
          await fs.writeFile(newPath, content, 'utf-8')
        } catch {
          // non-critical: file renamed, metadata update failed silently
        }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.FS_COPY,
    async (_, srcPath: string, destPath: string) => {
      await fs.cp(srcPath, destPath, { recursive: true })
    },
  )

  ipcMain.handle(
    IpcChannels.FS_OPEN_CONTAINING_FOLDER,
    async (_, targetPath: string) => {
      await shell.showItemInFolder(targetPath)
    },
  )

  ipcMain.handle(IpcChannels.FS_WATCH_START, (event, rootPath: string) => {
    if (watchers.has(rootPath)) return
    const webContents: WebContents = event.sender
    const watcher = chokidar.watch(rootPath, {
      ignored: (targetPath: string) =>
        shouldIgnoreExplorerWatchPath(rootPath, targetPath),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    })
    watcher.on('all', (eventType, filePath) => {
      if (!webContents.isDestroyed()) {
        webContents.send(IpcChannels.FS_WATCH_EVENT, {
          eventType,
          path: filePath,
        })
      }
    })
    watchers.set(rootPath, watcher)
  })

  ipcMain.handle(IpcChannels.FS_WATCH_STOP, async (_, rootPath: string) => {
    const watcher = watchers.get(rootPath)
    if (watcher) {
      await watcher.close()
      watchers.delete(rootPath)
    }
  })
}
