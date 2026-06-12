import { useState, useCallback } from 'react'
import { Bot, FolderTree, Play, Palette, Keyboard, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { AgentSection } from './sections/AgentSection'
import { ExecutionSection } from './sections/ExecutionSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { ExplorerSection } from './sections/ExplorerSection'
import { KeyboardSection } from './sections/KeyboardSection'
import type { AppSettings } from '@jkauto/core'

type SectionId = 'agent' | 'execution' | 'appearance' | 'explorer' | 'keyboard'

const NAV: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'agent',      label: 'AI Agent',    icon: Bot },
  { id: 'execution',  label: 'Execution',   icon: Play },
  { id: 'appearance', label: 'Appearance',  icon: Palette },
  { id: 'explorer',   label: 'Explorer',    icon: FolderTree },
  { id: 'keyboard',   label: 'Shortcuts',   icon: Keyboard },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { settings, update } = useAppSettingsStore()
  const [activeSection, setActiveSection] = useState<SectionId>('agent')

  const handleAgentChange = useCallback(
    (patch: Partial<AppSettings['agent']>) => {
      update({ agent: { ...settings!.agent, ...patch } })
    },
    [settings, update],
  )

  const handleExecutionChange = useCallback(
    (patch: Partial<AppSettings['execution']>) => {
      update({ execution: { ...settings!.execution, ...patch } })
    },
    [settings, update],
  )

  const handleAppearanceChange = useCallback(
    (patch: Partial<AppSettings['appearance']>) => {
      update({ appearance: { ...settings!.appearance, ...patch } })
    },
    [settings, update],
  )

  const handleExplorerChange = useCallback(
    (patch: Partial<AppSettings['explorer']>) => {
      update({ explorer: { ...settings!.explorer, ...patch } })
    },
    [settings, update],
  )

  if (!settings) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden"
        style={{ height: 480 }}
      >
        {/* Custom close button — DialogContent default one overlaps sidebar */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <aside className="w-44 shrink-0 border-r border-border bg-sidebar flex flex-col py-3 px-2 gap-0.5">
            <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
              Settings
            </div>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left w-full',
                  activeSection === id
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </aside>

          {/* Content */}
          <main className="flex-1 min-h-0 overflow-y-auto p-5">
            {activeSection === 'agent' && (
              <AgentSection settings={settings} onChange={handleAgentChange} />
            )}
            {activeSection === 'execution' && (
              <ExecutionSection settings={settings} onChange={handleExecutionChange} />
            )}
            {activeSection === 'appearance' && (
              <AppearanceSection settings={settings} onChange={handleAppearanceChange} />
            )}
            {activeSection === 'explorer' && (
              <ExplorerSection settings={settings} onChange={handleExplorerChange} />
            )}
            {activeSection === 'keyboard' && <KeyboardSection />}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
