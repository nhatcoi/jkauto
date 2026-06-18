import type { ApiEndpoint } from '../types'

// swagger-parser uses CJS `export =` — incompatible with moduleResolution:bundler static method types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwaggerParser = require('swagger-parser') as { validate: (path: string) => Promise<any> }

export async function parseOpenApi(specPath: string): Promise<ApiEndpoint[]> {
  const api = await SwaggerParser.validate(specPath)
  const endpoints: ApiEndpoint[] = []

  for (const [routePath, methods] of Object.entries(api.paths ?? {})) {
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue

      endpoints.push({
        method: method.toUpperCase() as ApiEndpoint['method'],
        path: routePath,
        summary: op.summary,
        requestSchema: op.requestBody?.content?.['application/json']?.schema,
        responseSchema: op.responses?.['200']?.content?.['application/json']?.schema,
        sourceFile: specPath,
      })
    }
  }

  return endpoints
}
