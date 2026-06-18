import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { AppSettings, FsTreeNode } from '@jkauto/core'
import { keyToDisplayName, readExplorerMetadataName } from './explorer-metadata'
import {
  isAllowedExplorerRootEntry,
  shouldSkipExplorerEntry,
} from './explorer-policy'

type ExplorerSettings = AppSettings['explorer']

function isMetadataFile(fileName: string): boolean {
  return (
    fileName.endsWith('.json') ||
    fileName.endsWith('.yaml') ||
    fileName.endsWith('.yml')
  )
}

function parseMetadata(raw: string, fileName: string): unknown {
  return fileName.endsWith('.json') ? JSON.parse(raw) : parseYaml(raw)
}

async function readMetadataDisplayName(
  filePath: string,
  fileName: string,
): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = parseMetadata(raw, fileName) as { name?: unknown }
    return typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name
      : undefined
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
  if (parts.length === 1)
    return explorer.featureAliases[dirName] ?? keyToDisplayName(dirName)
  return keyToDisplayName(dirName)
}

export async function buildExplorerTree(
  rootPath: string,
  explorer: ExplorerSettings,
  basePath = rootPath,
): Promise<FsTreeNode[]> {
  let entries: import('node:fs').Dirent<string>[]
  try {
    entries = await fs.readdir(rootPath, {
      withFileTypes: true,
      encoding: 'utf-8',
    })
  } catch {
    return []
  }

  const nodes: FsTreeNode[] = []
  for (const entry of entries) {
    if (shouldSkipExplorerEntry(entry.name, entry.isFile())) continue

    const fullPath = path.join(rootPath, entry.name)
    const relPath = path.relative(basePath, fullPath)
    const isRootEntry = path.dirname(relPath) === '.'
    const entryType = entry.isDirectory() ? 'directory' : 'file'

    if (isRootEntry && !isAllowedExplorerRootEntry(entry.name, entryType))
      continue

    if (entry.isDirectory()) {
      nodes.push({
        id: relPath,
        name: entry.name,
        displayName: await getDirectoryDisplayName(
          fullPath,
          relPath,
          entry.name,
          explorer,
        ),
        path: fullPath,
        type: 'directory',
        children: await buildExplorerTree(fullPath, explorer, basePath),
      })
      continue
    }

    const displayName =
      explorer.fileDisplayName === 'metadataName' && isMetadataFile(entry.name)
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

  const orderMap = new Map(
    explorer.featureOrder.map((feature, index) => [feature, index]),
  )

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
