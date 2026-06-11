import { useEffect, useState } from 'react'
import { X, FileText } from 'lucide-react'
import { useProjectStore } from '@/store/project.store'
import { IpcChannels } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { TestCaseEditor } from '@/features/test-cases/TestCaseEditor'

function isTestCase(path: string) {
  return path.endsWith('.test.json') || path.endsWith('.test.yaml')
}

function FileContent({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    invoke<string>(IpcChannels.FS_READ_FILE, path)
      .then(setContent)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to read file'))
  }, [path])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-xs">{error}</div>
    )
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading...
      </div>
    )
  }

  return (
    <pre className="text-xs text-foreground/80 font-mono leading-5 whitespace-pre-wrap break-words p-4 h-full overflow-auto">
      {content}
    </pre>
  )
}

export function MidPanel() {
  const { openTabs, activeTabPath, setActiveTab, closeTab } = useProjectStore()

  if (openTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileText className="w-10 h-10 opacity-20" />
        <div className="text-sm">Open a file from the Explorer</div>
        <div className="text-xs opacity-60">Double-click any item to open it here</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center h-8 bg-panel border-b border-border overflow-x-auto shrink-0 scrollbar-none">
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            onClick={() => setActiveTab(tab.path)}
            className={cn(
              'flex items-center gap-1.5 h-full px-3 border-r border-border cursor-pointer shrink-0',
              'hover:bg-secondary/40 transition-colors group',
              activeTabPath === tab.path
                ? 'bg-background border-t-2 border-t-primary text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="text-xs whitespace-nowrap max-w-[120px] truncate">
              {tab.isDirty && <span className="text-primary mr-0.5">●</span>}
              {tab.title}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
              className="w-4 h-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTabPath && (
          isTestCase(activeTabPath)
            ? <TestCaseEditor key={activeTabPath} filePath={activeTabPath} />
            : <FileContent path={activeTabPath} />
        )}
      </div>
    </div>
  )
}
