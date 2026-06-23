import fs from 'node:fs'
import path from 'node:path'
import type { EntityField, EntityModel, Framework, Language } from '../types'

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'target', 'coverage',
  '.next', '.nuxt', '.gradle', 'vendor', '.autotest',
])
const MAX_FILE_SIZE = 500_000

function readFileSafe(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function walkFiles(
  dir: string,
  matcher: (name: string) => boolean,
  maxDepth = 8,
  depth = 0,
): string[] {
  if (depth > maxDepth) return []
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const results: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) results.push(...walkFiles(full, matcher, maxDepth, depth + 1))
    } else if (entry.isFile() && matcher(entry.name)) {
      results.push(full)
    }
  }
  return results
}

// ---- TypeORM ---------------------------------------------------------------

function parseTypeOrmEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => /\.entity\.(ts|js)$/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    // Match @Entity('tableName') or @Entity() followed by class ClassName
    const entityPattern = /@Entity\s*\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)[\s\S]*?class\s+(\w+)/g
    let match: RegExpExecArray | null
    while ((match = entityPattern.exec(source)) !== null) {
      const tableName = match[1] ?? match[2] ?? undefined
      const className = match[3]
      const classStart = match.index
      // Find the class body
      const bodyStart = source.indexOf('{', classStart + match[0].length - 1)
      if (bodyStart === -1) continue
      let braceDepth = 1
      let bodyEnd = bodyStart + 1
      while (bodyEnd < source.length && braceDepth > 0) {
        if (source[bodyEnd] === '{') braceDepth++
        else if (source[bodyEnd] === '}') braceDepth--
        bodyEnd++
      }
      const classBody = source.slice(bodyStart + 1, bodyEnd - 1)
      const fields = extractTypeOrmFields(classBody)
      const line = source.slice(0, match.index).split('\n').length
      results.push({ name: className, tableName, fields, sourceFile: filePath, line, framework: 'typeorm' })
    }
  }
  return results
}

function extractTypeOrmFields(classBody: string): EntityField[] {
  const fields: EntityField[] = []
  // Match @Column(...), @PrimaryGeneratedColumn(...), @PrimaryColumn(...) decorators
  const fieldPattern = /@(PrimaryGeneratedColumn|PrimaryColumn|Column)\s*(?:\(([^)]*)\))?\s*\n?\s*(\w+)\s*[?!]?\s*:\s*([\w<>[\]|& ]+)/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(classBody)) !== null) {
    const decoratorName = match[1]
    const decoratorArgs = match[2] ?? ''
    const fieldName = match[3]
    const fieldType = match[4].trim()
    const isPrimary = decoratorName === 'PrimaryGeneratedColumn' || decoratorName === 'PrimaryColumn'
    const nullable = /nullable\s*:\s*true/.test(decoratorArgs)
    const unique = /unique\s*:\s*true/.test(decoratorArgs)
    fields.push({ name: fieldName, type: fieldType, nullable, primaryKey: isPrimary || undefined, unique: unique || undefined })
  }
  return fields
}

// ---- Prisma ----------------------------------------------------------------

function parsePrismaEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => /\.prisma$/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    const modelPattern = /^model\s+(\w+)\s*\{([^}]+)\}/gm
    let match: RegExpExecArray | null
    while ((match = modelPattern.exec(source)) !== null) {
      const modelName = match[1]
      const body = match[2]
      const line = source.slice(0, match.index).split('\n').length
      const fields = parsePrismaFields(body)
      results.push({ name: modelName, fields, sourceFile: filePath, line, framework: 'prisma' })
    }
  }
  return results
}

function parsePrismaFields(body: string): EntityField[] {
  const fields: EntityField[] = []
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue
    // fieldName  FieldType  @id @default(...) @unique? optional?
    const match = /^(\w+)\s+([\w[\]?]+)(.*)$/.exec(trimmed)
    if (!match) continue
    const fieldName = match[1]
    let fieldType = match[2]
    const rest = match[3]
    const nullable = fieldType.endsWith('?')
    if (nullable) fieldType = fieldType.slice(0, -1)
    const isPrimary = /@id\b/.test(rest)
    const unique = /@unique\b/.test(rest)
    const defaultMatch = /@default\(([^)]+)\)/.exec(rest)
    const defaultValue = defaultMatch ? defaultMatch[1] : undefined
    fields.push({ name: fieldName, type: fieldType, nullable, primaryKey: isPrimary || undefined, unique: unique || undefined, defaultValue })
  }
  return fields
}

