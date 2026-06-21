import fs from 'node:fs'
import path from 'node:path'
import { getCodeMap } from './autogen.service'
import { getRepoIndex } from './autogen-db'

// A "feature bundle" is everything the Agent needs to author a coherent set of
// test cases for one feature (e.g. login): its endpoints, validation rules,
// seed/test data, auth requirement, related UI, and suggested scenarios.

export interface ValidationField {
  field: string
  type: string
  required: boolean
  rules: string[]
  sampleValid: string
  sampleInvalid?: string
}

export interface EndpointParam {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required: boolean
  type?: string
}

export interface FeatureEndpoint {
  method: string
  path: string
  summary?: string
  auth: 'required' | 'public' | 'unknown'
  parameters: EndpointParam[]
  // Path with required query params filled in (e.g. /search?q=test). Path params
  // like {id} stay literal — the agent substitutes them from a prior response.
  samplePath: string
  validation: ValidationField[]
  // Ready-to-use JSON bodies the agent can drop into an http-request `expected`.
  sampleRequestBody?: string
  sampleRequestBodyInvalid?: string
}

export interface SeedRecord {
  source: string
  kind: string
  values: Record<string, string>
}

export interface SuggestedScenario {
  name: string
  type: 'happy' | 'negative' | 'boundary' | 'auth'
  intent: string
}

export interface FeatureBundle {
  feature: string
  summary: string
  baseUrlHint?: string
  // How to obtain + reuse an auth token across tests (login → save-to-profile).
  authSetup?: string
  endpoints: FeatureEndpoint[]
  pages: Array<{ route: string; componentName: string }>
  seedData: SeedRecord[]
  suggestedScenarios: SuggestedScenario[]
}

interface StoredEndpoint {
  method: string
  path: string
  summary?: string | null
  parameters_json?: string | null
  request_schema_json?: string | null
  response_schema_json?: string | null
}

interface StoredPage {
  route: string
  component_name?: string
  componentName?: string
}

// Public endpoints never need an auth token; everything else is treated as
// requiring auth unless a security marker says otherwise.
const PUBLIC_PATHS = [/\/auth\/(login|register|refresh)$/i, /\/health$/i]

function featureKeyFromPath(p: string): string {
  // /auth/login -> auth ; /documents/{id}/upload -> documents
  const seg = p.replace(/^\/+/, '').split('/')[0] ?? ''
  return seg.replace(/[{}:]/g, '').toLowerCase() || 'root'
}

function authForPath(p: string): FeatureEndpoint['auth'] {
  if (PUBLIC_PATHS.some((re) => re.test(p))) return 'public'
  return 'required'
}

// ---- validation parsing ---------------------------------------------------

function sampleForField(name: string, schema: Record<string, unknown>): string {
  const type = String(schema.type ?? 'string')
  const format = schema.format ? String(schema.format) : ''
  const enumVals = Array.isArray(schema.enum) ? schema.enum : null
  if (enumVals && enumVals.length) return String(enumVals[0])
  if (schema.default !== undefined) return String(schema.default)
  if (format === 'email' || /email/i.test(name)) return 'test.user@example.com'
  if (format === 'uuid' || /\bid$/i.test(name)) return '00000000-0000-0000-0000-000000000000'
  if (/pass(word)?/i.test(name)) return 'Passw0rd!'
  if (type === 'integer' || type === 'number') return String(schema.minimum ?? 1)
  if (type === 'boolean') return 'true'
  const min = Number(schema.minLength ?? 3)
  return `${name}_${'x'.repeat(Math.max(0, min - name.length - 1))}`.slice(0, Math.max(min, name.length + 1))
}

function invalidForField(name: string, schema: Record<string, unknown>): string | undefined {
  const format = schema.format ? String(schema.format) : ''
  if (format === 'email' || /email/i.test(name)) return 'not-an-email'
  if (typeof schema.minLength === 'number') return 'x'.repeat(Math.max(0, schema.minLength - 1))
  if (Array.isArray(schema.enum) && schema.enum.length) return '__invalid_enum__'
  if (typeof schema.maxLength === 'number') return 'x'.repeat(schema.maxLength + 5)
  return undefined
}

