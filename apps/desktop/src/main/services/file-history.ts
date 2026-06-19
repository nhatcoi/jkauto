import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_VERSIONS = 30

const PROJECT_FILE_EXTS = new Set([
  '.json', '.yaml', '.yml',
])

function isProjectFile(filePath: string): boolean {
  return PROJECT_FILE_EXTS.has(path.extname(filePath).toLowerCase())
}

async function findProjectRoot(filePath: string): Promise<string | null> {
  let dir = path.dirname(filePath)
  for (let i = 0; i < 10; i++) {
    try {
      await fs.access(path.join(dir, 'project.json'))
      return dir
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  }
  return null
}

function makeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
}

function getSlug(projectRoot: string, filePath: string): string {
  const rel = path.relative(projectRoot, filePath)
  return rel.replace(/[/\\]/g, '__')
}

async function getHistoryDir(projectRoot: string, filePath: string): Promise<string> {
  const slug = getSlug(projectRoot, filePath)
  return path.join(projectRoot, '.autotest', 'file-history', slug)
}

async function pruneHistory(histDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(histDir)
    const sorted = entries.sort().reverse()
    for (const entry of sorted.slice(MAX_VERSIONS)) {
      await fs.rm(path.join(histDir, entry), { force: true })
    }
  } catch {
    // ignore
  }
}

export async function createBackup(filePath: string): Promise<string | null> {
  if (!isProjectFile(filePath)) return null
  try {
    await fs.access(filePath)
  } catch {
    return null // file doesn't exist yet, nothing to backup
  }

  const projectRoot = await findProjectRoot(filePath)
  if (!projectRoot) return null

  const histDir = await getHistoryDir(projectRoot, filePath)
  await fs.mkdir(histDir, { recursive: true })

  const ext = path.extname(filePath)
  const backupPath = path.join(histDir, `${makeTimestamp()}${ext}`)
  await fs.copyFile(filePath, backupPath)
  await pruneHistory(histDir)
  return backupPath
}

export interface FileVersionEntry {
  timestamp: string
  backupPath: string
  sizeBytes: number
}

export async function listHistory(filePath: string): Promise<FileVersionEntry[]> {
  const projectRoot = await findProjectRoot(filePath)
  if (!projectRoot) return []

  const histDir = await getHistoryDir(projectRoot, filePath)
  try {
    const entries = await fs.readdir(histDir)
    const results: FileVersionEntry[] = []
    for (const entry of entries.sort().reverse().slice(0, MAX_VERSIONS)) {
      try {
        const fullPath = path.join(histDir, entry)
        const stat = await fs.stat(fullPath)
        results.push({ timestamp: stat.mtime.toISOString(), backupPath: fullPath, sizeBytes: stat.size })
      } catch {
        // skip corrupt entry
      }
    }
    return results
  } catch {
    return []
  }
}

export async function restoreVersion(filePath: string, backupPath: string): Promise<void> {
  // backup current state before overwriting
  await createBackup(filePath)
  await fs.copyFile(backupPath, filePath)
}
