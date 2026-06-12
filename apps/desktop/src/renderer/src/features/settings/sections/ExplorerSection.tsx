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
  onChange: (patch: Partial<AppSettings['explorer']>) => void
}

const KNOWN_FEATURES = [
  'test-cases',
  'test-suites',
  'object-repository',
  'profiles',
] as const

const FILE_DISPLAY_OPTIONS: {
  value: AppSettings['explorer']['fileDisplayName']
  label: string
}[] = [
  { value: 'metadataName', label: 'Metadata name' },
  { value: 'fileName', label: 'File name' },
]

const OPENAPI_NAME_OPTIONS: {
  value: AppSettings['explorer']['openApiImportNameSource']
  label: string
}[] = [
  { value: 'summary', label: 'OpenAPI summary' },
  { value: 'operationId', label: 'OpenAPI operationId' },
  { value: 'methodPath', label: 'Method + path' },
]

function parseOrder(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function ExplorerSection({ settings, onChange }: Props) {
  const { explorer } = settings

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-0.5">Explorer</h3>
        <p className="text-xs text-muted-foreground">Folder aliases, feature order, and file labels.</p>
      </div>

      <div className="space-y-2">
        <Label>Feature order</Label>
        <Input
          value={explorer.featureOrder.join(', ')}
          onChange={(e) => onChange({ featureOrder: parseOrder(e.target.value) })}
          className="font-mono text-xs"
        />
        <p className="text-[10px] text-muted-foreground">
          Top-level folders are sorted by this comma-separated list. Unknown folders appear after these.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Feature aliases</Label>
        <div className="grid grid-cols-[140px_1fr] gap-2">
          {KNOWN_FEATURES.map((feature) => (
            <div key={feature} className="contents">
              <div className="flex items-center text-xs font-mono text-muted-foreground">
                {feature}
              </div>
              <Input
                value={explorer.featureAliases[feature] ?? ''}
                onChange={(e) => onChange({
                  featureAliases: {
                    ...explorer.featureAliases,
                    [feature]: e.target.value,
                  },
                })}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>File item label</Label>
          <Select
            value={explorer.fileDisplayName}
            onValueChange={(value) => onChange({
              fileDisplayName: value as AppSettings['explorer']['fileDisplayName'],
            })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILE_DISPLAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>OpenAPI import names</Label>
          <Select
            value={explorer.openApiImportNameSource}
            onValueChange={(value) => onChange({
              openApiImportNameSource: value as AppSettings['explorer']['openApiImportNameSource'],
            })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPENAPI_NAME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
