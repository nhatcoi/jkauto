import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocPreview {
  file: string
  preview?: string
}

interface DocumentationData {
  sourceRoot?: string
  files?: string[]
  readmeExcerpt?: string
  previews?: DocPreview[]
}

function shortPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').split('/').slice(-3).join('/')
}

function MarkdownPre({ content }: { content: string }) {
  return (
    <pre className="overflow-auto rounded-lg border border-border bg-card/40 p-3 font-mono text-[10px] leading-5 text-foreground/80 whitespace-pre-wrap">
      {content}
    </pre>
  )
}

export function DocumentationView({ contentJson }: { contentJson: string }) {
  let data: DocumentationData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const files = data.files ?? []
  const previews = data.previews ?? []
  const [openPreviews, setOpenPreviews] = useState<Set<string>>(new Set())
  const [readmeOpen, setReadmeOpen] = useState(!!data.readmeExcerpt)

  function togglePreview(file: string) {
    setOpenPreviews((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {data.readmeExcerpt ? (
        <div className="rounded-lg border border-border bg-card/20">
          <button
            type="button"
            onClick={() => setReadmeOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/30"
          >
            {readmeOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium">README</span>
          </button>
          {readmeOpen && (
            <div className="px-3 pb-3">
              <MarkdownPre content={data.readmeExcerpt} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No README detected.</p>
      )}

      {files.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Documentation files ({files.length})
          </h3>
          <div className="rounded-lg border border-border bg-card/20">
            {files.map((file, i) => {
              const preview = previews.find((p) => p.file === file)
              const isOpen = openPreviews.has(file)
              return (
                <div
                  key={i}
                  className="border-b border-border/40 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => preview && togglePreview(file)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] transition-colors hover:bg-secondary/20',
                      !preview && 'cursor-default',
                    )}
                  >
                    {preview ? (
                      isOpen ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )
                    ) : (
                      <span className="h-3 w-3 shrink-0" />
                    )}
                    <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono" title={file}>{shortPath(file)}</span>
                    {preview && (
                      <span className="ml-auto text-[9px] text-muted-foreground">preview</span>
                    )}
                  </button>
                  {isOpen && preview?.preview && (
                    <div className="px-3 pb-3">
                      <MarkdownPre content={preview.preview} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
