import type { IpcMain, WebContents } from 'electron'
import { shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar from 'chokidar'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'

type FSWatcher = ReturnType<typeof chokidar.watch>
const watchers = new Map<string, FSWatcher>()

const SKIP_DIRS = new Set(['.autotest', '.git', 'node_modules'])

async function buildTree(rootPath: string, basePath: string): Promise<FsTreeNode[]> {
  let entries: import('node:fs').Dirent<string>[]
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true, encoding: 'utf-8' })
  } catch {
    return []
  }

  const nodes: FsTreeNode[] = []
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(rootPath, entry.name)
    const relPath = path.relative(basePath, fullPath)

    if (entry.isDirectory()) {
      nodes.push({
        id: relPath,
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: await buildTree(fullPath, basePath),
      })
    } else {
      nodes.push({
        id: relPath,
        name: entry.name,
        path: fullPath,
        type: 'file',
        ext: path.extname(entry.name),
      })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function registerFsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.FS_READ_FILE, async (_, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(
    IpcChannels.FS_WRITE_FILE,
    async (_, filePath: string, content: string) => {
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
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map((e) => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      type: e.isDirectory() ? 'directory' : 'file',
      ext: e.isFile() ? path.extname(e.name) : undefined,
    }))
  })

  ipcMain.handle(IpcChannels.FS_TREE, async (_, rootPath: string) => {
    return buildTree(rootPath, rootPath)
  })

  ipcMain.handle(IpcChannels.FS_CREATE_DIR, async (_, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
  })

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
    IpcChannels.FS_COPY,
    async (_, srcPath: string, destPath: string) => {
      await fs.cp(srcPath, destPath, { recursive: true })
    },
  )

  ipcMain.handle(IpcChannels.FS_OPEN_CONTAINING_FOLDER, async (_, targetPath: string) => {
    await shell.showItemInFolder(targetPath)
  })

  ipcMain.handle(IpcChannels.FS_WATCH_START, (event, rootPath: string) => {
    if (watchers.has(rootPath)) return
    const webContents: WebContents = event.sender
    const watcher = chokidar.watch(rootPath, {
      ignored: (p: string) => SKIP_DIRS.has(path.basename(p)),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    })
    watcher.on('all', (eventType, filePath) => {
      if (!webContents.isDestroyed()) {
        webContents.send(IpcChannels.FS_WATCH_EVENT, { eventType, path: filePath })
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
