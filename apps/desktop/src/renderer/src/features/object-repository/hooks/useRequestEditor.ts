import { useState, useCallback, useRef, useEffect } from 'react'
import { useProjectStore } from '@/store/project.store'
import { loadRequest, saveRequest, sendRequest, getRequestHistory, saveRequestHistory } from '../api'
import { readEnv } from '@/features/env/api'
import type { ApiRequest, HttpResponse, AssertionResult } from '../types'
import type { RequestHistoryRecord } from '@jkauto/core'

function evaluateAssertions(request: ApiRequest, resp: HttpResponse): AssertionResult[] {
  return request.assertions.map((a) => {
    try {
      let actual: string

      if (a.target === 'status') {
        actual = String(resp.status)
      } else if (a.target === 'response-time') {
        actual = String(resp.durationMs)
      } else if (a.target === 'header') {
        const headerName = (a.path ?? '').toLowerCase()
        actual = resp.headers[headerName] ?? ''
      } else if (a.target === 'body-json-path') {
        try {
          const parsed = JSON.parse(resp.body)
          const parts = (a.path ?? '').replace(/^\$\.?/, '').split('.')
          let val: unknown = parsed
          for (const part of parts) {
            if (val == null || typeof val !== 'object') { val = undefined; break }
            val = (val as Record<string, unknown>)[part]
          }
          actual = val === undefined ? '' : String(val)
        } catch {
          actual = ''
        }
      } else {
        actual = ''
      }

      const { op, expected } = a
      let passed = false

      if (op === 'exists') passed = actual !== '' && actual !== undefined
      else if (op === 'not-exists') passed = actual === '' || actual === undefined
      else if (op === 'eq') passed = actual === expected
      else if (op === 'ne') passed = actual !== expected
      else if (op === 'contains') passed = actual.includes(expected)
      else if (op === 'not-contains') passed = !actual.includes(expected)
      else if (op === 'lt') passed = parseFloat(actual) < parseFloat(expected)
      else if (op === 'gt') passed = parseFloat(actual) > parseFloat(expected)

      return { id: a.id, passed, message: passed ? 'Pass' : `Expected ${op} "${expected}", got "${actual}"` }
    } catch {
      return { id: a.id, passed: false, message: 'Evaluation error' }
    }
  })
}

export function useRequestEditor(filePath: string) {
  const { markTabDirty } = useProjectStore()
  const [request, setRequest] = useState<ApiRequest | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [assertionResults, setAssertionResults] = useState<AssertionResult[]>([])
  const [sendError, setSendError] = useState('')
  const [history, setHistory] = useState<RequestHistoryRecord[]>([])

  const requestRef = useRef<ApiRequest | null>(null)
  requestRef.current = request

  useEffect(() => {
    setRequest(null)
    setError('')
    setResponse(null)
    setAssertionResults([])
    setSendError('')
    setHistory([])
    loadRequest(filePath)
      .then(setRequest)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
    getRequestHistory(filePath)
      .then(setHistory)
      .catch(() => {})
  }, [filePath])

  const mutate = useCallback(
    (fn: (prev: ApiRequest) => ApiRequest) => {
      setRequest((prev) => {
        if (!prev) return prev
        const next = fn(prev)
        markTabDirty(filePath, true)
        return next
      })
    },
    [filePath, markTabDirty],
  )

  const save = useCallback(async () => {
    const req = requestRef.current
    if (!req) return
    setSaving(true)
    try {
      await saveRequest(filePath, req)
      markTabDirty(filePath, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, markTabDirty])

  const send = useCallback(async () => {
    const req = requestRef.current
    if (!req || sending) return
    setSending(true)
    setSendError('')
    setResponse(null)
    setAssertionResults([])
    try {
      let profileVariables: Record<string, string> = {}
      const { activeProject } = useProjectStore.getState()
      if (activeProject) {
        const profilePath = `${activeProject.path}/profiles/${activeProject.activeProfile}.env.json`
        try {
          profileVariables = await readEnv(profilePath)
        } catch { /* profile missing — ignore */ }
      }
      const resp = await sendRequest(req, profileVariables)
      setResponse(resp)
      setAssertionResults(evaluateAssertions(req, resp))
      const record: RequestHistoryRecord = {
        id: crypto.randomUUID(),
        requestedAt: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: resp.status,
        statusText: resp.statusText,
        durationMs: resp.durationMs,
        size: resp.size,
        headers: resp.headers,
        body: resp.body,
      }
      setHistory((prev) => [record, ...prev].slice(0, 30))
      saveRequestHistory(filePath, record).catch(() => {})
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSending(false)
    }
  }, [sending])

  return {
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
  }
}
