import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAutogenStore } from '../store'

export function TargetSelector() {
  const { targets, selectedTargets, toggleTarget } = useAutogenStore()

  const pages = targets.filter((t) => t.id.startsWith('page:'))
  const endpoints = targets.filter((t) => t.id.startsWith('api:'))

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {pages.length > 0 && (
          <section>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Pages</p>
            <ul className="space-y-1">
              {pages.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={t.id}
                    checked={selectedTargets.includes(t.id)}
                    onCheckedChange={() => toggleTarget(t.id)}
                  />
                  <label htmlFor={t.id} className="text-sm cursor-pointer flex-1">
                    <span className="font-mono">{t.label}</span>
                    {t.description && (
                      <span className="ml-2 text-xs text-muted-foreground">{t.description}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {endpoints.length > 0 && (
          <section>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">API Endpoints</p>
            <ul className="space-y-1">
              {endpoints.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={t.id}
                    checked={selectedTargets.includes(t.id)}
                    onCheckedChange={() => toggleTarget(t.id)}
                  />
                  <label htmlFor={t.id} className="text-sm cursor-pointer flex-1">
                    <Badge variant="outline" className="font-mono text-xs mr-2">
                      {t.id.split(':')[1]}
                    </Badge>
                    <span className="font-mono">{t.label.split(' ').slice(1).join(' ')}</span>
                    {t.description && (
                      <span className="ml-2 text-xs text-muted-foreground">{t.description}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {targets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No targets found</p>
        )}
      </div>
    </ScrollArea>
  )
}
