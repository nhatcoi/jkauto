import { useEffect, useState, useMemo } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { FileCode2, Search } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string, name: string) => void
}

interface TestCaseEntry {
  path: string
  name: string
}

function isTestCasePath(p: string) {
  return p.endsWith('.test.json') || p.endsWith('.test.yaml') || p.endsWith('.test.yml')
}

function collectEntries(nodes: FsTreeNode[]): TestCaseEntry[] {
  const result: TestCaseEntry[] = []
  for (const node of nodes) {
    if (node.type === 'file' && isTestCasePath(node.path)) {
      const name = node.displayName ?? node.name.replace(/\.test\.(json|ya?ml)$/i, '')
      result.push({ path: node.path, name })
    }
    if (node.children) result.push(...collectEntries(node.children))
  }
  return result
}

export function CallTestCaseDialog({ open, onOpenChange, onSelect }: Props) {
  const { activeProject } = useProjectStore()
  const [entries, setEntries] = useState<TestCaseEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !activeProject) return
    setLoading(true)
    invoke<FsTreeNode[]>(IpcChannels.FS_TREE, activeProject.path)
      .then((tree) => setEntries(collectEntries(tree).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [open, activeProject])

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const filtered = useMemo(
    () =>
      query.trim()
        ? entries.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
        : entries,
    [entries, query],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-xl w-[480px] max-h-[520px] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Call Test Case</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select a test case to call inline</p>
        </div>

        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 bg-input border border-border rounded px-2 py-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search test cases…"
              className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading && (
            <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No test cases found</p>
          )}
          {!loading && filtered.map((entry) => (
            <button
              key={entry.path}
              onClick={() => { onSelect(entry.path, entry.name); onOpenChange(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary transition-colors text-left"
            >
              <FileCode2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{entry.path}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
