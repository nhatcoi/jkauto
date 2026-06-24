import { useState, useEffect } from 'react'
import { FileSpreadsheet, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/project.store'
import { listDataFiles, createDataFile } from './api'
import { DataFileGenerator } from './components/DataFileGenerator'

export function DataFilesOverview() {
  const { activeProject, openTab } = useProjectStore()
  const [files, setFiles] = useState<{ name: string; path: string }[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  function reload() {
    if (!activeProject) return
    listDataFiles(activeProject.path).then(setFiles).catch(() => setFiles([]))
  }

  useEffect(() => { reload() }, [activeProject?.path])

  async function handleCreate() {
    if (!newName.trim() || !activeProject) return
    setCreating(true)
    try {
      const filePath = await createDataFile(activeProject.path, newName.trim())
      setNewName('')
      setShowNew(false)
      reload()
      openTab(filePath, newName.trim(), activeProject.path)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-panel shrink-0">
        <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground/80 flex-1">Data Files</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs gap-1 px-2"
          onClick={() => setShowNew((v) => !v)}
        >
          <Plus className="w-3 h-3" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <DataFileGenerator onCreated={reload} />

        {showNew && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowNew(false); setNewName('') }
              }}
              placeholder="file-name…"
              autoFocus
              className="flex-1 text-xs bg-input text-foreground px-2 py-1 rounded border border-border focus:border-primary outline-none"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating} className="h-6 text-xs px-2">
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
            </Button>
          </div>
        )}

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/40">
            <FileSpreadsheet className="w-10 h-10" />
            <div className="text-xs">No data files yet</div>
            <div className="text-[11px]">Use "Generate from Analysis" or create one manually</div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => activeProject && openTab(f.path, f.name, activeProject.path)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-muted/30 transition-colors text-left group"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground/80 group-hover:text-foreground truncate">{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
