import fs from 'node:fs'
import path from 'node:path'
import type { SeedEntry } from '../types'

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'target', 'coverage',
  '.next', '.nuxt', '.gradle', 'vendor', '.autotest',
])
const MAX_FILE_SIZE = 500_000
const SEED_DIR_NAMES = new Set([
  'seed', 'seeds', 'seeders', 'fixtures', '__fixtures__',
  'factory', 'factories', 'mocks', 'test-data', 'testdata', 'data',
])

function readFileSafe(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

// Find all directories whose basename matches SEED_DIR_NAMES, up to maxDepth
function findSeedDirs(root: string, maxDepth = 5, depth = 0): string[] {
  if (depth > maxDepth) return []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(root, { withFileTypes: true }) } catch { return [] }
  const results: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(root, entry.name)
    if (SEED_DIR_NAMES.has(entry.name.toLowerCase())) {
      results.push(full)
    }
    // Recurse into non-seed dirs to find nested seed dirs
    results.push(...findSeedDirs(full, maxDepth, depth + 1))
  }
  return results
}

function entityNameFromFile(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
    .replace(/[-_.]seed(er)?s?$/i, '')
    .replace(/[-_.]fixture?s?$/i, '')
    .replace(/[-_.]mock?s?$/i, '')
    .replace(/[-_.]data$/i, '')
    .replace(/[-_.]factory$/i, '')
    || path.basename(filePath, path.extname(filePath))
}

// ---- JSON seeds ------------------------------------------------------------

function processJsonFile(filePath: string): SeedEntry | null {
  const source = readFileSafe(filePath)
  if (!source) return null
  let parsed: unknown
  try { parsed = JSON.parse(source) } catch { return null }

  const entity = entityNameFromFile(filePath)

  if (Array.isArray(parsed)) {
    const count = parsed.length
    const sample = (parsed as Record<string, unknown>[]).slice(0, 3)
    return { entity, count, sample, sourceFile: filePath }
  }

  if (parsed && typeof parsed === 'object') {
    // Object with arrays as values: { users: [...], roles: [...] }
    const results: SeedEntry[] = []
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const count = value.length
        const sample = (value as Record<string, unknown>[]).slice(0, 3)
        results.push({ entity: key, count, sample, sourceFile: filePath })
      }
    }
    if (results.length === 1) return results[0]
    if (results.length > 1) {
      // Return combined as single entry using parent filename
      const count = results.reduce((sum, r) => sum + r.count, 0)
      return { entity, count, sample: results[0].sample, sourceFile: filePath }
    }
  }
  return null
}

// ---- TS/JS seeds -----------------------------------------------------------

function processJsFile(filePath: string): SeedEntry | null {
  const source = readFileSafe(filePath)
  if (!source) return null

  // Look for export default [...] or export const X = [...] or module.exports = [...]
  const hasArrayExport =
    /export\s+default\s*\[/.test(source) ||
    /export\s+const\s+\w+\s*=\s*\[/.test(source) ||
    /module\.exports\s*=\s*\[/.test(source) ||
    /exports\.\w+\s*=\s*\[/.test(source)

  if (!hasArrayExport) return null

  const entity = entityNameFromFile(filePath)

  // Count top-level objects in the array by counting '{' at approximate array element depth
  // Simple heuristic: count occurrences of object starts after the opening '['
  const arrayStart = source.search(/(?:export\s+default\s*\[|export\s+const\s+\w+\s*=\s*\[|module\.exports\s*=\s*\[)/)
  if (arrayStart === -1) return null

  const arrayContent = source.slice(arrayStart)
  // Count top-level object entries (each { at array level)
  let count = 0
  let depth = 0
  let inArray = false
  for (let i = 0; i < arrayContent.length; i++) {
    const ch = arrayContent[i]
    if (ch === '[' && !inArray) { inArray = true; continue }
    if (!inArray) continue
    if (ch === '{') {
      if (depth === 0) count++
      depth++
    } else if (ch === '}') {
      depth--
    } else if (ch === ']' && depth === 0) {
      break
    }
  }
  if (count === 0) return null

  // Extract up to 3 sample objects with simple regex
  const sample: Record<string, unknown>[] = []
  const objectPattern = /\{[^{}]*\}/g
  const objectMatches = arrayContent.match(objectPattern)
  if (objectMatches) {
    for (const objStr of objectMatches.slice(0, 3)) {
      try {
        // Convert JS object notation to JSON-like
        const jsonLike = objStr
          .replace(/(\w+)\s*:/g, '"$1":')
          .replace(/:\s*'([^']*)'/g, ': "$1"')
          .replace(/,\s*}/g, '}')
        sample.push(JSON.parse(jsonLike) as Record<string, unknown>)
      } catch {
        sample.push({ _raw: objStr.slice(0, 100) })
      }
    }
  }

  return { entity, count, sample, sourceFile: filePath }
}

// ---- SQL seeds -------------------------------------------------------------

function processSqlFile(filePath: string): SeedEntry[] {
  const source = readFileSafe(filePath)
  if (!source) return []

  const results: SeedEntry[] = []
  const tableMap = new Map<string, number>()

  // Match INSERT INTO tablename VALUES or INSERT INTO `tablename` VALUES
  const insertPattern = /INSERT\s+INTO\s+[`"']?(\w+)[`"']?\s+(?:\([^)]*\)\s+)?VALUES/gi
  let match: RegExpExecArray | null
  while ((match = insertPattern.exec(source)) !== null) {
    const tableName = match[1]
    tableMap.set(tableName, (tableMap.get(tableName) ?? 0) + 1)
  }

  for (const [tableName, count] of tableMap.entries()) {
    results.push({ entity: tableName, count, sample: [], sourceFile: filePath })
  }
  return results
}

// ---- Main export -----------------------------------------------------------

export function extractSeeds(repoPath: string): SeedEntry[] {
  const results: SeedEntry[] = []
  const seedDirs = findSeedDirs(repoPath)

  for (const seedDir of seedDirs) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(seedDir, { withFileTypes: true }) } catch { continue }

    for (const entry of entries) {
      if (!entry.isFile()) continue
      const full = path.join(seedDir, entry.name)
      const ext = path.extname(entry.name).toLowerCase()

      if (ext === '.json') {
        const entry_ = processJsonFile(full)
        if (entry_) results.push(entry_)
      } else if (ext === '.ts' || ext === '.js' || ext === '.mjs') {
        const entry_ = processJsFile(full)
        if (entry_) results.push(entry_)
      } else if (ext === '.sql') {
        results.push(...processSqlFile(full))
      }
    }
  }

  // Deduplicate by entity + sourceFile
  const seen = new Set<string>()
  return results.filter((entry) => {
    const key = `${entry.entity}:${entry.sourceFile}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
