import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_SNIPPET_CHARS = 4000
const MAX_FILES_PER_TYPE = 10
const MAX_PROFILE_CHARS = 2000
const MAX_OBJ_REPO_CHARS = 3000

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

async function readProfileContent(filePath: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    // Only expose variable keys + values (not auth tokens for security)
    const vars = parsed.variables ?? parsed ?? {}
    const safe = Object.fromEntries(
      Object.entries(vars).map(([k, v]) => {
        const val = String(v)
        // Mask anything that looks like a token/secret
        const masked = /token|secret|password|key|auth/i.test(k) ? '***' : val
        return [k, masked]
      })
    )
    const content = JSON.stringify({ name: parsed.name ?? path.basename(filePath), variables: safe }, null, 2)
    return content.length > MAX_PROFILE_CHARS ? content.slice(0, MAX_PROFILE_CHARS) + '\n...' : content
  } catch {
    return ''
  }
}

async function readObjectRepo(filePath: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    // Summarize: name + locator strategies (not full details)
    const objects = Array.isArray(parsed.objects) ? parsed.objects : []
    const summary = {
      page: parsed.name ?? path.basename(filePath),
      objects: objects.map((o: { name: string; locators?: Array<{ strategy: string; value: string }> }) => ({
        name: o.name,
        primaryLocator: o.locators?.[0]
          ? `${o.locators[0].strategy}=${o.locators[0].value}`
          : undefined,
      })),
    }
    const content = JSON.stringify(summary, null, 2)
    return content.length > MAX_OBJ_REPO_CHARS ? content.slice(0, MAX_OBJ_REPO_CHARS) + '\n...' : content
  } catch {
    return ''
  }
}

async function listTestSuites(projectPath: string): Promise<string[]> {
  const dir = path.join(projectPath, 'test-suites')
  try {
    const entries = await fs.readdir(dir, { recursive: true })
    return (entries as string[])
      .filter((e) => e.endsWith('.suite.yaml') || e.endsWith('.suite.yml'))
      .map((e) => path.join(dir, e))
  } catch {
    return []
  }
}

export async function buildProjectContext(projectPath: string): Promise<string> {
  const parts: string[] = []

  // Expose project.json metadata (name, type, sourcePath) so agent knows where source code lives
  try {
    const proj = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf-8'))
    const meta: string[] = [`name: ${proj.name ?? '?'}`, `type: ${proj.type ?? '?'}`]
    if (proj.sourcePath) meta.push(`sourcePath: ${proj.sourcePath} (use search_in_codebase with this path to find selectors and API routes)`)
    if (proj.repoUrl) meta.push(`repoUrl: ${proj.repoUrl}`)
    parts.push(`## Project\n${meta.join('\n')}`)
  } catch { /* no project.json */ }

  const [keywordFiles, testCaseFiles, profileFiles, objRepoFiles, apiRequestFiles, suiteFiles] = await Promise.all([
    listFiles(path.join(projectPath, 'keywords'), ['.keywords.json', '.keywords.yaml']),
    listFiles(path.join(projectPath, 'test-cases'), ['.test.yaml', '.test.yml']),
    listFiles(path.join(projectPath, 'profiles'), ['.env.json']),
    listFiles(path.join(projectPath, 'object-repository'), ['.objects.json']),
    listFiles(path.join(projectPath, 'api-requests'), ['.request.json']),
    listTestSuites(projectPath),
  ])

  // Keywords: list only
  if (keywordFiles.length > 0) {
    const names = keywordFiles.map((f) => path.basename(f)).join(', ')
    parts.push(`## Keywords (${keywordFiles.length} files)\n${names}`)
  }

  // Test cases: relative paths so agent knows folder structure
  if (testCaseFiles.length > 0) {
    const names = testCaseFiles
      .map((f) => path.relative(projectPath, f))
      .join('\n  - ')
    parts.push(`## Test Cases (${testCaseFiles.length} files)\n  - ${names}`)
  }

  // Test suites: list + item count
  if (suiteFiles.length > 0) {
    const suiteInfos = await Promise.all(
      suiteFiles.map(async (f) => {
        try {
          const raw = await fs.readFile(f, 'utf-8')
          const parsed = JSON.parse(raw)
          const items = Array.isArray(parsed.items) ? parsed.items.length : 0
          return `${path.relative(projectPath, f)} (${items} tests)`
        } catch {
          return path.relative(projectPath, f)
        }
      })
    )
    parts.push(`## Test Suites\n  - ${suiteInfos.join('\n  - ')}`)
  }

  // Profiles: full content (variables masked for secrets)
  if (profileFiles.length > 0) {
    const contents = await Promise.all(profileFiles.map(readProfileContent))
    const profileSection = profileFiles
      .map((f, i) => `### ${path.basename(f)}\n${contents[i]}`)
      .join('\n')
    parts.push(`## Profiles (${profileFiles.length})\n${profileSection}`)
  }

  // Object repositories: summarized selectors
  if (objRepoFiles.length > 0) {
    const contents = await Promise.all(objRepoFiles.map(readObjectRepo))
    const repoSection = objRepoFiles
      .map((f, i) => `### ${path.basename(f)}\n${contents[i]}`)
      .join('\n')
    parts.push(`## Object Repositories (${objRepoFiles.length})\n${repoSection}`)
  }

  // API request templates: list only
  if (apiRequestFiles.length > 0) {
    const names = apiRequestFiles.map((f) => path.basename(f)).join(', ')
    parts.push(`## API Request Templates (${apiRequestFiles.length} files)\n${names}`)
  }

  return parts.length > 0 ? parts.join('\n\n') : ''
}
