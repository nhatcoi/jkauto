import path from 'node:path'
import { EXPLORER_META_FILE } from './explorer-metadata'
import { PROJECT_FEATURES } from './project-features'

const LEGACY_FEATURE_DIRS = ['api-requests']

export const EXPLORER_SKIPPED_DIRS = new Set([
  '.autotest',
  '.git',
  'node_modules',
])

export const EXPLORER_SKIPPED_FILES = new Set([
  EXPLORER_META_FILE,
  '.DS_Store',
  'Thumbs.db',
])

export const EXPLORER_ALLOWED_ROOT_DIRS = new Set([
  ...PROJECT_FEATURES.map((feature) => feature.key),
  ...LEGACY_FEATURE_DIRS,
])

export const EXPLORER_ALLOWED_ROOT_FILES = new Set([
  'project.json',
  '.mcp.json',
])

export function isAllowedExplorerRootEntry(
  name: string,
  type: 'directory' | 'file',
): boolean {
  return type === 'directory'
    ? EXPLORER_ALLOWED_ROOT_DIRS.has(name)
    : EXPLORER_ALLOWED_ROOT_FILES.has(name)
}

export function shouldSkipExplorerEntry(
  name: string,
  isFile: boolean,
): boolean {
  return (
    EXPLORER_SKIPPED_DIRS.has(name) ||
    (isFile && EXPLORER_SKIPPED_FILES.has(name))
  )
}

export function isAllowedExplorerPath(
  rootPath: string,
  targetPath: string,
): boolean {
  const relPath = path.relative(rootPath, targetPath)
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath))
    return false

  const [rootEntry] = relPath.split(path.sep)
  return (
    EXPLORER_ALLOWED_ROOT_DIRS.has(rootEntry) ||
    EXPLORER_ALLOWED_ROOT_FILES.has(rootEntry)
  )
}

export function shouldIgnoreExplorerWatchPath(
  rootPath: string,
  targetPath: string,
): boolean {
  if (targetPath === rootPath) return false

  const name = path.basename(targetPath)
  return (
    EXPLORER_SKIPPED_DIRS.has(name) ||
    EXPLORER_SKIPPED_FILES.has(name) ||
    !isAllowedExplorerPath(rootPath, targetPath)
  )
}
