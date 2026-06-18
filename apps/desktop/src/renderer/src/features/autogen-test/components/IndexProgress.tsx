import { Progress } from '@/components/ui/progress'
import type { IndexProgress as IProgress } from '../types'

interface Props {
  progress: IProgress | null
}

export function IndexProgress({ progress }: Props) {
  if (!progress) return null

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground capitalize">{progress.phase}</span>
        <span className="font-mono">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} />
      <p className="text-xs text-muted-foreground">{progress.message}</p>
    </div>
  )
}
