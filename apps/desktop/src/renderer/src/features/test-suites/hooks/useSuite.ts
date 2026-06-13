import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode, TestCase, TestSuite } from '@jkauto/core'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'

type SuiteItem = TestSuite['items'][number]

export interface TestCaseOption {
  id: string
  name: string
  path: string
}

function isTestCasePath(path: string) {
  return path.endsWith('.test.json') || path.endsWith('.test.yaml') || path.endsWith('.test.yml')
}

function collectTestCasePaths(nodes: FsTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file' && isTestCasePath(node.path)) paths.push(node.path)
    if (node.children) paths.push(...collectTestCasePaths(node.children))
  }
  return paths
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

export function stripTestCaseExtension(path: string) {
  return basename(path).replace(/\.test\.(json|ya?ml)$/i, '')
}

function normalizeSuite(raw: Partial<TestSuite> & { testCaseIds?: string[] }, filePath: string): TestSuite {
  const now = new Date().toISOString()
  const legacyItems =
    raw.testCaseIds?.map((testCaseId, order) => ({
      testCaseId,
      testCasePath: testCaseId,
      enabled: true,
      order,
    })) ?? []

  return {
    schemaVersion: 1,
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? basename(filePath).replace(/\.suite\.(json|ya?ml)$/i, ''),
    description: raw.description ?? '',
    profile: raw.profile ?? 'default',
    continueOnFailure: raw.continueOnFailure ?? false,
    items: (raw.items ?? legacyItems).map((item, index) => ({
      testCaseId: item.testCaseId,
      testCasePath: item.testCasePath,
      enabled: item.enabled ?? true,
      order: item.order ?? index,
    })),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  }
}

async function readTestCaseOption(path: string): Promise<TestCaseOption> {
  try {
    const raw = await invoke<string>(IpcChannels.FS_READ_FILE, path)
    const parsed = (path.endsWith('.yaml') || path.endsWith('.yml') ? yamlParse(raw) : JSON.parse(raw)) as Partial<TestCase>
    return { id: parsed.id ?? path, name: parsed.name ?? stripTestCaseExtension(path), path }
  } catch {
    return { id: path, name: stripTestCaseExtension(path), path }
  }
}

export function useSuite(filePath: string) {
  const { activeProject, markTabDirty } = useProjectStore()
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [testCases, setTestCases] = useState<TestCaseOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const suiteRef = useRef<TestSuite | null>(null)
  suiteRef.current = suite

  const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml')

  const sortedItems = useMemo(
    () => [...(suite?.items ?? [])].sort((a, b) => a.order - b.order),
    [suite],
  )

  const itemNames = useMemo(() => {
    const byId = new Map(testCases.map((tc) => [tc.id, tc]))
    const byPath = new Map(testCases.map((tc) => [tc.path, tc]))
    return new Map(
      sortedItems.map((item) => {
        const match = byId.get(item.testCaseId) ?? byPath.get(item.testCasePath)
        return [item.testCasePath, match?.name ?? stripTestCaseExtension(item.testCasePath)]
      }),
    )
  }, [sortedItems, testCases])

  const loadSuite = useCallback(async () => {
    try {
      setError('')
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath)
      const parsed = normalizeSuite(isYaml ? yamlParse(raw) : JSON.parse(raw), filePath)
      setSuite(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suite')
    }
  }, [filePath, isYaml])

  const loadTestCases = useCallback(async () => {
    if (!activeProject) return
    const tree = await invoke<FsTreeNode[]>(IpcChannels.FS_TREE, activeProject.path)
    const paths = collectTestCasePaths(tree).sort((a, b) => a.localeCompare(b))
    const options = await Promise.all(paths.map(readTestCaseOption))
    setTestCases(options)
  }, [activeProject])

  useEffect(() => { loadSuite() }, [loadSuite])
  useEffect(() => { loadTestCases().catch(() => setTestCases([])) }, [loadTestCases])

  const mutate = useCallback((fn: (prev: TestSuite) => TestSuite) => {
    setSuite((prev) => {
      if (!prev) return prev
      const next = { ...fn(prev), updatedAt: new Date().toISOString() }
      markTabDirty(filePath, true)
      return next
    })
  }, [filePath, markTabDirty])

  const saveSuiteToFile = useCallback(async (current: TestSuite): Promise<TestSuite> => {
    const normalized = {
      ...current,
      items: [...current.items]
        .sort((a, b) => a.order - b.order)
        .map((item, order) => ({ ...item, order })),
      updatedAt: new Date().toISOString(),
    }
    const content = isYaml ? yamlStringify(normalized) : JSON.stringify(normalized, null, 2)
    await invoke(IpcChannels.FS_WRITE_FILE, filePath, content)
    setSuite(normalized)
    markTabDirty(filePath, false)
    return normalized
  }, [filePath, isYaml, markTabDirty])

  const save = useCallback(async () => {
    const current = suiteRef.current
    if (!current) return
    setSaving(true)
    try {
      await saveSuiteToFile(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [saveSuiteToFile])

  const addTestCase = useCallback((option: TestCaseOption): boolean => {
    let added = false
    mutate((prev) => {
      if (prev.items.some((item) => item.testCasePath === option.path || item.testCaseId === option.id))
        return prev
      added = true
      return {
        ...prev,
        items: [
          ...prev.items,
          { testCaseId: option.id, testCasePath: option.path, enabled: true, order: prev.items.length },
        ],
      }
    })
    return added
  }, [mutate])

  const removeItem = useCallback((idx: number) => {
    mutate((prev) => ({
      ...prev,
      items: [...prev.items]
        .sort((a, b) => a.order - b.order)
        .filter((_, i) => i !== idx)
        .map((item, order) => ({ ...item, order })),
    }))
  }, [mutate])

  const updateItem = useCallback((idx: number, patch: Partial<SuiteItem>) => {
    mutate((prev) => ({
      ...prev,
      items: [...prev.items]
        .sort((a, b) => a.order - b.order)
        .map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }))
  }, [mutate])

  const moveItem = useCallback((idx: number, direction: -1 | 1): boolean => {
    let moved = false
    mutate((prev) => {
      const sorted = [...prev.items].sort((a, b) => a.order - b.order)
      const target = idx + direction
      if (target < 0 || target >= sorted.length) return prev
      moved = true
      ;[sorted[idx], sorted[target]] = [sorted[target], sorted[idx]]
      return { ...prev, items: sorted.map((item, order) => ({ ...item, order })) }
    })
    return moved
  }, [mutate])

  return {
    suite, testCases, sortedItems, itemNames, saving, error,
    suiteRef, activeProject,
    mutate, save, saveSuiteToFile,
    addTestCase, removeItem, updateItem, moveItem,
  }
}
