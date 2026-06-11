import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type { RequestHistoryRecord, HttpHistorySavePayload } from '@jkauto/core'

const MAX_RECORDS = 30

function slugFromPath(filePath: string): string {
  return path.basename(filePath).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function historyFile(filePath: string): Promise<string> {
  let dir = path.dirname(filePath)
  for (let i = 0; i < 10; i++) {
    try {
      await fs.access(path.join(dir, 'project.json'))
      return path.join(dir, '.autotest', 'request-history', `${slugFromPath(filePath)}.json`)
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return path.join(path.dirname(filePath), '.autotest', 'request-history', `${slugFromPath(filePath)}.json`)
}

async function readHistory(filePath: string): Promise<RequestHistoryRecord[]> {
  try {
    const file = await historyFile(filePath)
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as RequestHistoryRecord[]
  } catch {
    return []
  }
}

export function registerHistoryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.HTTP_HISTORY_GET, async (_, filePath: string) => {
    return readHistory(filePath)
  })

  ipcMain.handle(IpcChannels.HTTP_HISTORY_SAVE, async (_, payload: HttpHistorySavePayload) => {
    const { filePath, record } = payload
    const existing = await readHistory(filePath)
    const updated = [record, ...existing].slice(0, MAX_RECORDS)
    const file = await historyFile(filePath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(updated, null, 2), 'utf-8')
  })
}
