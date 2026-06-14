import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { useZoom } from '@/hooks/useZoom'
import type { AppSettings } from '@jkauto/core'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings['appearance']>) => void
}

const THEMES: { value: AppSettings['appearance']['theme']; label: string; preview: string }[] = [
  { value: 'dark',   label: 'Dark',   preview: 'bg-[hsl(222,18%,12%)] border-[hsl(217,18%,20%)]' },
  { value: 'light',  label: 'Light',  preview: 'bg-[hsl(0,0%,97%)] border-[hsl(214,16%,82%)]' },
  { value: 'system', label: 'System', preview: 'bg-gradient-to-r from-[hsl(222,18%,12%)] to-[hsl(0,0%,97%)] border-border' },
]

const DENSITIES: { value: AppSettings['appearance']['tableDensity']; label: string; desc: string }[] = [
  { value: 'compact',  label: 'Compact',  desc: '28px rows' },
  { value: 'normal',   label: 'Normal',   desc: '34px rows' },
  { value: 'relaxed',  label: 'Relaxed',  desc: '40px rows' },
]

export function AppearanceSection({ settings, onChange }: Props) {
  const { appearance } = settings
  const { zoomPercent, zoomIn, zoomOut, reset, canZoomIn, canZoomOut } = useZoom()

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Appearance</h3>
        <p className="text-xs text-muted-foreground">Visual preferences.</p>
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <Label>Theme</Label>
        <div className="flex gap-3">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ theme: t.value })}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg p-2 border-2 transition-colors w-20',
                appearance.theme === t.value
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <div className={cn('w-full h-10 rounded border', t.preview)} />
              <span className="text-[11px] text-foreground/80">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Zoom */}
      <div className="space-y-2">
        <Label>Zoom</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-secondary disabled:opacity-30 transition-colors text-sm"
            title="Zoom out (⌘-)"
          >
            −
          </button>
          <span className="w-12 text-center text-sm tabular-nums font-medium">{zoomPercent}%</span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded border border-border hover:bg-secondary disabled:opacity-30 transition-colors text-sm"
            title="Zoom in (⌘=)"
          >
            +
          </button>
          {zoomPercent !== 100 && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table density */}
      <div className="space-y-2">
        <Label>Table density</Label>
        <div className="flex gap-2">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onChange({ tableDensity: d.value })}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md px-3 py-2 border transition-colors',
                appearance.tableDensity === d.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground/40 text-muted-foreground',
              )}
            >
              <span className="text-xs font-medium">{d.label}</span>
              <span className="text-[10px] opacity-70">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
