import { cn } from '@/lib/utils'

interface KbdProps {
  children: React.ReactNode
  className?: string
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'ml-1.5 inline-flex items-center rounded border border-border/60 bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
