import fs from 'node:fs'
import path from 'node:path'
import type { Framework, Language, ValidationField, ValidationSchema } from '../types'

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

// ---- class-validator (NestJS / TypeScript) ---------------------------------

function parseClassValidatorDTOs(repoPath: string): ValidationSchema[] {
  // DTO files or any TS/JS file with class-validator decorators
  const files = walkFiles(repoPath, (name) => /\.dto\.(ts|js)$/.test(name) || /\.(ts|js)$/.test(name))
  const results: ValidationSchema[] = []

  const classValidatorDecorators = [
    'IsString', 'IsNumber', 'IsInt', 'IsBoolean', 'IsDate', 'IsEmail',
    'IsUrl', 'IsUUID', 'IsNotEmpty', 'IsEmpty', 'IsOptional', 'IsArray',
    'IsEnum', 'IsIn', 'IsNotIn', 'Min', 'Max', 'MinLength', 'MaxLength',
    'Length', 'Matches', 'Contains', 'IsAlpha', 'IsAlphanumeric',
    'IsDefined', 'IsObject', 'ValidateNested', 'IsPositive', 'IsNegative',
  ]
  const decoratorPattern = new RegExp(`@(${classValidatorDecorators.join('|')})\\s*(?:\\([^)]*\\))?`)

  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!decoratorPattern.test(source)) continue

    // Find classes that have class-validator decorators
    const classPattern = /export\s+class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g
    let classMatch: RegExpExecArray | null
    while ((classMatch = classPattern.exec(source)) !== null) {
      const className = classMatch[1]
      const classStart = classMatch.index
      const bodyStart = source.indexOf('{', classStart + classMatch[0].length - 1)
      if (bodyStart === -1) continue
      let braceDepth = 1
      let bodyEnd = bodyStart + 1
      while (bodyEnd < source.length && braceDepth > 0) {
        if (source[bodyEnd] === '{') braceDepth++
        else if (source[bodyEnd] === '}') braceDepth--
        bodyEnd++
      }
      const classBody = source.slice(bodyStart + 1, bodyEnd - 1)
      if (!decoratorPattern.test(classBody)) continue

      const fields = extractClassValidatorFields(classBody, classValidatorDecorators)
      if (fields.length === 0) continue

      const line = source.slice(0, classMatch.index).split('\n').length
      results.push({ name: className, fields, sourceFile: filePath, line, framework: 'class-validator' })
    }
  }
  return results
}

function extractClassValidatorFields(classBody: string, decoratorNames: string[]): ValidationField[] {
  const fields: ValidationField[] = []
  // Split by property declarations: capture all decorators above each property
  const propPattern = /((?:\s*@\w+\s*(?:\([^)]*\))?\s*)+)\n\s*(\w+)\s*([?!]?)\s*:\s*([\w<>[\]| ]+)/g
  let match: RegExpExecArray | null
  while ((match = propPattern.exec(classBody)) !== null) {
    const decoratorBlock = match[1]
    const fieldName = match[2]
    const isOptional = match[3] === '?'
    const fieldType = match[4].trim()

    // Extract only class-validator decorators as rules
    const rules: string[] = []
    const decoratorExtract = /@(\w+)\s*(?:\(([^)]*)\))?/g
    let dec: RegExpExecArray | null
    while ((dec = decoratorExtract.exec(decoratorBlock)) !== null) {
      if (decoratorNames.includes(dec[1])) {
        const args = dec[2] ? `(${dec[2].trim()})` : ''
        rules.push(`${dec[1]}${args}`)
      }
    }
    if (rules.length === 0) continue
    fields.push({ name: fieldName, type: fieldType, rules, optional: isOptional || undefined })
  }
  return fields
}

// ---- Zod (TypeScript/JS) ---------------------------------------------------

function parseZodSchemas(repoPath: string): ValidationSchema[] {
  const files = walkFiles(repoPath, (name) => /\.(ts|js)$/.test(name))
  const results: ValidationSchema[] = []

  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('z.object(') && !source.includes('zod')) continue

    // Match: const/export const SchemaName = z.object({ ... })
    const schemaPattern = /(?:export\s+)?const\s+(\w+)\s*=\s*z\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/g
    let match: RegExpExecArray | null
    while ((match = schemaPattern.exec(source)) !== null) {
      const schemaName = match[1]
      const schemaBody = match[2]
      const line = source.slice(0, match.index).split('\n').length
      const fields = extractZodFields(schemaBody)
      if (fields.length === 0) continue
      results.push({ name: schemaName, fields, sourceFile: filePath, line, framework: 'zod' })
    }
  }
  return results
}

function extractZodFields(schemaBody: string): ValidationField[] {
  const fields: ValidationField[] = []
  // fieldName: z.string().email().min(8).optional()
  const fieldPattern = /(\w+)\s*:\s*(z\.[\w.()[\]<>, '"]+)/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(schemaBody)) !== null) {
    const fieldName = match[1]
    const zodChain = match[2]
    const rules = parseZodChain(zodChain)
    const optional = rules.includes('optional')
    fields.push({ name: fieldName, rules, optional: optional || undefined })
  }
  return fields
}

function parseZodChain(chain: string): string[] {
  const rules: string[] = []
  // Extract each method call: .string(), .email(), .min(8), etc.
  const methodPattern = /\.(\w+)\s*(?:\(([^)]*)\))?/g
  let match: RegExpExecArray | null
  while ((match = methodPattern.exec(chain)) !== null) {
    const methodName = match[1]
    const args = match[2]
    if (args !== undefined && args.trim() !== '') {
      rules.push(`${methodName}(${args.trim()})`)
    } else {
      rules.push(methodName)
    }
  }
  return rules
}

