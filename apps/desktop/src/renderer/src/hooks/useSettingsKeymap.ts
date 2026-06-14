import { useMemo } from 'react'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { useGlobalKeymap } from './useGlobalKeymap'
import { applyOverrides } from '@/shared/keymaps'
import type { KeyBinding } from '@/shared/keymaps'

type Handlers<K extends string> = Partial<Record<K, () => void>>

export function useSettingsKeymap<K extends string>(
  keymaps: Record<K, KeyBinding>,
  scope: string,
  handlers: Handlers<K>,
  opts?: { allowInInputs?: boolean },
): Record<K, KeyBinding> {
  const overrides = useAppSettingsStore((s) => s.settings?.keymaps ?? {})
  const resolved = useMemo(
    () => applyOverrides(keymaps, overrides, scope),
    [keymaps, overrides, scope],
  )
  useGlobalKeymap(resolved, handlers, opts)
  return resolved
}
