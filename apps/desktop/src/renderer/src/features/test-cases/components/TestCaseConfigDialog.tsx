import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, ExternalLink, X, FileSpreadsheet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { listDataFiles, readDataFile } from '@/features/data-files/api'
import type { DataFile } from '@/features/data-files/types'
import type { TestCase } from '../types'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  tc: TestCase
  onChange: (fn: (prev: TestCase) => TestCase) => void
}

/* ── Variables tab ── */
function VariablesTab({
  variables,
  onChange,
}: {
  variables: Record<string, string>
  onChange: (vars: Record<string, string>) => void
}) {
  const entries = Object.entries(variables)

  const setVar = (oldKey: string, newKey: string, value: string) => {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(variables)) {
      if (k === oldKey) next[newKey] = value
      else next[k] = v
    }
    onChange(next)
  }

  const addVar = () => {
    const base = 'VAR'
    let key = base
    let n = 1
    while (key in variables) key = `${base}_${n++}`
    onChange({ ...variables, [key]: '' })
  }

  const removeVar = (key: string) => {
    const next = { ...variables }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Use <code className="font-mono bg-muted px-1 rounded text-[11px]">{'{{VAR_NAME}}'}</code> in step inputs to reference variables.
        </p>
        <button
          type="button"
          onClick={addVar}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/40 italic py-2 text-center">
          No variables defined. Click Add to create one.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
            <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">Name</span>
            <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide">Value</span>
            <span className="w-6" />
          </div>
          {entries.map(([key, val]) => (
            <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                value={key}
                onChange={(e) => setVar(key, e.target.value, val)}
                className={cn(
                  'text-[11px] bg-input text-foreground font-mono px-2 py-1.5 rounded border border-border',
                  'focus:border-primary outline-none transition-colors',
                )}
                placeholder="VAR_NAME"
              />
              <input
                value={val}
                onChange={(e) => setVar(key, key, e.target.value)}
                className={cn(
                  'text-[11px] bg-input text-foreground font-mono px-2 py-1.5 rounded border border-border',
                  'focus:border-primary outline-none transition-colors',
                )}
                placeholder="value"
              />
              <button
                type="button"
                onClick={() => removeVar(key)}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Data File tab ── */
interface DataFileEntry { name: string; path: string }

function DataFileTab({
  tc,
  onChange,
}: {
  tc: TestCase
  onChange: (fn: (prev: TestCase) => TestCase) => void
}) {
  const { activeProject, openTab } = useProjectStore()
  const [files, setFiles] = useState<DataFileEntry[]>([])
  const [dataFile, setDataFile] = useState<DataFile | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeProject) return
    listDataFiles(activeProject.path).then(setFiles).catch(() => setFiles([]))
  }, [activeProject?.path])

  useEffect(() => {
    if (!tc.dataFile || !activeProject) { setDataFile(null); return }
    const abs = tc.dataFile.startsWith('/')
      ? tc.dataFile
      : `${activeProject.path}/${tc.dataFile}`
    readDataFile(abs).then(setDataFile).catch(() => setDataFile(null))
  }, [tc.dataFile, activeProject?.path])

  useEffect(() => {
    if (dataFile && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [dataFile])

  const relPath = (abs: string) =>
    activeProject ? abs.replace(`${activeProject.path}/`, '') : abs

  const bound = files.find((f) => tc.dataFile && tc.dataFile.endsWith(f.name + '.data.json'))
    ?? (tc.dataFile ? { name: tc.dataFile, path: tc.dataFile } : null)

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (!value) {
      onChange((prev) => ({ ...prev, dataFile: undefined }))
      setDataFile(null)
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
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Bind a data file to run this test case once per row.
        Use <code className="font-mono bg-muted px-1 rounded text-[11px]">{'{{column_name}}'}</code> in steps to reference columns.
      </p>

      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
        <select
          value={tc.dataFile ? (files.find((f) => relPath(f.path) === tc.dataFile)?.path ?? '') : ''}
          onChange={handleSelect}
          className="flex-1 text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border focus:border-primary outline-none"
        >
          <option value="">— none (run once) —</option>
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
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Open data file"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChange((prev) => ({ ...prev, dataFile: undefined }))}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
              title="Remove binding"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {tc.dataFile && dataFile && (
        <div ref={tableRef} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <span className="font-mono text-primary font-bold">{dataFile.rows.length}×</span>
            <span>rows</span>
            <span>·</span>
            <span>{dataFile.columns.length} columns</span>
          </div>
          <div className="overflow-auto max-h-52 rounded border border-border">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/80 border-b border-border">
                  <th className="px-2 py-1.5 text-left text-[9px] font-medium text-muted-foreground/50 w-8 border-r border-border/50">
                    #
                  </th>
                  {dataFile.columns.map((col) => (
                    <th
                      key={col}
                      className="px-2 py-1.5 text-left font-mono font-medium text-muted-foreground/80 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataFile.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-2 py-1 text-[10px] text-muted-foreground/30 font-mono border-r border-border/30 text-center">
                      {i + 1}
                    </td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-2 py-1 font-mono text-foreground/80 whitespace-nowrap"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tc.dataFile && !dataFile && (
        <div className="text-[11px] text-yellow-500/70">
          Data file bound but could not load. Check file path.
        </div>
      )}

      {files.length === 0 && (
        <div className="text-[11px] text-muted-foreground/40 italic">
          No data files in project. Create one in the Data Files section.
        </div>
      )}
    </div>
  )
}

/* ── Dialog ── */
export function TestCaseConfigDialog({ open, onOpenChange, tc, onChange }: Props) {
  const varCount = Object.keys(tc.variables ?? {}).length
  const hasData = !!tc.dataFile

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Test Case Config</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="datafile" className="mt-1">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="datafile" className="text-xs gap-1.5">
              Data File
              {hasData && (
                <span className="text-[10px] bg-green-500/20 text-green-400 font-mono px-1 rounded">
                  bound
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="variables" className="text-xs gap-1.5">
              Variables
              {varCount > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary font-mono px-1 rounded">
                  {varCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="datafile" className="mt-4">
            <DataFileTab tc={tc} onChange={onChange} />
          </TabsContent>

          <TabsContent value="variables" className="mt-4">
            <VariablesTab
              variables={tc.variables ?? {}}
              onChange={(vars) =>
                onChange((prev) => ({
                  ...prev,
                  variables: Object.keys(vars).length ? vars : {},
                }))
              }
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
