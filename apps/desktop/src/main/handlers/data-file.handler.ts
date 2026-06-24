import type { IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IpcChannels } from '@jkauto/core'
import type {
  DataFileListPayload, DataFileReadPayload, DataFileWritePayload,
  DataFileCreatePayload, DataFileEntry, DataFileAiGeneratePayload,
  DataFileAiGenerateResult,
} from '@jkauto/core'
import type { DataFile } from '@jkauto/core'
import { randomUUID } from 'node:crypto'
import { getSettings } from '../services/settings.service'
import { getCodeAnalysisReport } from '../services/analysis/analysis.service'
import { generateTextLocal, getConfig } from '../services/agent/llm-client'

export function registerDataFileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IpcChannels.DATA_FILE_LIST, async (_, payload: DataFileListPayload): Promise<DataFileEntry[]> => {
    const dir = path.join(payload.projectPath, 'data-files')
    try {
      const entries = await fs.readdir(dir)
      return entries
        .filter((f) => f.endsWith('.data.json') && !f.startsWith('.'))
        .map((f) => ({ name: f.replace(/\.data\.json$/, ''), path: path.join(dir, f) }))
    } catch {
      return []
    }
  })

  ipcMain.handle(IpcChannels.DATA_FILE_READ, async (_, payload: DataFileReadPayload): Promise<DataFile> => {
    const raw = await fs.readFile(payload.filePath, 'utf-8')
    return JSON.parse(raw) as DataFile
  })

  ipcMain.handle(IpcChannels.DATA_FILE_WRITE, async (_, payload: DataFileWritePayload): Promise<void> => {
    await fs.writeFile(payload.filePath, JSON.stringify(payload.data, null, 2), 'utf-8')
  })

  ipcMain.handle(IpcChannels.DATA_FILE_CREATE, async (_, payload: DataFileCreatePayload): Promise<string> => {
    const dir = path.join(payload.projectPath, 'data-files')
    await fs.mkdir(dir, { recursive: true })
    const slug = payload.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const filePath = path.join(dir, `${slug}.data.json`)
    const data: DataFile = {
      schemaVersion: 1,
      name: payload.name,
      columns: ['column1'],
      rows: [['value1']],
    }
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return filePath
  })

  ipcMain.handle(
    IpcChannels.DATA_FILE_AI_GENERATE,
    async (_, payload: DataFileAiGeneratePayload): Promise<DataFileAiGenerateResult> => {
      const report = getCodeAnalysisReport(payload.projectPath)
      const analysisUsed = !!report

      let analysisContext = ''
      if (report) {
        const routeArtifact = report.artifacts.find((a) => a.type === 'route-catalog')
        const entityArtifact = report.artifacts.find((a) => a.type === 'symbol-catalog')
        const validationArtifact = report.artifacts.find((a) => a.type === 'validation-catalog')
        const summaryArtifact = report.artifacts.find((a) => a.type === 'project-summary')

        const parts: string[] = []
        if (summaryArtifact) parts.push(`Project: ${summaryArtifact.summary}`)
        if (routeArtifact) {
          const routes = JSON.parse(routeArtifact.contentJson) as { endpoints?: { method: string; path: string; summary?: string }[] }
          if (routes.endpoints?.length) {
            parts.push(`API Endpoints:\n${routes.endpoints.slice(0, 30).map((e) => `  ${e.method} ${e.path}${e.summary ? ` — ${e.summary}` : ''}`).join('\n')}`)
          }
        }
        if (entityArtifact) {
          const entities = JSON.parse(entityArtifact.contentJson) as { symbols?: { name: string; type: string; fields?: { name: string; type?: string }[] }[] }
          const dtos = entities.symbols?.filter((s) => s.type === 'dto' || s.type === 'entity' || s.type === 'schema').slice(0, 15)
          if (dtos?.length) {
            parts.push(`Data Models:\n${dtos.map((d) => `  ${d.name}${d.fields?.length ? ': ' + d.fields.map((f) => f.name).join(', ') : ''}`).join('\n')}`)
          }
        }
        if (validationArtifact) {
          const validation = JSON.parse(validationArtifact.contentJson) as { rules?: { field: string; constraint: string }[] }
          if (validation.rules?.length) {
            parts.push(`Validation Rules:\n${validation.rules.slice(0, 20).map((r) => `  ${r.field}: ${r.constraint}`).join('\n')}`)
          }
        }
        analysisContext = parts.join('\n\n')
      }

      const userPrompt = payload.prompt?.trim() || 'Generate comprehensive test data files for this project.'

      const systemPrompt = `You are a test data generator for automated API testing.
Generate test data files in JSON format for data-driven testing.

Each file should cover a specific endpoint or feature with multiple test scenarios including:
- Happy path (valid data, expected success)
- Edge cases (boundary values, empty fields)
- Error cases (invalid data, missing required fields)

${analysisContext ? `PROJECT ANALYSIS:\n${analysisContext}\n\n` : ''}
Respond with ONLY valid JSON array — no markdown, no explanation:
[
  {
    "name": "kebab-case-filename",
    "description": "Brief description",
    "columns": ["col1", "col2", "expectedStatus", "scenario"],
    "rows": [["val1", "val2", "200", "happy path"], ...]
  }
]

Rules:
- name: kebab-case, no spaces
- columns: snake_case or camelCase, always include "expectedStatus" and a "scenario" column
- rows: 4-8 rows per file covering different scenarios
- Generate 2-4 files covering the main features`

      const settings = await getSettings()
      const config = getConfig(settings.agent)

      const text = await generateTextLocal(config, systemPrompt, userPrompt)

      let files: DataFileAiGenerateResult['files'] = []
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          files = JSON.parse(jsonMatch[0])
        }
      } catch {
        files = []
      }

      return { files, analysisUsed }
    },
  )
}

/** Parse a .data.json file into an array of variable maps (one per row). */
export async function loadDataFileRows(filePath: string): Promise<Record<string, string>[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as DataFile
    return data.rows.map((row) => {
      const vars: Record<string, string> = {}
      data.columns.forEach((col, i) => { vars[col] = row[i] ?? '' })
      return vars
    })
  } catch {
    return []
  }
}
