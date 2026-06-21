import type { ApiEndpoint, ApiParameter } from '../types'

// swagger-parser uses CJS `export =` — incompatible with moduleResolution:bundler static method types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwaggerParser = require('swagger-parser') as { validate: (path: string) => Promise<any> }

function mapParameters(raw: unknown): ApiParameter[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Record<string, any> => !!p && typeof p === 'object' && typeof p.name === 'string')
    .map((p) => ({
      name: p.name,
      in: (p.in ?? 'query') as ApiParameter['in'],
      required: !!p.required,
      type: p.schema?.type,
    }))
}

export async function parseOpenApi(specPath: string): Promise<ApiEndpoint[]> {
  const api = await SwaggerParser.validate(specPath)
  const endpoints: ApiEndpoint[] = []

  for (const [routePath, methods] of Object.entries(api.paths ?? {})) {
    // Path-level parameters apply to every operation under the path.
    const pathParams = mapParameters((methods as Record<string, any>)?.parameters)
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue

      const opParams = mapParameters(op.parameters)
      const merged = [...pathParams, ...opParams].filter(
        (p, i, arr) => arr.findIndex((q) => q.name === p.name && q.in === p.in) === i,
      )

      endpoints.push({
        method: method.toUpperCase() as ApiEndpoint['method'],
        path: routePath,
        summary: op.summary,
        parameters: merged.length ? merged : undefined,
        requestSchema: op.requestBody?.content?.['application/json']?.schema,
        responseSchema: op.responses?.['200']?.content?.['application/json']?.schema,
        sourceFile: specPath,
      })
    }
  }

  return endpoints
}
