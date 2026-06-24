import { useState } from 'react'
import { Save, FileSpreadsheet, Plus, AlertCircle, Loader2 } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { createDataFile } from './api'
import { useDataFile } from './hooks/useDataFile'
import { DataFileEditor } from './components/DataFileEditor'

function DataFileTab({ filePath }: { filePath: string }) {
  const { data, saving, error, dirty, mutate, save } = useDataFile(filePath)

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive text-xs">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 bg-panel">
        <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground/80">{data.name}</span>
        {dirty && <span className="text-[10px] text-yellow-400">●</span>}
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <DataFileEditor data={data} onChange={mutate} />
    </div>
  )
}

export function DataFilesView({ filePath }: { filePath: string }) {
  // filePath here is the actual .data.json file path (opened via explorer double-click)
  return <DataFileTab filePath={filePath} />
}

export function DataFilesCreateView() {
  const { activeProject, openTab } = useProjectStore()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || !activeProject) return
    setCreating(true)
    try {
      const filePath = await createDataFile(activeProject.path, name.trim())
      openTab(filePath, name.trim(), activeProject.path)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-8">
      <FileSpreadsheet className="w-10 h-10 opacity-20" />
      <div className="text-sm">Create a Data File</div>
      <div className="flex gap-2 mt-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="File name…"
          className="text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border focus:border-primary outline-none w-48"
          autoFocus
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim() || creating}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </div>
    </div>
  )
}
