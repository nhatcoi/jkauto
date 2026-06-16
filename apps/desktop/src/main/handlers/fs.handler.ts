import type { IpcMain, WebContents } from 'electron'
import { shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar from 'chokidar'
import { parse as parseYaml } from 'yaml'
import { IpcChannels } from '@jkauto/core'
import type { AppSettings } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'
import { getSettings } from '../services/settings.service'
import {
  EXPLORER_META_FILE,
  keyToDisplayName,
  readExplorerMetadataName,
  writeExplorerMetadata,
} from '../services/explorer-metadata'

type FSWatcher = ReturnType<typeof chokidar.watch>
const watchers = new Map<string, FSWatcher>()

const SKIP_DIRS = new Set(['.autotest', '.git', 'node_modules'])
const SKIP_FILES = new Set([EXPLORER_META_FILE])

type ExplorerSettings = AppSettings['explorer']

function isMetadataFile(fileName: string): boolean {
  return fileName.endsWith('.json') || fileName.endsWith('.yaml') || fileName.endsWith('.yml')
}

function parseMetadata(raw: string, fileName: string): unknown {
  if (fileName.endsWith('.json')) return JSON.parse(raw)
  return parseYaml(raw)
}

async function readMetadataDisplayName(filePath: string, fileName: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = parseMetadata(raw, fileName) as { name?: unknown }
    return typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : undefined
  } catch {
    return undefined
  }
}

async function getDirectoryDisplayName(
  fullPath: string,
  relPath: string,
  dirName: string,
  explorer: ExplorerSettings,
): Promise<string | undefined> {
  const metadataName = await readExplorerMetadataName(fullPath)
  if (metadataName) return metadataName

  const parts = relPath.split(path.sep)
  if (parts.length === 1) return explorer.featureAliases[dirName] ?? keyToDisplayName(dirName)
  return keyToDisplayName(dirName)
}

async function buildTree(
  rootPath: string,
  basePath: string,
  explorer: ExplorerSettings,
): Promise<FsTreeNode[]> {
  let entries: import('node:fs').Dirent<string>[]
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true, encoding: 'utf-8' })
  } catch {
    return []
  }

  const nodes: FsTreeNode[] = []
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    if (entry.isFile() && SKIP_FILES.has(entry.name)) continue
    const fullPath = path.join(rootPath, entry.name)
    const relPath = path.relative(basePath, fullPath)

    if (entry.isDirectory()) {
      nodes.push({
        id: relPath,
        name: entry.name,
        displayName: await getDirectoryDisplayName(fullPath, relPath, entry.name, explorer),
        path: fullPath,
        type: 'directory',
        children: await buildTree(fullPath, basePath, explorer),
      })
    } else {
      const displayName = explorer.fileDisplayName === 'metadataName' && isMetadataFile(entry.name)
        ? await readMetadataDisplayName(fullPath, entry.name)
        : undefined

      nodes.push({
        id: relPath,
        name: entry.name,
        displayName,
        path: fullPath,
        type: 'file',
        ext: path.extname(entry.name),
      })
    }
  }

  const orderMap = new Map(explorer.featureOrder.map((feature, index) => [feature, index]))

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    const aTopLevel = path.dirname(a.id) === '.'
    const bTopLevel = path.dirname(b.id) === '.'
    if (aTopLevel && bTopLevel) {
      const aOrder = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER
      const bOrder = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
    }
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
    return buildTree(rootPath, rootPath, settings.explorer)
  })

  ipcMain.handle(IpcChannels.FS_CREATE_DIR, async (_, dirPath: string, displayName?: string) => {
    await fs.mkdir(dirPath, { recursive: true })
    if (displayName) await writeExplorerMetadata(dirPath, displayName)
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
    IpcChannels.FS_RENAME_DISPLAY,
    async (_, oldPath: string, newPath: string, displayName: string, isDir: boolean) => {
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

  ipcMain.handle(IpcChannels.FS_OPEN_CONTAINING_FOLDER, async (_, targetPath: string) => {
    await shell.showItemInFolder(targetPath)
  })

  ipcMain.handle(IpcChannels.FS_WATCH_START, (event, rootPath: string) => {
    if (watchers.has(rootPath)) return
    const webContents: WebContents = event.sender
    const watcher = chokidar.watch(rootPath, {
      ignored: (p: string) => SKIP_DIRS.has(path.basename(p)) || SKIP_FILES.has(path.basename(p)),
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
