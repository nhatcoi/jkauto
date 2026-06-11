import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useProjectStore } from '@/store/project.store'
import { useRequestEditor } from './hooks/useRequestEditor'
import { MethodUrlBar } from './components/MethodUrlBar'
import { KeyValueTable } from './components/KeyValueTable'
import { BodyEditor } from './components/BodyEditor'
import { AuthPanel } from './components/AuthPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { AssertionsPanel } from './components/AssertionsPanel'

export function RequestEditor({ filePath }: { filePath: string }) {
  const { markTabDirty } = useProjectStore()
  const {
    request,
    error,
    saving,
    sending,
    response,
    assertionResults,
    sendError,
    mutate,
    save,
    send,
  } = useRequestEditor(filePath)

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

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
            <ResponsePanel response={response} sendError={sendError} sending={sending} />
          </div>
        </div>
      </div>
    </div>
  )
}
