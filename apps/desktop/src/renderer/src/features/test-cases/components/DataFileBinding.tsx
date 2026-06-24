import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, X, ExternalLink } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { listDataFiles, readDataFile } from '@/features/data-files/api'
import type { TestCase } from '../types'

interface Props {
  tc: TestCase
  onChange: (fn: (prev: TestCase) => TestCase) => void
}

interface DataFileEntry {
  name: string
  path: string
}

interface DataFileSummary {
  rows: number
  columns: string[]
}

export function DataFileBinding({ tc, onChange }: Props) {
  const { activeProject, openTab } = useProjectStore()
  const [open, setOpen] = useState(!!tc.dataFile)
  const [files, setFiles] = useState<DataFileEntry[]>([])
  const [summary, setSummary] = useState<DataFileSummary | null>(null)

  // Load available data files from project
  useEffect(() => {
    if (!activeProject) return
    listDataFiles(activeProject.path).then(setFiles).catch(() => setFiles([]))
  }, [activeProject?.path])

  // Load summary of bound data file
  useEffect(() => {
    if (!tc.dataFile || !activeProject) { setSummary(null); return }
    const absPath = tc.dataFile.startsWith('/')
      ? tc.dataFile
      : `${activeProject.path}/${tc.dataFile}`
    readDataFile(absPath)
      .then((d) => setSummary({ rows: d.rows.length, columns: d.columns }))
      .catch(() => setSummary(null))
  }, [tc.dataFile, activeProject?.path])

  const relPath = (abs: string) =>
    activeProject ? abs.replace(`${activeProject.path}/`, '') : abs

  const bound = files.find((f) => tc.dataFile && tc.dataFile.endsWith(f.name + '.data.json'))
    ?? (tc.dataFile ? { name: tc.dataFile, path: tc.dataFile } : null)

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (!value) {
      onChange((prev) => ({ ...prev, dataFile: undefined }))
      setSummary(null)
    } else {
      const entry = files.find((f) => f.path === value)
      if (!entry) return
      onChange((prev) => ({ ...prev, dataFile: relPath(entry.path) }))
    }
  }

  const handleOpen = () => {
    if (!tc.dataFile || !activeProject) return
    const abs = tc.dataFile.startsWith('/')
      ? tc.dataFile
      : `${activeProject.path}/${tc.dataFile}`
    openTab(abs, bound?.name ?? tc.dataFile, activeProject.path)
  }

  return (
    <div className="border-b border-border shrink-0">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
        <FileSpreadsheet className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Data File
        </span>
        {tc.dataFile && summary && (
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            ({summary.rows} rows)
          </span>
        )}
        {tc.dataFile && !summary && (
          <span className="text-[10px] text-yellow-500/70">bound</span>
        )}
      </div>

      {open && (
        <div className="px-3 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={tc.dataFile ? (files.find((f) => relPath(f.path) === tc.dataFile)?.path ?? '') : ''}
              onChange={handleSelect}
              className="flex-1 text-xs bg-input text-foreground px-2 py-1 rounded border border-border focus:border-primary outline-none"
            >
              <option value="">— none —</option>
              {files.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
            {tc.dataFile && (
              <>
                <button
                  type="button"
                  onClick={handleOpen}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Open data file"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange((prev) => ({ ...prev, dataFile: undefined }))}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                  title="Remove binding"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {tc.dataFile && summary && (
            <div className="text-[10px] text-muted-foreground/60 font-mono space-y-0.5">
              <div>
                Will run <span className="text-primary font-semibold">{summary.rows}×</span> (one per row)
              </div>
              <div className="truncate">
                Columns: {summary.columns.join(', ') || '—'}
              </div>
            </div>
          )}

          {files.length === 0 && (
            <div className="text-[10px] text-muted-foreground/40">
              No data files in project. Create one in the Data Files section.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
