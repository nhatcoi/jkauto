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

function matchesBinding(e: KeyboardEvent, keys: string[]): boolean {
  return keys.some((combo) => {
    const parts = combo.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    const needCtrl = parts.includes('ctrl')
    const needMeta = parts.includes('meta')
    const needAlt = parts.includes('alt')
    const needShift = parts.includes('shift')
    const needMod = needCtrl || needMeta

    return (
      e.key.toLowerCase() === key &&
      (needMod ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) &&
      (needAlt ? e.altKey : !e.altKey) &&
      (needShift ? e.shiftKey : !e.shiftKey)
    )
  })
}

export const TEST_CASE_KEYMAPS = {
  save:          { keys: ['ctrl+s', 'meta+s'],          label: 'Save',        hint: `${modKey()}+S` },
  addStep:       { keys: ['alt+a'],                     label: 'Add Step',    hint: 'Alt+A' },
  deleteStep:    { keys: ['delete', 'backspace'],        label: 'Delete Step', hint: 'Del' },
  moveUp:        { keys: ['alt+arrowup'],               label: 'Move Up',     hint: 'Alt+↑' },
  moveDown:      { keys: ['alt+arrowdown'],             label: 'Move Down',   hint: 'Alt+↓' },
  duplicateStep: { keys: ['ctrl+d', 'meta+d'],          label: 'Duplicate',   hint: `${modKey()}+D` },
  run:           { keys: ['f5'],                        label: 'Run',         hint: 'F5' },
  debug:         { keys: ['f6'],                        label: 'Debug',       hint: 'F6' },
  stop:          { keys: ['shift+f5'],                  label: 'Stop',        hint: 'Shift+F5' },
  toggleHistory: { keys: ['ctrl+h', 'meta+h'],          label: 'History',     hint: `${modKey()}+H` },
} satisfies Record<string, KeyBinding>

export const REQUEST_EDITOR_KEYMAPS = {
  save:       { keys: ['ctrl+s', 'meta+s'],             label: 'Save',         hint: `${modKey()}+S` },
  send:       { keys: ['ctrl+enter', 'meta+enter'],     label: 'Send',         hint: `${modKey()}+↵` },
  importCurl: { keys: ['ctrl+i', 'meta+i'],             label: 'Import cURL',  hint: `${modKey()}+I` },
  copyCurl:   { keys: ['ctrl+shift+c', 'meta+shift+c'], label: 'Copy cURL',    hint: `${modKey()}+⇧+C` },
} satisfies Record<string, KeyBinding>

export const EXPLORER_KEYMAPS = {
  rename: { keys: ['f2'],              label: 'Rename',  hint: 'F2' },
  delete: { keys: ['delete'],          label: 'Delete',  hint: 'Del' },
  newItem:{ keys: ['ctrl+n', 'meta+n'],label: 'New Item',hint: `${modKey()}+N` },
} satisfies Record<string, KeyBinding>

export { matchesBinding }
