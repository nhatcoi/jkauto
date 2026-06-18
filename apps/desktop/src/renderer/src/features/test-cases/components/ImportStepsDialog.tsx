import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { FileDown, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseImportedSteps } from '../utils/import-parser'
import type { TestStep } from '../utils/import-parser'

const TABS = [
  { id: 'yaml', label: 'YAML', desc: 'App format — YAML array of steps' },
  { id: 'csv', label: 'CSV', desc: 'App format — CSV file with headers (keyword, objectRef, input, expected, description)' },
  { id: 'selenium', label: 'Selenium IDE', desc: 'Selenium IDE (.side) format' },
  { id: 'playwright', label: 'Playwright', desc: 'Playwright test script (.js/.ts)' },
  { id: 'cypress', label: 'Cypress', desc: 'Cypress test script (.js/.ts)' },
]

function getKeywordColor(keyword: string): string {
  const colors: Record<string, string> = {
    'navigate-to': 'bg-blue-600',
    'click': 'bg-emerald-600',
    'type-text': 'bg-indigo-600',
    'clear-text': 'bg-amber-600',
    'hover': 'bg-pink-600',
    'press-key': 'bg-purple-600',
    'scroll-to': 'bg-teal-600',
    'select-option': 'bg-violet-600',
    'check': 'bg-cyan-600',
    'uncheck': 'bg-sky-600',
    'assert-text': 'bg-rose-600',
    'assert-url-contains': 'bg-rose-600',
    'assert-url': 'bg-rose-600',
    'assert-visible': 'bg-rose-600',
    'assert-hidden': 'bg-rose-600',
    'assert-element-value': 'bg-rose-600',
    'get-text': 'bg-rose-600',
    'wait-ms': 'bg-orange-600',
    'wait': 'bg-orange-600',
    'wait-for-element': 'bg-orange-600',
    'wait-for-visible': 'bg-orange-600',
    'take-screenshot': 'bg-violet-600',
  }
  return colors[keyword] || 'bg-slate-600'
}

interface ImportStepsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (steps: TestStep[]) => void
}

export function ImportStepsDialog({ open, onOpenChange, onImport }: ImportStepsDialogProps) {
  const [activeTab, setActiveTab] = useState('yaml')
  const [content, setContent] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [previewSteps, setPreviewSteps] = useState<TestStep[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset states on open/close
  useEffect(() => {
    if (open) {
      setContent('')
      setPreviewSteps([])
      setParseError(null)
    }
  }, [open])

  // Live parser effect
  useEffect(() => {
    if (!content.trim()) {
      setPreviewSteps([])
      setParseError(null)
      return
    }
    try {
      const parsed = parseImportedSteps(content, activeTab)
      setPreviewSteps(parsed)
      setParseError(null)
    } catch (err) {
      setPreviewSteps([])
      setParseError(err instanceof Error ? err.message : String(err))
    }
  }, [content, activeTab])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await loadFile(file)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await loadFile(file)
    }
  }

  const loadFile = async (file: File) => {
    try {
      const text = await file.text()
      setContent(text)
      
      const name = file.name.toLowerCase()
      if (name.endsWith('.side')) {
        setActiveTab('selenium')
      } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        setActiveTab('yaml')
      } else if (name.endsWith('.csv')) {
        setActiveTab('csv')
      } else {
        if (text.includes('cy.')) {
          setActiveTab('cypress')
        } else if (text.includes('page.')) {
          setActiveTab('playwright')
        }
      }
    } catch (err) {
      setParseError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const triggerImport = () => {
    if (previewSteps.length > 0) {
      onImport(previewSteps)
      onOpenChange(false)
    }
  }

  const activeTabDesc = TABS.find((t) => t.id === activeTab)?.desc

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-border text-foreground flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-md font-bold text-center">Import Steps</DialogTitle>
        </DialogHeader>

        {/* Format tabs */}
        <div className="flex border-b border-border mb-3 select-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-all border-b-2 border-transparent',
                activeTab === tab.id
                  ? 'text-primary border-b-primary bg-primary/5'
                  : 'hover:text-foreground hover:bg-secondary/40'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main interactive area */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          <div className="text-xs text-muted-foreground/80">{activeTabDesc}</div>

          {/* Drag & Drop area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-muted-foreground/40 hover:bg-secondary/20 text-muted-foreground'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".yaml,.yml,.side,.js,.ts,.csv"
            />
            <Upload className="w-6 h-6 text-muted-foreground/60" />
            <span className="text-xs font-medium">Drop file here or click to browse</span>
          </div>

          {/* Textarea for pasting */}
          <div className="flex flex-col gap-1.5 flex-1 min-h-[140px]">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">
              — or paste content —
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Paste ${activeTab.toUpperCase()} content here...`}
              className="flex-1 bg-input border border-border rounded p-2.5 text-xs font-mono text-foreground focus:border-primary outline-none resize-none leading-relaxed min-h-[120px]"
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-2 rounded font-mono select-text">
              {parseError}
            </div>
          )}

          {/* Live Preview */}
          {previewSteps.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col border border-border/60 rounded bg-background/20 p-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 px-1 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5" />
                Parsed Steps Preview ({previewSteps.length})
              </div>
              <div className="flex-1 overflow-y-auto max-h-48 border border-border/30 rounded bg-background/10">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/30 sticky top-0">
                      <th className="px-2 py-1 font-medium text-muted-foreground w-6">#</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground w-28">Keyword</th>
                      <th className="px-2 py-1 font-medium text-muted-foreground">Target / Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSteps.map((step, idx) => (
                      <tr key={idx} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-semibold text-white uppercase',
                            getKeywordColor(step.keyword)
                          )}>
                            {step.keyword}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono text-foreground/85 truncate max-w-[340px]">
                          {step.objectRef || step.input || step.expected || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 pt-3 border-t border-border/60">
          <div className="flex justify-end gap-2 w-full">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={previewSteps.length === 0}
              onClick={triggerImport}
              className="px-4 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
