import { useState } from 'react'
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react'
import type { AgentSession, AgentSessionMode } from '@jkauto/core'

const MODE_LABELS: Record<AgentSessionMode, string> = {
  ask: 'Ask',
  edit: 'Edit',
  debug: 'Debug',
  'generate-test': 'Generate',
}

const MODE_COLORS: Record<AgentSessionMode, string> = {
  ask: 'text-muted-foreground',
  edit: 'text-blue-400',
  debug: 'text-amber-400',
  'generate-test': 'text-green-400',
}

interface Props {
  sessions: AgentSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: (mode: AgentSessionMode) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onChangeMode: (id: string, mode: AgentSessionMode) => void
}

export function SessionHeader({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onChangeMode,
}: Props) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const active = sessions.find((s) => s.id === activeSessionId)

  function commitRename(id: string) {
    if (editTitle.trim()) onRenameSession(id, editTitle.trim())
    setEditingId(null)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground transition-colors max-w-[180px]"
      >
        {active ? (
          <>
            <span className={`text-[10px] font-medium ${MODE_COLORS[active.mode]}`}>
              [{MODE_LABELS[active.mode]}]
            </span>
            <span className="truncate">{active.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No session</span>
        )}
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-50 w-72 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {sessions.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">No sessions</div>
              )}
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={[
                    'group flex items-center gap-2 px-2 py-1.5 hover:bg-secondary cursor-pointer',
                    sess.id === activeSessionId ? 'bg-secondary' : '',
                  ].join(' ')}
                  onClick={() => {
                    if (editingId !== sess.id) {
                      onSelectSession(sess.id)
                      setOpen(false)
                    }
                  }}
                >
                  {editingId === sess.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => commitRename(sess.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(sess.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="flex-1 text-xs bg-transparent outline-none border-b border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className={`text-[10px] font-medium shrink-0 ${MODE_COLORS[sess.mode]}`}>
                        {MODE_LABELS[sess.mode]}
                      </span>
                      <span
                        className="flex-1 text-xs truncate"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingId(sess.id)
                          setEditTitle(sess.title)
                        }}
                      >
                        {sess.title}
                      </span>
                    </>
                  )}
                  {sess.id === activeSessionId && <Check className="w-3 h-3 text-primary shrink-0" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(sess.id)
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-1 flex gap-1 flex-wrap">
              {(['ask', 'edit', 'debug', 'generate-test'] as AgentSessionMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    onCreateSession(mode)
                    setOpen(false)
                  }}
                  className={`flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium border border-border hover:bg-secondary transition-colors ${MODE_COLORS[mode]}`}
                >
                  <Plus className="w-2.5 h-2.5" />
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>

            {active && (
              <div className="border-t border-border px-2 py-1.5">
                <p className="text-[10px] text-muted-foreground mb-1">Switch mode:</p>
                <div className="flex gap-1 flex-wrap">
                  {(['ask', 'edit', 'debug', 'generate-test'] as AgentSessionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        onChangeMode(active.id, mode)
                        setOpen(false)
                      }}
                      className={[
                        'h-5 px-1.5 rounded text-[10px] border transition-colors',
                        active.mode === mode
                          ? `border-current ${MODE_COLORS[mode]}`
                          : 'border-border text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
