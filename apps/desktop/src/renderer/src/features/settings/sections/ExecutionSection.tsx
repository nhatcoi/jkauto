import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AppSettings } from '@jkauto/core'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings['execution']>) => void
}

export function ExecutionSection({ settings, onChange }: Props) {
  const { execution } = settings
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Execution</h3>
        <p className="text-xs text-muted-foreground">
          Defaults applied to every test run.
        </p>
      </div>

      <div className="space-y-4">
        {/* Headless */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Headless browser</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Run without visible browser window
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={execution.headless}
            onClick={() => onChange({ headless: !execution.headless })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
              ${execution.headless ? 'bg-primary' : 'bg-secondary'}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform
                ${execution.headless ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Browser */}
        <div className="space-y-1.5">
          <Label>Default browser</Label>
          <Select
            value={execution.browser}
            onValueChange={(v) =>
              onChange({ browser: v as AppSettings['execution']['browser'] })
            }
          >
            <SelectTrigger className="w-40 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chromium">Chromium</SelectItem>
              <SelectItem value="firefox">Firefox</SelectItem>
              <SelectItem value="webkit">WebKit (Safari)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground/70">
            Firefox and WebKit support coming in a future update.
          </p>
        </div>

        {/* Browsers path */}
        <div className="space-y-1.5">
          <Label htmlFor="exec-browsers-path">Playwright browsers path</Label>
          <Input
            id="exec-browsers-path"
            type="text"
            spellCheck={false}
            placeholder="Default (~/Library/Caches/ms-playwright)"
            value={execution.browsersPath}
            onChange={(e) => onChange({ browsersPath: e.target.value })}
            className="w-full text-xs h-8 font-mono"
          />
          <p className="text-[11px] text-muted-foreground/70">
            Custom install dir (PLAYWRIGHT_BROWSERS_PATH). Set this if browsers live
            outside the default cache — e.g. an external drive. Leave empty to use the default.
          </p>
        </div>

        {/* Default timeout */}
        <div className="space-y-1.5">
          <Label htmlFor="exec-timeout">Default step timeout (ms)</Label>
          <Input
            id="exec-timeout"
            type="number"
            min={0}
            step={1000}
            value={execution.defaultTimeoutMs}
            onChange={(e) =>
              onChange({ defaultTimeoutMs: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-32 text-xs h-8"
          />
          <p className="text-[11px] text-muted-foreground/70">
            Per-step timeout override takes precedence.
          </p>
        </div>

        {/* Step delay */}
        <div className="space-y-1.5">
          <Label htmlFor="exec-step-delay">Step delay (ms)</Label>
          <Input
            id="exec-step-delay"
            type="number"
            min={0}
            step={100}
            value={execution.stepDelayMs}
            onChange={(e) =>
              onChange({ stepDelayMs: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="w-32 text-xs h-8"
          />
          <p className="text-[11px] text-muted-foreground/70">
            Pause between steps. Per-test-case override takes precedence.
          </p>
        </div>

        {/* Screenshot on fail */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Screenshot on failure</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture screenshot when a step fails
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={execution.screenshotOnFail}
            onClick={() => onChange({ screenshotOnFail: !execution.screenshotOnFail })}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
              ${execution.screenshotOnFail ? 'bg-primary' : 'bg-secondary'}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform
                ${execution.screenshotOnFail ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
