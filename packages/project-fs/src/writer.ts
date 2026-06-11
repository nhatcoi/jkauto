import fs from 'node:fs/promises'
import { stringify as stringifyYaml } from 'yaml'
import type { ProjectFormat } from '@jkauto/core'

export async function writeProjectFile(
  filePath: string,
  data: unknown,
  format: ProjectFormat,
): Promise<void> {
  const content =
    format === 'yaml'
      ? stringifyYaml(data, { indent: 2 })
      : JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, content, 'utf-8')
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}