// ---- Pydantic (Python) -----------------------------------------------------

function parsePydanticSchemas(repoPath: string): ValidationSchema[] {
  const files = walkFiles(repoPath, (name) => /\.py$/.test(name))
  const results: ValidationSchema[] = []

  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('BaseModel')) continue

    const classPattern = /^class\s+(\w+)\s*\(\s*(?:\w+\.)?BaseModel\s*\)\s*:/gm
    let match: RegExpExecArray | null
    while ((match = classPattern.exec(source)) !== null) {
      const className = match[1]
      const line = source.slice(0, match.index).split('\n').length
      const rest = source.slice(match.index + match[0].length)
      const nextClass = /^class\s+\w+/m.exec(rest)
      const classBody = nextClass ? rest.slice(0, nextClass.index) : rest
      const fields = extractPydanticFields(classBody)
      if (fields.length === 0) continue
      results.push({ name: className, fields, sourceFile: filePath, line, framework: 'pydantic' })
    }
  }
  return results
}

function extractPydanticFields(body: string): ValidationField[] {
  const fields: ValidationField[] = []
  // fieldName: type = Field(...) or fieldName: Optional[type] = ...
  const fieldPattern = /^\s{4}(\w+)\s*:\s*([\w[\], |]+?)\s*(?:=\s*(.*))?$/gm
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(body)) !== null) {
    const fieldName = match[1]
    const fieldType = match[2].trim()
    const defaultExpr = match[3]?.trim() ?? ''
    if (['class', 'def', 'pass', 'return'].includes(fieldName)) continue
    const optional = /Optional/.test(fieldType)
    const rules: string[] = []
    // Extract Field validators
    if (defaultExpr.includes('Field(')) {
      const fieldArgsMatch = /Field\(([^)]*)\)/.exec(defaultExpr)
      if (fieldArgsMatch) {
        const args = fieldArgsMatch[1]
        const minLength = /min_length\s*=\s*(\d+)/.exec(args)
        const maxLength = /max_length\s*=\s*(\d+)/.exec(args)
        const ge = /ge\s*=\s*(\d+)/.exec(args)
        const le = /le\s*=\s*(\d+)/.exec(args)
        const pattern = /pattern\s*=\s*['"]([^'"]+)['"]/.exec(args)
        if (minLength) rules.push(`min_length(${minLength[1]})`)
        if (maxLength) rules.push(`max_length(${maxLength[1]})`)
        if (ge) rules.push(`ge(${ge[1]})`)
        if (le) rules.push(`le(${le[1]})`)
        if (pattern) rules.push(`pattern(${pattern[1]})`)
      }
    }
    if (rules.length === 0 && !optional) rules.push('required')
    fields.push({ name: fieldName, type: fieldType, rules, optional: optional || undefined })
  }
  return fields
}

// ---- Joi (JS/TS) -----------------------------------------------------------

function parseJoiSchemas(repoPath: string): ValidationSchema[] {
  const files = walkFiles(repoPath, (name) => /\.(ts|js)$/.test(name))
  const results: ValidationSchema[] = []

  for (const filePath of files) {
    const source = readFileSafe(filePath)
    if (!source) continue
    if (!source.includes('Joi.object(') && !source.includes('joi.object(')) continue

    const schemaPattern = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:Joi|joi)\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/g
    let match: RegExpExecArray | null
    while ((match = schemaPattern.exec(source)) !== null) {
      const schemaName = match[1]
      const schemaBody = match[2]
      const line = source.slice(0, match.index).split('\n').length
      const fields = extractJoiFields(schemaBody)
      if (fields.length === 0) continue
      results.push({ name: schemaName, fields, sourceFile: filePath, line, framework: 'joi' })
    }
  }
  return results
}

function extractJoiFields(schemaBody: string): ValidationField[] {
  const fields: ValidationField[] = []
  const fieldPattern = /(\w+)\s*:\s*((?:Joi|joi)\.[\w.()[\]<>, '"]+)/g
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(schemaBody)) !== null) {
    const fieldName = match[1]
    const joiChain = match[2]
    const rules = parseZodChain(joiChain) // same method-chain parsing
    const optional = rules.includes('optional')
    fields.push({ name: fieldName, rules, optional: optional || undefined })
  }
  return fields
}

// ---- Main export -----------------------------------------------------------

export function extractValidations(repoPath: string, language: Language, _framework: Framework): ValidationSchema[] {
  const results: ValidationSchema[] = []
  try {
    if (language === 'typescript' || language === 'javascript') {
      results.push(...parseClassValidatorDTOs(repoPath))
      results.push(...parseZodSchemas(repoPath))
      results.push(...parseJoiSchemas(repoPath))
    }
    if (language === 'python') {
      results.push(...parsePydanticSchemas(repoPath))
    }
  } catch {
    // Extraction is best-effort
  }
  // Deduplicate by name + sourceFile
  const seen = new Set<string>()
  return results.filter((schema) => {
    const key = `${schema.name}:${schema.sourceFile}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
