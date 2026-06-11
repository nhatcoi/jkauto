import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { RunRecord } from '@jkauto/core'

const MAX_RUNS_PER_FILE = 50

/**
 * Derive a safe filename slug from an absolute test-case path.
 * e.g. /home/user/project/test-cases/login.tc.json → login_tc
 */
function slugFromPath(filePath: string): string {
  return path.basename(filePath).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Returns the directory where run records for a given test-case file are stored.
 * We walk up from filePath to find the project root (directory containing project.json).
 * Falls back to filePath's parent if no project root is found.
 */
async function runsDir(filePath: string): Promise<string> {
  let dir = path.dirname(filePath)
  for (let i = 0; i < 10; i++) {
    try {
      await fs.access(path.join(dir, 'project.json'))
      return path.join(dir, '.autotest', 'runs')
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  // fallback: store next to the file
  return path.join(path.dirname(filePath), '.autotest', 'runs')
}

async function runsFile(filePath: string): Promise<string> {
  const dir = await runsDir(filePath)
  const slug = slugFromPath(filePath)
  return path.join(dir, `${slug}.json`)
}

async function readRuns(filePath: string): Promise<RunRecord[]> {
  try {
    const file = await runsFile(filePath)
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as RunRecord[]
  } catch {
    return []
  }
}

async function writeRuns(filePath: string, runs: RunRecord[]): Promise<void> {
  const file = await runsFile(filePath)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(runs, null, 2), 'utf-8')
}

export function registerRunHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.ENGINE_GET_RUNS, async (_, filePath: string) => {
    return readRuns(filePath)
  })

  ipcMain.handle(IpcChannels.ENGINE_SAVE_RUN, async (_, filePath: string, record: RunRecord) => {
    const existing = await readRuns(filePath)
    // newest first, cap at MAX_RUNS_PER_FILE
    const updated = [record, ...existing].slice(0, MAX_RUNS_PER_FILE)
    await writeRuns(filePath, updated)
  })
}
