import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { AgentSessionMode, AppSettings } from '@jkauto/core'
import { cn } from '@/lib/utils'

type FileWriteMode = AppSettings['agent']['editMode']

interface ChatInputProps {
  value: string
  disabled?: boolean
  mode: AgentSessionMode
  writeMode: FileWriteMode
  onChange: (value: string) => void
  onSubmit: () => void
  onModeChange: (mode: AgentSessionMode) => void
  onWriteModeChange: (mode: FileWriteMode) => void
}

const MODE_OPTIONS: Array<{
  value: AgentSessionMode
  label: string
  description: string
  icon: typeof Sparkles
}> = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Chat, inspect, use tools, and edit normally.',
    icon: Sparkles,
  },
  {
    value: 'directly',
    label: 'Directly',
    description: 'Run Chromium, verify the flow, and generate the test.',
    icon: Zap,
  },
]

const WRITE_OPTIONS: Array<{
  value: FileWriteMode
  label: string
  description: string
}> = [
  {
    value: 'ask',
    label: 'Suggest',
    description: 'Do not expose filesystem write tools.',
  },
  {
    value: 'auto',
    label: 'Write files',
    description: 'Allow direct filesystem changes.',
  },
  {
    value: 'auto-with-rollback',
    label: 'Write + backup',
    description: 'Back up existing files before changes.',
  },
]

export function ChatInput({
  value,
  disabled,
  mode,
  writeMode,
  onChange,
  onSubmit,
  onModeChange,
  onWriteModeChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [openMenu, setOpenMenu] = useState<'mode' | 'write' | null>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-background via-background to-background/80 px-3 pb-3 pt-2">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-input/95 shadow-lg shadow-black/10 transition-all focus-within:border-primary/50 focus-within:shadow-primary/5">
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          rows={1}
          className="block min-h-[3.5rem] max-h-[33vh] w-full resize-none overflow-y-auto bg-transparent px-4 pt-3.5 pb-2 text-xs leading-5 outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
          placeholder={
            mode === 'directly'
              ? 'Describe the browser flow to execute, verify, and save as a test…'
              : 'Ask about the project, test, selector, failure, or workflow…'
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          <div className="flex min-w-0 items-center gap-1">
            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  setOpenMenu((current) => (current === 'mode' ? null : 'mode'))
                }
                className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium text-foreground/80 hover:bg-secondary disabled:opacity-50"
              >
                {mode === 'directly' ? (
                  <Zap className="h-3 w-3 text-amber-400" />
                ) : (
                  <Sparkles className="h-3 w-3 text-violet-400" />
                )}
                {mode === 'directly' ? 'Directly' : 'Normal'}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {openMenu === 'mode' && (
                <OptionMenu onClose={() => setOpenMenu(null)}>
                  {MODE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <Option
                        key={option.value}
                        selected={mode === option.value}
                        label={option.label}
                        description={option.description}
                        icon={<Icon className="h-3.5 w-3.5" />}
                        onClick={() => {
                          onModeChange(option.value)
                          setOpenMenu(null)
                        }}
                      />
                    )
                  })}
                </OptionMenu>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  setOpenMenu((current) =>
                    current === 'write' ? null : 'write',
                  )
                }
                className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <ShieldCheck className="h-3 w-3" />
                {
                  WRITE_OPTIONS.find((option) => option.value === writeMode)
                    ?.label
                }
                <ChevronDown className="h-3 w-3" />
              </button>
              {openMenu === 'write' && (
                <OptionMenu onClose={() => setOpenMenu(null)}>
                  {WRITE_OPTIONS.map((option) => (
                    <Option
                      key={option.value}
                      selected={writeMode === option.value}
                      label={option.label}
                      description={
                        mode === 'directly' && option.value === 'ask'
                          ? 'Unavailable in Directly mode because the final test must be saved.'
                          : option.description
                      }
                      disabled={mode === 'directly' && option.value === 'ask'}
                      onClick={() => {
                        onWriteModeChange(option.value)
                        setOpenMenu(null)
                      }}
                    />
                  ))}
                </OptionMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-[9px] text-muted-foreground/50 min-[430px]:inline">
              Enter to send · Shift+Enter for new line
            </span>
            <button
              type="button"
              disabled={disabled || value.trim().length === 0}
              onClick={onSubmit}
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center transition-all shrink-0',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-60 disabled:pointer-events-none',
              )}
              title="Send message"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OptionMenu({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute bottom-9 left-0 z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
        {children}
      </div>
    </>
  )
}

function Option({
  selected,
  label,
  description,
  icon,
  disabled,
  onClick,
}: {
  selected: boolean
  label: string
  description: string
  icon?: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-secondary disabled:pointer-events-none disabled:opacity-45"
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[10px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
      {selected && (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      )}
    </button>
  )
}
