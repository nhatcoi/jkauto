import { useState } from 'react'
import { Sparkles, X, FileSpreadsheet, Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/project.store'
import { aiGenerateDataFiles, writeDataFile } from '../api'
import type { DataFileAiGenerateResult } from '@jkauto/core'

interface Props {
  onCreated: () => void
}

export function DataFileGenerator({ onCreated }: Props) {
  const { activeProject, openTab } = useProjectStore()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DataFileAiGenerateResult | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [saved, setSaved] = useState<Set<number>>(new Set())

  if (!activeProject) return null

  async function generate() {
    if (!activeProject) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(new Set())
    try {
      const r = await aiGenerateDataFiles(activeProject.path, prompt || undefined)
      setResult(r)
      setExpanded(new Set([0]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function saveFile(index: number) {
    if (!result || !activeProject) return
    const file = result.files[index]
    setSaving((prev) => new Set([...prev, index]))
    try {
      const slug = file.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
      const filePath = `${activeProject.path}/data-files/${slug}.data.json`
      await writeDataFile(filePath, {
        schemaVersion: 1,
        name: file.name,
        columns: file.columns,
        rows: file.rows,
      })
      setSaved((prev) => new Set([...prev, index]))
      onCreated()
      openTab(filePath, file.name, activeProject.path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving((prev) => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  async function saveAll() {
    if (!result) return
    for (let i = 0; i < result.files.length; i++) {
      if (!saved.has(i)) await saveFile(i)
    }
  }

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">Generate from Analysis</span>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            AI analyzes project endpoints and data models to generate test data files automatically.
            {result?.analysisUsed === false && (
              <span className="text-yellow-500/80"> No analysis data yet — using generic templates.</span>
            )}
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional: focus on login, payments, users…"
              className="flex-1 text-xs bg-input text-foreground px-2 py-1.5 rounded border border-border focus:border-primary outline-none placeholder:text-muted-foreground/50"
              onKeyDown={(e) => e.key === 'Enter' && !loading && generate()}
            />
            <Button
              size="sm"
              onClick={generate}
              disabled={loading}
              className="h-7 text-xs gap-1.5 shrink-0"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>

          {error && (
            <div className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1.5 flex items-start gap-1.5">
              <X className="w-3 h-3 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && result.files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {result.files.length} file{result.files.length !== 1 ? 's' : ''} generated
                </span>
                {result.files.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveAll}
                    className="h-6 text-[11px] px-2 gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Save all
                  </Button>
                )}
              </div>

              {result.files.map((file, i) => (
                <div key={i} className="border border-border rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => {
                      const s = new Set(prev)
                      s.has(i) ? s.delete(i) : s.add(i)
                      return s
                    })}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[11px] font-medium text-foreground flex-1 truncate">
                      {file.name}.data.json
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {file.rows.length} rows
                    </span>
                    {expanded.has(i) ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {expanded.has(i) && (
                    <div className="p-2 space-y-2">
                      {file.description && (
                        <p className="text-[10px] text-muted-foreground/70 italic">{file.description}</p>
                      )}
                      <div className="overflow-x-auto rounded border border-border/50">
                        <table className="w-full text-[10px] font-mono">
                          <thead>
                            <tr className="bg-muted/30">
                              {file.columns.map((col) => (
                                <th key={col} className="px-2 py-1 text-left text-muted-foreground font-medium whitespace-nowrap border-r border-border/30 last:border-r-0">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {file.rows.slice(0, 6).map((row, ri) => (
                              <tr key={ri} className="border-t border-border/20 hover:bg-muted/10">
                                {file.columns.map((_, ci) => (
                                  <td key={ci} className="px-2 py-0.5 text-foreground/80 whitespace-nowrap border-r border-border/20 last:border-r-0 max-w-[120px] truncate">
                                    {row[ci] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {file.rows.length > 6 && (
                              <tr className="border-t border-border/20">
                                <td colSpan={file.columns.length} className="px-2 py-0.5 text-muted-foreground/50 text-center">
                                  +{file.rows.length - 6} more rows
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Button
                        size="sm"
                        variant={saved.has(i) ? 'outline' : 'default'}
                        onClick={() => saveFile(i)}
                        disabled={saving.has(i) || saved.has(i)}
                        className="h-6 text-[11px] w-full gap-1.5"
                      >
                        {saving.has(i) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        {saved.has(i) ? 'Saved ✓' : saving.has(i) ? 'Saving…' : 'Create file'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {result && result.files.length === 0 && (
            <div className="text-[11px] text-muted-foreground/60 text-center py-2">
              No files generated. Try a more specific prompt.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
