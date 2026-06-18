import { useEffect, useRef } from 'react'
import { SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function ChatInput({ value, disabled, onChange, onSubmit }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div className="border-t border-border p-2 bg-panel/50 shrink-0">
      <div className="flex items-end gap-2 rounded-md border border-border bg-input p-2 focus-within:border-primary/70">
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          rows={1}
          className="min-h-[1.5rem] max-h-[33vh] flex-1 resize-none overflow-y-auto bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-60"
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
            'h-8 w-8 rounded-md flex items-center justify-center transition-colors shrink-0',
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
