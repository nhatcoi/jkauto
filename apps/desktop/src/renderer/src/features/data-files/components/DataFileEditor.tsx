import { useRef } from 'react'
import { Plus, Trash2, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DataFile } from '../types'

interface Props {
  data: DataFile
  onChange: (fn: (prev: DataFile) => DataFile) => void
}

export function DataFileEditor({ data, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addColumn = () => {
    onChange((prev) => {
      const name = `col${prev.columns.length + 1}`
      return {
        ...prev,
        columns: [...prev.columns, name],
        rows: prev.rows.map((r) => [...r, '']),
      }
    })
  }

  const removeColumn = (ci: number) => {
    onChange((prev) => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== ci),
      rows: prev.rows.map((r) => r.filter((_, i) => i !== ci)),
    }))
  }

  const renameColumn = (ci: number, name: string) => {
    onChange((prev) => {
      const cols = [...prev.columns]
      cols[ci] = name
      return { ...prev, columns: cols }
    })
  }

  const addRow = () => {
    onChange((prev) => ({
      ...prev,
      rows: [...prev.rows, prev.columns.map(() => '')],
    }))
  }

  const removeRow = (ri: number) => {
    onChange((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== ri),
    }))
  }

  const setCellValue = (ri: number, ci: number, value: string) => {
    onChange((prev) => {
      const rows = prev.rows.map((r, i) =>
        i === ri ? r.map((c, j) => (j === ci ? value : c)) : r,
      )
      return { ...prev, rows }
    })
  }

  const exportCsv = () => {
    const header = data.columns.join(',')
    const body = data.rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const csv = [header, body].filter(Boolean).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length === 0) return
      const columns = lines[0]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map((line) =>
        line.split(',').map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"')),
      )
      onChange(() => ({ schemaVersion: 1, name: data.name, columns, rows }))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border shrink-0">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Row
        </button>
        <button
          type="button"
          onClick={addColumn}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Column
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          {data.rows.length} rows × {data.columns.length} cols
        </span>
        <div className="w-px h-4 bg-border" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Upload className="w-3.5 h-3.5" />
          Import CSV
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={importCsv} />
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th className="w-8 border-b border-r border-border text-muted-foreground/50 font-normal text-center py-1">
                #
              </th>
              {data.columns.map((col, ci) => (
                <th key={ci} className="border-b border-r border-border font-normal min-w-[120px]">
                  <div className="flex items-center gap-1 px-1">
                    <input
                      value={col}
                      onChange={(e) => renameColumn(ci, e.target.value)}
                      className="flex-1 bg-transparent text-foreground/80 font-mono text-[11px] focus:outline-none focus:text-primary min-w-0"
                      placeholder="column"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(ci)}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground/30 hover:opacity-100 transition-opacity"
                      title="Remove column"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className="group hover:bg-secondary/20">
                <td className="border-b border-r border-border text-center text-muted-foreground/40 py-0.5 font-mono text-[10px]">
                  {ri + 1}
                </td>
                {data.columns.map((_, ci) => (
                  <td key={ci} className="border-b border-r border-border p-0">
                    <input
                      value={row[ci] ?? ''}
                      onChange={(e) => setCellValue(ri, ci, e.target.value)}
                      className="w-full px-2 py-1 bg-transparent text-foreground/90 focus:outline-none focus:bg-primary/5 font-mono text-[11px]"
                    />
                  </td>
                ))}
                <td className="border-b border-border text-center py-0.5">
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      'text-muted-foreground/40 hover:text-destructive',
                    )}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={data.columns.length + 2}
                  className="text-center py-8 text-muted-foreground/40 text-xs"
                >
                  No rows. Click "Add Row" to add test data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