// ---- Sequelize (TypeScript/JS) ---------------------------------------------

function parseSequelizeEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => /\.(ts|js)$/.test(name) && /model|Model/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    // Match Model.init({ ... }, or @Table decorated classes
    if (!source.includes('Model.init(') && !source.includes('@Table')) continue
    const tablePattern = /@Table\s*\(\s*\{\s*tableName\s*:\s*['"]([^'"]+)['"]/
    const tableMatch = tablePattern.exec(source)
    const tableName = tableMatch ? tableMatch[1] : undefined
    const classMatch = /class\s+(\w+)\s+extends\s+Model/.exec(source)
    if (!classMatch) continue
    const className = classMatch[1]
    const line = source.slice(0, classMatch.index).split('\n').length
    const fields = extractSequelizeFields(source)
    results.push({ name: className, tableName, fields, sourceFile: filePath, line, framework: 'sequelize' })
  }
  return results
}

function extractSequelizeFields(source: string): EntityField[] {
  const fields: EntityField[] = []
  // @Column decorator style or Model.init field: fieldName: { type: DataTypes.X, ... }
  const initPattern = /Model\.init\s*\(\s*\{([\s\S]*?)\}\s*,/
  const initMatch = initPattern.exec(source)
  if (initMatch) {
    const initBody = initMatch[1]
    const fieldPattern = /(\w+)\s*:\s*\{[^}]*type\s*:\s*DataTypes\.(\w+)([^}]*)\}/g
    let match: RegExpExecArray | null
    while ((match = fieldPattern.exec(initBody)) !== null) {
      const fieldName = match[1]
      const fieldType = match[2]
      const rest = match[3]
      const nullable = /allowNull\s*:\s*true/.test(rest)
      const isPrimary = /primaryKey\s*:\s*true/.test(rest)
      const unique = /unique\s*:\s*true/.test(rest)
      fields.push({ name: fieldName, type: fieldType, nullable, primaryKey: isPrimary || undefined, unique: unique || undefined })
    }
  }
  return fields
}

// ---- Django ----------------------------------------------------------------

function parseDjangoEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => name === 'models.py' || /\.py$/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('models.Model')) continue
    const classPattern = /^class\s+(\w+)\s*\(\s*models\.Model\s*\)\s*:/gm
    let match: RegExpExecArray | null
    while ((match = classPattern.exec(source)) !== null) {
      const className = match[1]
      const line = source.slice(0, match.index).split('\n').length
      // Get lines until next class or end
      const rest = source.slice(match.index + match[0].length)
      const nextClass = /^class\s+\w+/m.exec(rest)
      const classBody = nextClass ? rest.slice(0, nextClass.index) : rest
      const fields = extractDjangoFields(classBody)
      results.push({ name: className, fields, sourceFile: filePath, line, framework: 'django' })
    }
  }
  return results
}

function extractDjangoFields(body: string): EntityField[] {
  const fields: EntityField[] = []
  // fieldName = models.CharField(max_length=..., null=True, ...)
  const fieldPattern = /^\s{4}(\w+)\s*=\s*models\.(\w+)\s*\(([^)]*)\)/gm
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(body)) !== null) {
    const fieldName = match[1]
    const fieldType = match[2]
    const args = match[3]
    if (['Meta', 'Manager'].includes(fieldName)) continue
    const nullable = /null\s*=\s*True/.test(args)
    const unique = /unique\s*=\s*True/.test(args)
    const isPrimary = /primary_key\s*=\s*True/.test(args)
    fields.push({ name: fieldName, type: fieldType, nullable, primaryKey: isPrimary || undefined, unique: unique || undefined })
  }
  return fields
}

// ---- SQLAlchemy ------------------------------------------------------------

function parseSqlAlchemyEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => /\.py$/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('Column(') || !source.includes('__tablename__')) continue
    const classPattern = /^class\s+(\w+)\s*\(\s*\w*Base\w*\s*\)\s*:/gm
    let match: RegExpExecArray | null
    while ((match = classPattern.exec(source)) !== null) {
      const className = match[1]
      const line = source.slice(0, match.index).split('\n').length
      const rest = source.slice(match.index + match[0].length)
      const nextClass = /^class\s+\w+/m.exec(rest)
      const classBody = nextClass ? rest.slice(0, nextClass.index) : rest
      const tableNameMatch = /__tablename__\s*=\s*['"]([^'"]+)['"]/.exec(classBody)
      const tableName = tableNameMatch ? tableNameMatch[1] : undefined
      if (!classBody.includes('Column(')) continue
      const fields = extractSqlAlchemyFields(classBody)
      results.push({ name: className, tableName, fields, sourceFile: filePath, line, framework: 'sqlalchemy' })
    }
  }
  return results
}

function extractSqlAlchemyFields(body: string): EntityField[] {
  const fields: EntityField[] = []
  // fieldName = Column(String, primary_key=True, ...)
  const fieldPattern = /^\s{4}(\w+)\s*=\s*(?:mapped_column|Column)\s*\(([^)]+)\)/gm
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(body)) !== null) {
    const fieldName = match[1]
    const args = match[2]
    if (fieldName.startsWith('_')) continue
    const typeMatch = /^(\w+)/.exec(args.trim())
    const fieldType = typeMatch ? typeMatch[1] : 'unknown'
    const nullable = /nullable\s*=\s*True/.test(args)
    const isPrimary = /primary_key\s*=\s*True/.test(args)
    const unique = /unique\s*=\s*True/.test(args)
    fields.push({ name: fieldName, type: fieldType, nullable, primaryKey: isPrimary || undefined, unique: unique || undefined })
  }
  return fields
}

// ---- Spring/Hibernate (Java) -----------------------------------------------

function parseSpringEntities(repoPath: string): EntityModel[] {
  const files = walkFiles(repoPath, (name) => /\.(java|kt)$/.test(name))
  const results: EntityModel[] = []
  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('@Entity')) continue
    const tableMatch = /@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/.exec(source)
    const tableName = tableMatch ? tableMatch[1] : undefined
    const classMatch = /(?:public|private|protected)?\s*class\s+(\w+)/.exec(source)
    if (!classMatch) continue
    const className = classMatch[1]
    const line = source.slice(0, classMatch.index).split('\n').length
    const fields = extractSpringFields(source)
    results.push({ name: className, tableName, fields, sourceFile: filePath, line, framework: 'spring' })
  }
  return results
}

function extractSpringFields(source: string): EntityField[] {
  const fields: EntityField[] = []
  // @Column(...) (or @Id, @GeneratedValue) then private/public Type fieldName;
  const fieldPattern = /(@(?:Id|GeneratedValue|Column)[^;]*?)\n\s*(?:private|protected|public)\s+([\w<>[\]]+)\s+(\w+)\s*;/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(source)) !== null) {
    const decorators = match[1]
    const fieldType = match[2]
    const fieldName = match[3]
    const isPrimary = /@Id\b/.test(decorators)
    const nullable = /nullable\s*=\s*false/.test(decorators) ? false : undefined
    const unique = /unique\s*=\s*true/.test(decorators) ? true : undefined
    fields.push({ name: fieldName, type: fieldType, nullable: nullable ?? undefined, primaryKey: isPrimary || undefined, unique })
  }
  return fields
}

// ---- Main export -----------------------------------------------------------

export function extractEntities(repoPath: string, language: Language, framework: Framework): EntityModel[] {
  const results: EntityModel[] = []
  try {
    // TypeORM: TypeScript
    if (language === 'typescript' || language === 'javascript') {
      results.push(...parseTypeOrmEntities(repoPath))
      results.push(...parseSequelizeEntities(repoPath))
    }
    // Prisma: any language
    results.push(...parsePrismaEntities(repoPath))
    // Django / SQLAlchemy: Python
    if (language === 'python') {
      if (framework === 'django') {
        results.push(...parseDjangoEntities(repoPath))
      } else {
        results.push(...parseSqlAlchemyEntities(repoPath))
        // Try both in case framework is unknown
        if (framework === 'unknown') {
          results.push(...parseDjangoEntities(repoPath))
        }
      }
    }
    // Spring / Hibernate: Java/Kotlin
    if (language === 'java' || language === 'kotlin') {
      results.push(...parseSpringEntities(repoPath))
    }
  } catch {
    // Extraction is best-effort
  }
  // Deduplicate by name + sourceFile
  const seen = new Set<string>()
  return results.filter((entity) => {
    const key = `${entity.name}:${entity.sourceFile}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
