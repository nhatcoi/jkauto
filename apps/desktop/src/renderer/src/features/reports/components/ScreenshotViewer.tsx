import { useEffect, useRef } from 'react'
import { X, Camera, ExternalLink } from 'lucide-react'
declare global { interface Window { api: { openExternal: (url: string) => void } } }
import { cn } from '@/lib/utils'

interface Props {
  screenshotPath: string
  stepIndex: number
  onClose: () => void
}

export function ScreenshotViewer({ screenshotPath, stepIndex, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const src = `file://${screenshotPath}`
  const filename = screenshotPath.split('/').pop() ?? screenshotPath

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-background/90 border-b border-border shrink-0">
        <Camera className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Step {stepIndex + 1} — Failure Screenshot</span>
        <span className="text-xs text-muted-foreground font-mono truncate flex-1">{filename}</span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        <img
          src={src}
          alt={`Step ${stepIndex + 1} failure`}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-border/20"
          onError={(e) => {
            const t = e.currentTarget
            t.style.display = 'none'
            t.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className={cn(
          'hidden flex-col items-center gap-2 text-muted-foreground',
        )}>
          <Camera className="w-12 h-12 opacity-20" />
          <p className="text-sm">Screenshot not found</p>
          <p className="text-xs font-mono opacity-60">{screenshotPath}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 bg-background/90 border-t border-border shrink-0">
        <span className="text-xs text-muted-foreground font-mono flex-1 truncate">{screenshotPath}</span>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40 transition-colors"
          onClick={() => window.api.openExternal(`file://${screenshotPath}`)}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Finder
        </button>
      </div>
    </div>
  )
}
