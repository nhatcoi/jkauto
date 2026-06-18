import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_SNIPPET_CHARS = 4000
const MAX_FILES_PER_TYPE = 5

async function listFiles(dir: string, exts: string[]): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { recursive: true })
    return (entries as string[])
      .filter((e) => exts.some((x) => e.endsWith(x)))
      .map((e) => path.join(dir, e))
      .slice(0, MAX_FILES_PER_TYPE)
  } catch {
    return []
  }
}

async function readSnippet(filePath: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return raw.length > MAX_SNIPPET_CHARS
      ? raw.slice(0, MAX_SNIPPET_CHARS) + `\n... (truncated)`
      : raw
  } catch {
    return ''
  }
}

export async function buildProjectContext(projectPath: string): Promise<string> {
  const parts: string[] = []

  const [keywordFiles, testCaseFiles, profileFiles] = await Promise.all([
    listFiles(path.join(projectPath, 'keywords'), ['.keywords.json', '.keywords.yaml']),
    listFiles(path.join(projectPath, 'test-cases'), ['.test.yaml', '.test.yml']),
    listFiles(path.join(projectPath, 'profiles'), ['.env.json']),
  ])

  if (keywordFiles.length > 0) {
    const snippets = await Promise.all(
      keywordFiles.map(async (f) => `${path.basename(f)}:\n${await readSnippet(f)}`),
    )
    parts.push(`## Keywords\n${snippets.join('\n\n')}`)
  }

  if (testCaseFiles.length > 0) {
    const names = testCaseFiles.map((f) => path.basename(f)).join(', ')
    parts.push(`## Test Cases (${testCaseFiles.length} files)\n${names}`)
  }

  if (profileFiles.length > 0) {
    const snippets = await Promise.all(
      profileFiles.map(async (f) => `${path.basename(f)}:\n${await readSnippet(f)}`),
    )
    parts.push(`## Profiles\n${snippets.join('\n\n')}`)
  }

  return parts.length > 0 ? parts.join('\n\n') : ''
}
