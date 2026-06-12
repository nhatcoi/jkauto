import { useEffect, useRef } from 'react'
import type { KeyBinding } from '@/shared/keymaps'
import { matchesBinding } from '@/shared/keymaps'

type Handlers<K extends string> = Partial<Record<K, () => void>>

function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.isContentEditable ||
    t.closest('[role="textbox"]') !== null
  )
}

export function useGlobalKeymap<K extends string>(
  keymaps: Record<K, KeyBinding>,
  handlers: Handlers<K>,
  opts?: { allowInInputs?: boolean },
) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      for (const [id, binding] of Object.entries(keymaps) as [K, KeyBinding][]) {
        if (!matchesBinding(e, binding.keys)) continue

        const needsInput = opts?.allowInInputs
        const plain = !e.ctrlKey && !e.metaKey && !e.altKey

        if (!needsInput && plain && isEditableTarget(e)) continue

        const fn = handlersRef.current[id]
        if (fn) {
          e.preventDefault()
          fn()
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keymaps, opts?.allowInInputs])
}
