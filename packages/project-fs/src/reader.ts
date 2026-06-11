import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { ProjectFormat } from '@jkauto/core'

export async function readProjectFile<T>(
  filePath: string,
  format: ProjectFormat,
): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return format === 'yaml' ? (parseYaml(raw) as T) : (JSON.parse(raw) as T)
}

export async function listDir(dirPath: string) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries.map((e) => ({
    name: e.name,
    path: path.join(dirPath, e.name),
    type: e.isDirectory() ? ('directory' as const) : ('file' as const),
    ext: e.isFile() ? path.extname(e.name) : undefined,
  }))
}
