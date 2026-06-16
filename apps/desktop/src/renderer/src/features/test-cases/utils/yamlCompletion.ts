import { type CompletionContext, type CompletionResult, type Completion } from '@codemirror/autocomplete'
import { parse as parseYaml } from 'yaml'
import type { KeywordMeta } from '@jkauto/core'
import type { ObjectEntry } from '../hooks/useObjectItems'

function extractVariables(docText: string): string[] {
  try {
    const parsed = parseYaml(docText) as Record<string, unknown>
    const vars = parsed?.variables
    if (vars && typeof vars === 'object') return Object.keys(vars)
  } catch { /* ignore parse errors while typing */ }
  return []
}

export function buildYamlCompletion(
  keywords: KeywordMeta[],
  objectItems: ObjectEntry[],
): (context: CompletionContext) => CompletionResult | null {
  return function yamlCompletion(context: CompletionContext): CompletionResult | null {
    const line = context.state.doc.lineAt(context.pos)
    const lineText = line.text

    // Detect "{{" trigger for variable interpolation anywhere in a value
    const varMatch = lineText.slice(0, context.pos - line.from).match(/\{\{(\w*)$/)
    if (varMatch) {
      const typed = varMatch[1]
      const docText = context.state.doc.toString()
      const variables = extractVariables(docText)
      if (variables.length === 0) return null
      const from = context.pos - typed.length
      const options: Completion[] = variables.map((v) => ({
        label: v + '}}',
        apply: v + '}}',
        detail: 'variable',
        type: 'variable',
      }))
      return { from, options, filter: true }
    }

    // Detect YAML key: <value being typed>
    const keyMatch = lineText.match(/^(\s+)(\w+):\s*(.*)$/)
    if (!keyMatch) return null

    const [, , yamlKey, typed] = keyMatch
    const from = context.pos - typed.length

    if (yamlKey === 'keyword') {
      if (!context.explicit && typed.length === 0) return null
      const options: Completion[] = keywords.map((k) => ({
        label: k.name,
        detail: k.label,
        info: k.description || undefined,
        type: 'keyword',
      }))
      return { from, options, filter: true }
    }

    if (yamlKey === 'objectRef') {
      if (!context.explicit && typed.length === 0) return null
      const options: Completion[] = objectItems.map((o) => ({
        label: o.key,
        detail: o.repoName,
        type: 'variable',
      }))
      return { from, options, filter: true }
    }

    return null
  }
}
