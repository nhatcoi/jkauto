export interface KeyBinding {
  keys: string[]
  label: string
  hint: string
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
}

export function modKey(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

/**
 * Binding syntax:
 *   mod   → Ctrl (Win/Linux) or Cmd (macOS) — use this for cross-platform shortcuts
 *   ctrl  → strictly Ctrl key only
 *   meta  → strictly Cmd key only
 *   alt   → Alt / Option
 *   shift → Shift
 *
 * Examples: 'mod+s', 'mod+shift+c', 'alt+arrowup', 'f5'
 */
export function matchesBinding(e: KeyboardEvent, keys: string[]): boolean {
  return keys.some((combo) => {
    const parts = combo.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    const hasMod   = parts.includes('mod')
    const hasCtrl  = parts.includes('ctrl')
    const hasMeta  = parts.includes('meta')
    const hasAlt   = parts.includes('alt')
    const hasShift = parts.includes('shift')

    const modPressed = e.ctrlKey || e.metaKey
    const modMatch = hasMod
      ? modPressed
      : hasCtrl && hasMeta
        ? e.ctrlKey || e.metaKey   // explicit both = same as mod
        : hasCtrl
          ? e.ctrlKey && !e.metaKey
          : hasMeta
            ? e.metaKey && !e.ctrlKey
            : !e.ctrlKey && !e.metaKey

    return (
      e.key.toLowerCase() === key &&
      modMatch &&
      (hasAlt   ? e.altKey   : !e.altKey) &&
      (hasShift ? e.shiftKey : !e.shiftKey)
    )
  })
}

const M = modKey()

export const TEST_CASE_KEYMAPS = {
  save:          { keys: ['mod+s'],          label: 'Save',        hint: `${M}+S`   },
  addStep:       { keys: ['alt+a'],          label: 'Add Step',    hint: 'Alt+A'    },
  deleteStep:    { keys: ['delete', 'backspace'], label: 'Delete Step', hint: 'Del' },
  moveUp:        { keys: ['alt+arrowup'],    label: 'Move Up',     hint: 'Alt+↑'    },
  moveDown:      { keys: ['alt+arrowdown'],  label: 'Move Down',   hint: 'Alt+↓'    },
  duplicateStep: { keys: ['mod+d'],          label: 'Duplicate',   hint: `${M}+D`   },
  run:           { keys: ['f5'],             label: 'Run',         hint: 'F5'       },
  debug:         { keys: ['f6'],             label: 'Debug',       hint: 'F6'       },
  stop:          { keys: ['shift+f5'],       label: 'Stop',        hint: 'Shift+F5' },
  toggleHistory: { keys: ['mod+h'],          label: 'History',     hint: `${M}+H`   },
} satisfies Record<string, KeyBinding>

export const REQUEST_EDITOR_KEYMAPS = {
  save:       { keys: ['mod+s'],          label: 'Save',        hint: `${M}+S`   },
  send:       { keys: ['mod+enter'],      label: 'Send',        hint: `${M}+↵`   },
  importCurl: { keys: ['mod+i'],          label: 'Import cURL', hint: `${M}+I`   },
  copyCurl:   { keys: ['mod+shift+c'],    label: 'Copy cURL',   hint: `${M}+⇧+C` },
} satisfies Record<string, KeyBinding>

export const EXPLORER_KEYMAPS = {
  rename:     { keys: ['f2'],      label: 'Rename',                hint: 'F2'      },
  delete:     { keys: ['delete'],  label: 'Delete',                hint: 'Del'     },
  newItem:    { keys: [],          label: 'New Item',              hint: ''        },
  copy:       { keys: [],          label: 'Copy',                  hint: ''        },
  openFolder: { keys: [],          label: 'Open Containing Folder', hint: ''       },
} satisfies Record<string, KeyBinding>

export const APP_KEYMAPS = {
  newProject:   { keys: ['mod+n'],             label: 'New Project',    hint: `${M}+N`      },
  openProject:  { keys: ['mod+o'],             label: 'Open Project',   hint: `${M}+O`      },
  openSettings: { keys: ['mod+,'],             label: 'App Settings',   hint: `${M}+,`      },
  closeTab:     { keys: ['mod+w'],             label: 'Close Tab',      hint: `${M}+W`      },
  reopenTab:    { keys: ['mod+shift+t'],       label: 'Reopen Tab',     hint: `${M}+⇧+T`   },
  moveTabLeft:  { keys: ['mod+alt+arrowleft'],  label: 'Move Tab Left',  hint: `${M}+Alt+←` },
  moveTabRight: { keys: ['mod+alt+arrowright'], label: 'Move Tab Right', hint: `${M}+Alt+→` },
} satisfies Record<string, KeyBinding>

export const KEYMAP_SCOPES = {
  APP:            'app',
  TEST_CASE:      'testCase',
  REQUEST_EDITOR: 'requestEditor',
  EXPLORER:       'explorer',
} as const

function fmtHint(keys: string[]): string {
  if (!keys.length) return ''
  const _M = modKey()
  return keys[0]
    .split('+')
    .map((p) => {
      switch (p) {
        case 'mod':   return _M
        case 'shift': return '⇧'
        case 'alt':   return 'Alt'
        case 'ctrl':  return 'Ctrl'
        case 'meta':  return isMac() ? '⌘' : 'Win'
        default:      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)
      }
    })
    .join('+')
}

export function applyOverrides<K extends string>(
  keymaps: Record<K, KeyBinding>,
  overrides: Record<string, string[]>,
  scope: string,
): Record<K, KeyBinding> {
  const result = {} as Record<K, KeyBinding>
  for (const [id, binding] of Object.entries(keymaps) as [K, KeyBinding][]) {
    const override = overrides[`${scope}.${id}`]
    result[id] = override ? { ...binding, keys: override, hint: fmtHint(override) } : binding
  }
  return result
}

export const KEYMAP_REGISTRY: Array<{ scopedId: string; binding: KeyBinding }> = [
  ...Object.entries(APP_KEYMAPS).map(([id, b]) => ({
    scopedId: `${KEYMAP_SCOPES.APP}.${id}`,
    binding: b as KeyBinding,
  })),
  ...Object.entries(TEST_CASE_KEYMAPS).map(([id, b]) => ({
    scopedId: `${KEYMAP_SCOPES.TEST_CASE}.${id}`,
    binding: b as KeyBinding,
  })),
  ...Object.entries(REQUEST_EDITOR_KEYMAPS).map(([id, b]) => ({
    scopedId: `${KEYMAP_SCOPES.REQUEST_EDITOR}.${id}`,
    binding: b as KeyBinding,
  })),
  ...Object.entries(EXPLORER_KEYMAPS).map(([id, b]) => ({
    scopedId: `${KEYMAP_SCOPES.EXPLORER}.${id}`,
    binding: b as KeyBinding,
  })),
]