function parseValidation(requestSchemaJson?: string | null): ValidationField[] {
  if (!requestSchemaJson) return []
  let schema: Record<string, unknown>
  try { schema = JSON.parse(requestSchemaJson) } catch { return [] }
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined
  if (!props) return []
  const required = new Set((schema.required as string[] | undefined) ?? [])
  const fields: ValidationField[] = []
  for (const [field, def] of Object.entries(props)) {
    const rules: string[] = []
    if (required.has(field)) rules.push('required')
    if (def.minLength !== undefined) rules.push(`minLength ${def.minLength}`)
    if (def.maxLength !== undefined) rules.push(`maxLength ${def.maxLength}`)
    if (def.minimum !== undefined) rules.push(`min ${def.minimum}`)
    if (def.maximum !== undefined) rules.push(`max ${def.maximum}`)
    if (def.format) rules.push(`format ${def.format}`)
    if (def.pattern) rules.push(`pattern ${def.pattern}`)
    if (Array.isArray(def.enum)) rules.push(`enum [${def.enum.join(', ')}]`)
    if (def.default !== undefined) rules.push(`default ${def.default}`)
    fields.push({
      field,
      type: String(def.type ?? 'string'),
      required: required.has(field),
      rules,
      sampleValid: sampleForField(field, def),
      sampleInvalid: invalidForField(field, def),
    })
  }
  return fields
}

// ---- seed / test data extraction ------------------------------------------

const SEED_FILE_RE = /(seed|store|fixture|mock|sample|data|default)/i
const CRED_KEYS = ['username', 'email', 'password', 'role', 'token']

function scanSeedFile(file: string, rel: string, records: SeedRecord[]): void {
  let src: string
  try { src = fs.readFileSync(file, 'utf-8') } catch { return }
  // Collect `key: 'value'` / `key: "value"` pairs with line numbers.
  const pairRe = /\b(username|email|password|passwd|role|token|user|pass)\b\s*[:=]\s*['"`]([^'"`]+)['"`]/gi
  const found: Array<{ key: string; value: string; line: number }> = []
  let m: RegExpExecArray | null
  while ((m = pairRe.exec(src)) !== null) {
    found.push({
      key: m[1].toLowerCase(),
      value: m[2],
      line: src.slice(0, m.index).split('\n').length,
    })
  }
  // Group pairs that sit within a few lines of each other into one record.
  let group: Record<string, string> = {}
  let lastLine = -10
  const flush = () => {
    if (group.password || group.pass || group.token) {
      records.push({ source: rel, kind: 'credential', values: { ...group } })
    }
    group = {}
  }
  for (const p of found) {
    const key = p.key === 'pass' ? 'password' : p.key === 'user' ? 'username' : p.key
    if (!CRED_KEYS.includes(key)) { lastLine = p.line; continue }
    // New record when there's a line gap OR the same field repeats (next object).
    if (Object.keys(group).length && (p.line - lastLine > 8 || group[key] !== undefined)) {
      flush()
    }
    if (group[key] === undefined) group[key] = p.value
    lastLine = p.line
  }
  flush()
}

function extractSeedData(sourcePath: string, feature: string): SeedRecord[] {
  const records: SeedRecord[] = []
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.autotest'])
  const walk = (dir: string, depth: number): void => {
    if (depth > 5) return
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(full, depth + 1)
        continue
      }
      const isSeedLike =
        SEED_FILE_RE.test(entry.name) ||
        /test-cases?/.test(dir) ||
        /^\.env/.test(entry.name)
      if (!isSeedLike) continue
      if (!/\.(ts|tsx|js|jsx|json|ya?ml|env|sql)$|^\.env/.test(entry.name)) continue
      scanSeedFile(full, path.relative(sourcePath, full), records)
    }
  }
  walk(sourcePath, 0)
  // De-dup identical records; surface auth-feature creds first.
  const seen = new Set<string>()
  const unique = records.filter((r) => {
    const k = JSON.stringify(r.values)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // For the auth/login feature all credentials are relevant; for others keep
  // them too (login is a precondition for authenticated calls).
  void feature
  return unique.slice(0, 12)
}

// ---- parameters + sample path ---------------------------------------------

function parseParameters(json?: string | null): EndpointParam[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((p) => p && typeof p.name === 'string')
      .map((p) => ({
        name: String(p.name),
        in: (p.in ?? 'query') as EndpointParam['in'],
        required: !!p.required,
        type: p.type ? String(p.type) : undefined,
      }))
  } catch {
    return []
  }
}

function sampleParamValue(p: EndpointParam): string {
  if (p.type === 'integer' || p.type === 'number') return '1'
  if (p.type === 'boolean') return 'true'
  if (/^(q|query|search|keyword)$/i.test(p.name)) return 'test'
  if (/id$/i.test(p.name)) return '00000000-0000-0000-0000-000000000000'
  return 'test'
}

// Build a runnable path: required query params appended; optional ones omitted.
function buildSamplePath(path: string, params: EndpointParam[]): string {
  const query = params
    .filter((p) => p.in === 'query' && p.required)
    .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(sampleParamValue(p))}`)
  return query.length ? `${path}?${query.join('&')}` : path
}

