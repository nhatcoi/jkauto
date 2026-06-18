import { useState } from 'react'
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react'
import type { AgentSession } from '@jkauto/core'

interface Props {
  sessions: AgentSession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
}

export function SessionHeader({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
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
          <span className="truncate">{active.title}</span>
        ) : (
          <span className="text-muted-foreground">New chat</span>
        )}
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-50 w-72 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {sessions.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  No sessions
                </div>
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
                  )}
                  {sess.id === activeSessionId && (
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  )}
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

            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  onCreateSession()
                  setOpen(false)
                }}
                className="flex w-full items-center gap-1.5 h-7 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Plus className="w-3 h-3" />
                New chat
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
