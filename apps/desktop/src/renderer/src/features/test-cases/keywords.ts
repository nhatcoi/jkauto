export interface KeywordDef {
  id: string
  label: string
  color: string
  hasObject: boolean
  hasInput: boolean
  hasExpected: boolean
  inputPlaceholder?: string
  objectPlaceholder?: string
  expectedPlaceholder?: string
}

export const BUILT_IN_KEYWORDS: KeywordDef[] = [
  {
    id: 'navigate-to',
    label: 'Navigate To',
    color: 'bg-blue-600',
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'URL',
  },
  {
    id: 'click',
    label: 'Click',
    color: 'bg-green-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'type-text',
    label: 'Type Text',
    color: 'bg-violet-600',
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Text',
  },
  {
    id: 'clear-text',
    label: 'Clear Text',
    color: 'bg-orange-500',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'assert-text',
    label: 'Assert Text',
    color: 'bg-amber-600',
    hasObject: true,
    hasInput: false,
    hasExpected: true,
    objectPlaceholder: 'Selector',
    expectedPlaceholder: 'Expected text',
  },
  {
    id: 'assert-url-contains',
    label: 'Assert URL Contains',
    color: 'bg-teal-600',
    hasObject: false,
    hasInput: false,
    hasExpected: true,
    expectedPlaceholder: 'URL substring',
  },
  {
    id: 'assert-visible',
    label: 'Assert Visible',
    color: 'bg-emerald-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'assert-hidden',
    label: 'Assert Hidden',
    color: 'bg-red-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'wait-for-element',
    label: 'Wait For Element',
    color: 'bg-cyan-600',
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Timeout ms',
  },
  {
    id: 'wait-ms',
    label: 'Wait',
    color: 'bg-slate-500',
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Milliseconds',
  },
  {
    id: 'hover',
    label: 'Hover',
    color: 'bg-lime-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'select-option',
    label: 'Select Option',
    color: 'bg-indigo-600',
    hasObject: true,
    hasInput: true,
    hasExpected: false,
    objectPlaceholder: 'Selector',
    inputPlaceholder: 'Option value',
  },
  {
    id: 'press-key',
    label: 'Press Key',
    color: 'bg-pink-600',
    hasObject: false,
    hasInput: true,
    hasExpected: false,
    inputPlaceholder: 'Enter, Tab, Escape…',
  },
  {
    id: 'scroll-to',
    label: 'Scroll To',
    color: 'bg-yellow-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
  {
    id: 'get-text',
    label: 'Get Text',
    color: 'bg-rose-600',
    hasObject: true,
    hasInput: false,
    hasExpected: false,
    objectPlaceholder: 'Selector',
  },
]

export const KEYWORD_MAP = new Map<string, KeywordDef>(
  BUILT_IN_KEYWORDS.map((k) => [k.id, k]),
)

export function getKeyword(id: string): KeywordDef {
  return KEYWORD_MAP.get(id) ?? {
    id,
    label: id,
    color: 'bg-muted',
    hasObject: true,
    hasInput: true,
    hasExpected: true,
  }
}