// ---- base URL detection ---------------------------------------------------

// Scan entry/config files for a listen port so the agent can set a concrete
// base URL instead of an unresolved variable.
function detectBaseUrl(sourcePath: string): string | undefined {
  const candidates = [
    'src/index.ts', 'src/index.js', 'src/server.ts', 'src/server.js',
    'src/main.ts', 'src/app.ts', 'index.ts', 'index.js', 'server.ts',
    '.env', '.env.example', '.env.sample',
  ]
  const patterns = [
    /PORT\s*[?]{2}\s*(\d{2,5})/,            // process.env.PORT ?? 3001
    /PORT\s*\|\|\s*(\d{2,5})/,              // process.env.PORT || 3000
    /\.listen\s*\(\s*\{[^}]*port\s*:\s*(\d{2,5})/, // .listen({ port: 3001 })
    /\.listen\s*\(\s*(\d{2,5})/,            // .listen(3000
    /^PORT\s*=\s*(\d{2,5})/m,               // PORT=3001 (.env)
  ]
  for (const rel of candidates) {
    const file = path.join(sourcePath, rel)
    let src: string
    try { src = fs.readFileSync(file, 'utf-8') } catch { continue }
    for (const re of patterns) {
      const m = re.exec(src)
      if (m) return `http://localhost:${m[1]}`
    }
  }
  return undefined
}

// ---- request body assembly ------------------------------------------------

// Build a ready valid JSON body (and one invalid variant for negative tests)
// from validation rules. Seed credentials override matching fields so a login
// body uses a real account (e.g. {"username":"admin","password":"Admin@123"}).
function buildSampleBodies(
  validation: ValidationField[],
  seedCred?: Record<string, string>,
): { valid?: string; invalid?: string } {
  if (validation.length === 0) return {}
  // Include required fields; add common login fields even when not flagged.
  const include = validation.filter(
    (f) => f.required || /^(username|email|password)$/i.test(f.field),
  )
  if (include.length === 0) return {}

  const valueFor = (f: ValidationField): string =>
    (seedCred && seedCred[f.field.toLowerCase()]) || f.sampleValid

  const validObj: Record<string, string> = {}
  for (const f of include) validObj[f.field] = valueFor(f)

  // Invalid: break the first field that has a breakable rule.
  let invalid: string | undefined
  const breakable = include.find((f) => f.sampleInvalid !== undefined)
  if (breakable) {
    const invalidObj = { ...validObj, [breakable.field]: breakable.sampleInvalid! }
    invalid = JSON.stringify(invalidObj)
  }
  return { valid: JSON.stringify(validObj), invalid }
}

// ---- scenario suggestions -------------------------------------------------

function suggestScenarios(
  feature: string,
  endpoints: FeatureEndpoint[],
  hasSeed: boolean,
): SuggestedScenario[] {
  const scenarios: SuggestedScenario[] = []
  const writeEp = endpoints.find((e) => e.method === 'POST' || e.method === 'PUT')
  const hasValidation = endpoints.some((e) => e.validation.length > 0)
  const needsAuth = endpoints.some((e) => e.auth === 'required')

  scenarios.push({
    name: `${feature} happy path`,
    type: 'happy',
    intent: hasSeed
      ? 'Use a seeded valid account/payload; assert 2xx and expected response body.'
      : 'Send a fully valid payload; assert 2xx and expected response body.',
  })
  if (hasValidation && writeEp) {
    scenarios.push({
      name: `${feature} missing required field`,
      type: 'negative',
      intent: 'Omit a required field; assert 400 and validation error message.',
    })
    scenarios.push({
      name: `${feature} invalid field value`,
      type: 'boundary',
      intent: 'Violate a rule (minLength/format/enum) using sampleInvalid; assert 400.',
    })
  }
  if (feature === 'auth' || endpoints.some((e) => /login/i.test(e.path))) {
    scenarios.push({
      name: 'login wrong credentials',
      type: 'negative',
      intent: 'Use a wrong password for a known user; assert 401 and no token issued.',
    })
  }
  if (needsAuth) {
    scenarios.push({
      name: `${feature} unauthorized access`,
      type: 'auth',
      intent: 'Call an auth-required endpoint without a token; assert 401.',
    })
  }
  return scenarios
}

// ---- public API -----------------------------------------------------------

export function listFeatures(projectPath: string): Array<{ feature: string; endpointCount: number; pageCount: number }> {
  const map = getCodeMap(projectPath)
  if (!map) return []
  const endpoints = (map.endpoints as unknown as StoredEndpoint[]) ?? []
  const pages = (map.pages as unknown as StoredPage[]) ?? []
  const counts = new Map<string, { e: number; p: number }>()
  for (const ep of endpoints) {
    const key = featureKeyFromPath(ep.path)
    const c = counts.get(key) ?? { e: 0, p: 0 }
    c.e += 1
    counts.set(key, c)
  }
  for (const pg of pages) {
    const key = featureKeyFromPath(pg.route)
    const c = counts.get(key) ?? { e: 0, p: 0 }
    c.p += 1
    counts.set(key, c)
  }
  return Array.from(counts, ([feature, c]) => ({
    feature,
    endpointCount: c.e,
    pageCount: c.p,
  })).sort((a, b) => b.endpointCount - a.endpointCount)
}

export function buildFeatureBundle(projectPath: string, feature: string): FeatureBundle {
  const map = getCodeMap(projectPath)
  if (!map) {
    return {
      feature, summary: 'No code analysis available. Run analysis first.',
      endpoints: [], pages: [], seedData: [], suggestedScenarios: [],
    }
  }
  const key = feature.replace(/[{}:/]/g, '').toLowerCase()
  const allEndpoints = (map.endpoints as unknown as StoredEndpoint[]) ?? []
  const allPages = (map.pages as unknown as StoredPage[]) ?? []

  const repo = getRepoIndex(projectPath) as { local_path?: string } | undefined
  const sourcePath = repo?.local_path
  const seedData = sourcePath ? extractSeedData(sourcePath, key) : []
  const seedCred = seedData.find((r) => r.kind === 'credential')?.values

  const endpoints: FeatureEndpoint[] = allEndpoints
    .filter((ep) => featureKeyFromPath(ep.path) === key || ep.path.toLowerCase().includes(key))
    .map((ep) => {
      const validation = parseValidation(ep.request_schema_json)
      const parameters = parseParameters(ep.parameters_json)
      const isLogin = /login|signin|authenticate/i.test(ep.path)
      const { valid, invalid } = buildSampleBodies(validation, isLogin ? seedCred : undefined)
      return {
        method: ep.method,
        path: ep.path,
        summary: ep.summary ?? undefined,
        auth: authForPath(ep.path),
        parameters,
        samplePath: buildSamplePath(ep.path, parameters),
        validation,
        sampleRequestBody: valid,
        sampleRequestBodyInvalid: invalid,
      }
    })

  const pages = allPages
    .filter((pg) => featureKeyFromPath(pg.route) === key || pg.route.toLowerCase().includes(key))
    .map((pg) => ({
      route: pg.route,
      componentName: pg.component_name ?? pg.componentName ?? '',
    }))

  const suggestedScenarios = suggestScenarios(key, endpoints, seedData.length > 0)
  const baseUrlHint = sourcePath ? detectBaseUrl(sourcePath) : undefined

  // Auth setup applies to any feature with token-protected endpoints. Find the
  // login endpoint across the whole API so non-auth features know how to log in.
  const needsAuth = endpoints.some((e) => e.auth === 'required')
  const loginEp = allEndpoints.find((e) => /login|signin|authenticate/i.test(e.path))
  let authSetup: string | undefined
  if (needsAuth && loginEp) {
    const loginBody = buildSampleBodies(
      parseValidation(loginEp.request_schema_json),
      seedCred,
    ).valid
    authSetup =
      `Auth-required endpoints need a Bearer token. Obtain + reuse it like this:\n` +
      `  1. http-request POST ${loginEp.path} with body ${loginBody ?? '{ credentials }'}\n` +
      `  2. set-variable objectRef=accessToken, expected=accessToken (extract from response)\n` +
      `  3. set-auth-bearer input=\${accessToken}  — for this test\n` +
      `  Reuse across a suite: save-to-profile expected='{"type":"api-config","mappings":[{"from":"accessToken","to":"auth.bearer.token"}]}'. ` +
      `Once saved, profile.api auto-injects Authorization on every later API test — no per-test login needed.`
  }

  return {
    feature: key,
    summary: `${endpoints.length} endpoint(s), ${pages.length} page(s), ${seedData.length} seed record(s). ` +
      `${endpoints.filter((e) => e.auth === 'required').length} require auth. ` +
      (baseUrlHint
        ? `Set base URL to ${baseUrlHint} (set-base-url step 1 or profile API config).`
        : 'Configure the API base URL before running (set-base-url step 1 or profile API config).'),
    baseUrlHint,
    authSetup,
    endpoints,
    pages,
    seedData,
    suggestedScenarios,
  }
}
