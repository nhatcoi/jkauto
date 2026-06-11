import { SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function ChatInput({ value, disabled, onChange, onSubmit }: ChatInputProps) {
  return (
    <div className="border-t border-border p-2 shrink-0 bg-panel/50">
      <div className="flex items-end gap-2 rounded-md border border-border bg-input p-2 focus-within:border-primary/70">
        <textarea
          value={value}
          disabled={disabled}
          rows={2}
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-60"
          placeholder="Ask about the current test, run error, selector, or app workflow..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSubmit()
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || value.trim().length === 0}
          onClick={onSubmit}
          className={cn(
            'h-8 w-8 rounded-md flex items-center justify-center transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          title="Send message"
        >
          <SendHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
