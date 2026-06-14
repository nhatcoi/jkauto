import { useState, useEffect } from 'react'
import { AlertCircle, Terminal, Clipboard, Check, Database, Undo2, Redo2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useProjectStore } from '@/store/project.store'
import { useRequestEditor } from './hooks/useRequestEditor'
import { MethodUrlBar } from './components/MethodUrlBar'
import { KeyValueTable } from './components/KeyValueTable'
import { BodyEditor } from './components/BodyEditor'
import { AuthPanel } from './components/AuthPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { AssertionsPanel } from './components/AssertionsPanel'
import { CurlImportDialog } from './components/CurlImportDialog'
import { ImportDataDialog, type DataImportResult } from './components/ImportDataDialog'
import { toCurl } from './utils/curl'
import type { ApiRequest } from './types'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { useSettingsKeymap } from '@/hooks/useSettingsKeymap'
import { REQUEST_EDITOR_KEYMAPS, KEYMAP_SCOPES } from '@/shared/keymaps'

export function RequestEditor({ filePath }: { filePath: string }) {
  const { markTabDirty, activeProject } = useProjectStore()
  const {
    request,
    error,
    saving,
    sending,
    response,
    assertionResults,
    sendError,
    history,
    mutate,
    save,
    send,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useRequestEditor(filePath)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      if (inEditable) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        markTabDirty(filePath, true)
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        redo()
        markTabDirty(filePath, true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, filePath, markTabDirty])

  const [curlImportOpen, setCurlImportOpen] = useState(false)
  const [importDataOpen, setImportDataOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleImportCurl = (partial: Partial<ApiRequest>) => {
    mutate((r) => ({ ...r, ...partial }))
  }

  const handleImportData = ({ target, rows }: DataImportResult) => {
    const kvItems = rows.map(({ key, value }) => ({ key, value, enabled: true }))
    if (target === 'params') {
      mutate((r) => ({ ...r, params: [...r.params, ...kvItems] }))
    } else if (target === 'headers') {
      mutate((r) => ({ ...r, headers: [...r.headers, ...kvItems] }))
    } else {
      const obj = Object.fromEntries(rows.map(({ key, value }) => [key, value]))
      mutate((r) => ({ ...r, body: { type: 'raw-json', content: JSON.stringify(obj, null, 2) } }))
    }
  }

  const handleCopyCurl = async () => {
    if (!request) return
    let vars: Record<string, string> = {}
    if (activeProject) {
      try {
        const { readEnv: re } = await import('@/features/env/api')
        vars = await re(`${activeProject.path}/profiles/${activeProject.activeProfile}.env.json`)
      } catch { /* ignore */ }
    }
    const curl = toCurl(request, vars)
    await navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const km = useSettingsKeymap(REQUEST_EDITOR_KEYMAPS, KEYMAP_SCOPES.REQUEST_EDITOR, {
    save,
    send,
    importCurl: () => setCurlImportOpen(true),
    copyCurl:   handleCopyCurl,
  })

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading…
      </div>
    )
  }

  const assertionCount = assertionResults.length
  const failCount = assertionResults.filter((r) => !r.passed).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CurlImportDialog
        open={curlImportOpen}
        onClose={() => setCurlImportOpen(false)}
        onImport={handleImportCurl}
      />
      <ImportDataDialog
        open={importDataOpen}
        onClose={() => setImportDataOpen(false)}
        onImport={handleImportData}
      />

      <MethodUrlBar
        method={request.method}
        url={request.url}
        sending={sending}
        saving={saving}
        onMethodChange={(method) => mutate((r) => ({ ...r, method }))}
        onUrlChange={(url) => mutate((r) => ({ ...r, url }))}
        onSend={send}
        onSave={save}
      />

      {/* cURL toolbar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border bg-panel/50 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCurlImportOpen(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-0.5 rounded transition-colors"
            >
              <Terminal className="w-3 h-3" />
              Import cURL
            </button>
          </TooltipTrigger>
          <TooltipContent>Import from cURL<Kbd>{km.importCurl.hint}</Kbd></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopyCurl}
              disabled={!request}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-0.5 rounded transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Clipboard className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy cURL'}
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy as cURL<Kbd>{km.copyCurl.hint}</Kbd></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setImportDataOpen(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-0.5 rounded transition-colors"
            >
              <Database className="w-3 h-3" />
              Import Data
            </button>
          </TooltipTrigger>
          <TooltipContent>Import from data file</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => { undo(); markTabDirty(filePath, true) }}
              className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Undo<Kbd>⌘+Z</Kbd></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => { redo(); markTabDirty(filePath, true) }}
              className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Redo<Kbd>⌘+⇧+Z</Kbd></TooltipContent>
        </Tooltip>
      </div>

      {/* request / response split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* request tabs */}
        <Tabs defaultValue="params" className="flex flex-col" style={{ height: '50%' }}>
          <TabsList className="px-3 shrink-0 w-full justify-start">
            <TabsTrigger value="params">
              Params
              {request.params.filter((p) => p.enabled && p.key).length > 0 && (
                <span className="ml-1 text-[10px] text-primary">
                  ({request.params.filter((p) => p.enabled && p.key).length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="headers">
              Headers
              {request.headers.filter((h) => h.enabled && h.key).length > 0 && (
                <span className="ml-1 text-[10px] text-primary">
                  ({request.headers.filter((h) => h.enabled && h.key).length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="body">
              Body
              {request.body.type !== 'none' && (
                <span className="ml-1 text-[10px] text-yellow-400">●</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="auth">
              Auth
              {request.auth.type !== 'none' && (
                <span className="ml-1 text-[10px] text-yellow-400">●</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="assertions">
              Tests
              {assertionCount > 0 && (
                <span className={`ml-1 text-[10px] ${failCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ({assertionCount - failCount}/{assertionCount})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto border-b border-border">
            <TabsContent value="params" className="h-full p-3">
              <KeyValueTable
                items={request.params}
                onChange={(params) => mutate((r) => ({ ...r, params }))}
                keyPlaceholder="param"
                valuePlaceholder="value"
              />
            </TabsContent>

            <TabsContent value="headers" className="h-full p-3">
              <KeyValueTable
                items={request.headers}
                onChange={(headers) => mutate((r) => ({ ...r, headers }))}
                keyPlaceholder="header"
                valuePlaceholder="value"
              />
            </TabsContent>

            <TabsContent value="body" className="h-full">
              <BodyEditor
                body={request.body}
                onChange={(body) => mutate((r) => ({ ...r, body }))}
              />
            </TabsContent>

            <TabsContent value="auth" className="h-full">
              <AuthPanel
                auth={request.auth}
                onChange={(auth) => mutate((r) => ({ ...r, auth }))}
              />
            </TabsContent>

            <TabsContent value="assertions" className="h-full overflow-auto">
              <AssertionsPanel
                assertions={request.assertions}
                results={assertionResults}
                onChange={(assertions) => mutate((r) => ({ ...r, assertions }))}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* response */}
        <div className="flex flex-col" style={{ height: '50%' }}>
          <div className="px-3 py-1.5 border-b border-border shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ResponsePanel response={response} sendError={sendError} sending={sending} history={history} />
          </div>
        </div>
      </div>
    </div>
  )
}
