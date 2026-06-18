import { createRequire } from 'node:module'

// Use createRequire for CJS native addons in ESM context
const _require = createRequire(import.meta.url)

type LangKey = 'tsx' | 'typescript' | 'javascript' | 'java' | 'go' | 'python' | 'rust'

const langCache = new Map<LangKey, unknown>()
const parserCache = new Map<LangKey, unknown>()

function loadLang(key: LangKey): unknown {
  if (langCache.has(key)) return langCache.get(key)
  try {
    let lang: unknown
    if (key === 'tsx' || key === 'typescript') {
      const mod = _require('tree-sitter-typescript') as { tsx: unknown; typescript: unknown }
      lang = key === 'tsx' ? mod.tsx : mod.typescript
    } else {
      lang = _require(`tree-sitter-${key}`)
    }
    langCache.set(key, lang)
    return lang
  } catch {
    return null
  }
}

export function getParser(key: LangKey): unknown {
  if (parserCache.has(key)) return parserCache.get(key)
  const lang = loadLang(key)
  if (!lang) return null
  try {
    const Parser = _require('tree-sitter') as { new(): unknown; prototype: { setLanguage(l: unknown): void } }
    const p = new Parser()
    ;(p as { setLanguage(l: unknown): void }).setLanguage(lang)
    parserCache.set(key, p)
    return p
  } catch {
    return null
  }
}

export function parseFile(key: LangKey, source: string): TsTree | null {
  const p = getParser(key) as { parse(s: string): TsTree } | null
  if (!p) return null
  try {
    return p.parse(source)
  } catch {
    return null
  }
}

// Minimal structural types used across parsers
export interface TsPoint { row: number; column: number }

export interface TsNode {
  type: string
  text: string
  startPosition: TsPoint
  endPosition: TsPoint
  parent: TsNode | null
  children: TsNode[]
  namedChildren: TsNode[]
  childCount: number
  namedChildCount: number
  firstNamedChild: TsNode | null
  child(i: number): TsNode | null
  namedChild(i: number): TsNode | null
  childForFieldName(name: string): TsNode | null
  descendantsOfType(type: string | string[]): TsNode[]
}

export interface TsTree {
  rootNode: TsNode
}
