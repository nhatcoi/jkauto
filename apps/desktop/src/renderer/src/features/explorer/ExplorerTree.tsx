import { useCallback, useEffect, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeRendererProps, NodeApi, TreeApi } from 'react-arborist'
import { stringify as yamlStringify } from 'yaml'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileJson,
  Database,
  Code2,
  Globe,
  FlaskConical,
  ListChecks,
  TestTube2,
  Layers,
  Box,
  Activity,
  CircleUserRound,
  Milestone,
  FileSpreadsheet,
  Braces,
  Puzzle,
  BarChart2,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { EXPLORER_KEYMAPS, matchesBinding, REPORTS_TAB_PATH, KEYWORDS_TAB_PATH } from '@/shared/keymaps'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { useAppSettingsStore } from '@/store/app-settings.store'
import { cn } from '@/lib/utils'
import { useExplorerTree } from './useExplorerTree'
import { NewItemDialog } from './NewItemDialog'
import { ImportOpenApiDialog } from '../api-request/ImportOpenApiDialog'
import { randomUUID } from './utils'

type NewItemType = 'folder' | 'test-case' | 'suite' | 'keyword' | 'api-request'

interface NewItemState {
  dir: string
  type: NewItemType
}

// ── path helpers ──────────────────────────────────────────────────────────────
const sep = '/'
function pathJoin(...parts: string[]): string {
  return parts.join(sep).replace(/\/+/g, '/')
}
function pathDirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(0, i) || '/' : '.'
}
function pathBasename(p: string): string {
  return p.split('/').pop() ?? p
}

function toExplorerKey(value: string, fallback = 'item'): string {
  const key = value
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return key || fallback
}

const KNOWN_SUFFIXES = [
  '.test.yaml', '.test.yml',
  '.suite.yaml',
  '.objects.json', '.objects.yaml',
  '.keywords.json', '.keywords.yaml',
  '.request.json', '.request.yaml',
  '.env.json', '.env.yaml',
]

function getFileSuffix(filename: string): string {
  const lower = filename.toLowerCase()
  for (const suffix of KNOWN_SUFFIXES) {
    if (lower.endsWith(suffix)) return suffix
  }
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i) : ''
}

function stripKnownExtension(name: string, type: NewItemType): string {
  if (type === 'test-case') return name.replace(/\.test\.(json|ya?ml)$/i, '')
  if (type === 'suite') return name.replace(/\.suite\.(json|ya?ml)$/i, '')
  if (type === 'api-request') return name.replace(/\.request\.(json|ya?ml)$/i, '')
  if (type === 'keyword') return name.replace(/\.keywords\.json$/i, '')
  return name
}

function getFileIcon(node: FsTreeNode): React.ElementType {
  const name = node.name.toLowerCase()
  if (name.endsWith('.test.json') || name.endsWith('.test.yaml') || name.endsWith('.test.yml')) return FlaskConical
  if (name.endsWith('.suite.yaml')) return ListChecks
  if (name.endsWith('.objects.json') || name.endsWith('.objects.yaml')) return Database
  if (name.endsWith('.keywords.json') || name.endsWith('.keywords.yaml')) return Code2
  if (name.endsWith('.request.json')) return Globe
  if (node.ext === '.json') return FileJson
  return FileText
}

const FEATURE_FOLDER_ICONS: Record<string, React.ElementType> = {
  'test-cases': TestTube2,
  'test-suites': Layers,
  'api-request': Box,
  'api-requests': Activity,
  'profiles': CircleUserRound,
  'checkpoints': Milestone,
  'data-files': FileSpreadsheet,
  'keywords': Braces,
  'plugins': Puzzle,
  'reports': BarChart2,
}

function getTopLevelFolderIcon(id: string): React.ElementType | null {
  return FEATURE_FOLDER_ICONS[id] ?? null
}

function findNodeById(nodes: FsTreeNode[], id: string): FsTreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNodeById(n.children, id)
      if (found) return found
    }
  }
}

function isTopLevel(id: string): boolean {
  return !id.includes('/')
}

function featureOf(id: string): string {
  return id.split('/')[0]
}

function isSameFeature(srcId: string, destId: string): boolean {
  return featureOf(srcId) === featureOf(destId)
}

function canDrop(args: {
  parentNode: NodeApi<FsTreeNode> | null
  dragNodes: NodeApi<FsTreeNode>[]
}): boolean {
  const { parentNode, dragNodes } = args
  if (!parentNode) return false
  for (const n of dragNodes) {
    if (isTopLevel(n.id)) return false
    if (!isSameFeature(n.id, parentNode.id)) return false
  }
  return true
}

// ── per-feature context menu ──────────────────────────────────────────────────

interface MenuCallbacks {
  onNewItem: (state: NewItemState) => void
  onDelete: () => void
  onCopy: () => void
  onOpenFolder: () => void
  onEdit: () => void
  onImportOpenApi: (dir: string) => void
}

function ObjectRepoMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const isFolder = node.isInternal
  const isRoot = isTopLevel(node.id)

  return (
    <>
      {isFolder && (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="text-xs">New</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'folder' })}>
                Folder
              </ContextMenuItem>
              <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'api-request' })}>
                Web Service Request
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {isRoot && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="text-xs">Import</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem className="text-xs" onSelect={() => cb.onImportOpenApi(node.data.path)}>
                  From OpenAPI
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuSeparator />
        </>
      )}

      {!isRoot && (
        <>
          <ContextMenuItem className="text-xs" onSelect={cb.onEdit}>
            Rename<ContextMenuShortcut>{EXPLORER_KEYMAPS.rename.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          {!isFolder && (
            <ContextMenuItem className="text-xs" onSelect={cb.onCopy}>Copy</ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onSelect={cb.onDelete}
          >
            Delete<ContextMenuShortcut>{EXPLORER_KEYMAPS.delete.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}

      <ContextMenuItem className="text-xs" onSelect={cb.onOpenFolder}>Open Containing Folder</ContextMenuItem>
    </>
  )
}

function TestCasesMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const isFolder = node.isInternal
  const isRoot = isTopLevel(node.id)

  return (
    <>
      {isFolder && (
        <>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'test-case' })}>
            New Test Case<ContextMenuShortcut>{EXPLORER_KEYMAPS.newItem.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'folder' })}>
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {!isRoot && (
        <>
          <ContextMenuItem className="text-xs" onSelect={cb.onEdit}>
            Rename<ContextMenuShortcut>{EXPLORER_KEYMAPS.rename.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          {!isFolder && (
            <ContextMenuItem className="text-xs" onSelect={cb.onCopy}>Copy</ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onSelect={cb.onDelete}
          >
            Delete<ContextMenuShortcut>{EXPLORER_KEYMAPS.delete.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem className="text-xs" onSelect={cb.onOpenFolder}>Open Containing Folder</ContextMenuItem>
    </>
  )
}

function TestSuitesMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const isFolder = node.isInternal
  const isRoot = isTopLevel(node.id)

  return (
    <>
      {isFolder && (
        <>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'suite' })}>
            New Test Suite<ContextMenuShortcut>{EXPLORER_KEYMAPS.newItem.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'folder' })}>
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {!isRoot && (
        <>
          <ContextMenuItem className="text-xs" onSelect={cb.onEdit}>
            Rename<ContextMenuShortcut>{EXPLORER_KEYMAPS.rename.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          {!isFolder && (
            <ContextMenuItem className="text-xs" onSelect={cb.onCopy}>Copy</ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onSelect={cb.onDelete}
          >
            Delete<ContextMenuShortcut>{EXPLORER_KEYMAPS.delete.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem className="text-xs" onSelect={cb.onOpenFolder}>Open Containing Folder</ContextMenuItem>
    </>
  )
}

function GenericMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const isFolder = node.isInternal
  const isRoot = isTopLevel(node.id)

  return (
    <>
      {!isRoot && (
        <>
          <ContextMenuItem className="text-xs" onSelect={cb.onEdit}>
            Rename<ContextMenuShortcut>{EXPLORER_KEYMAPS.rename.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          {!isFolder && (
            <ContextMenuItem className="text-xs" onSelect={cb.onCopy}>Copy</ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onSelect={cb.onDelete}
          >
            Delete<ContextMenuShortcut>{EXPLORER_KEYMAPS.delete.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem className="text-xs" onSelect={cb.onOpenFolder}>Open Containing Folder</ContextMenuItem>
    </>
  )
}

function KeywordsMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const isFolder = node.isInternal
  const isRoot = isTopLevel(node.id)

  return (
    <>
      {isFolder && (
        <>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'keyword' })}>
            New Keyword<ContextMenuShortcut>{EXPLORER_KEYMAPS.newItem.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem className="text-xs" onSelect={() => cb.onNewItem({ dir: node.data.path, type: 'folder' })}>
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {!isRoot && (
        <>
          <ContextMenuItem className="text-xs" onSelect={cb.onEdit}>
            Rename<ContextMenuShortcut>{EXPLORER_KEYMAPS.rename.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          {!isFolder && (
            <ContextMenuItem className="text-xs" onSelect={cb.onCopy}>Copy</ContextMenuItem>
          )}
          <ContextMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onSelect={cb.onDelete}
          >
            Delete<ContextMenuShortcut>{EXPLORER_KEYMAPS.delete.hint}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem className="text-xs" onSelect={cb.onOpenFolder}>Open Containing Folder</ContextMenuItem>
    </>
  )
}

function FeatureContextMenu({
  node,
  cb,
}: {
  node: NodeApi<FsTreeNode>
  cb: MenuCallbacks
}) {
  const feature = featureOf(node.id)
  if (feature === 'api-requests') return <ObjectRepoMenu node={node} cb={cb} />
  if (feature === 'test-cases') return <TestCasesMenu node={node} cb={cb} />
  if (feature === 'test-suites') return <TestSuitesMenu node={node} cb={cb} />
  if (feature === 'keywords') return <KeywordsMenu node={node} cb={cb} />
  return <GenericMenu node={node} cb={cb} />
}

// ── NodeRow ───────────────────────────────────────────────────────────────────

function NodeRow({
  node,
  style,
  dragHandle,
  onNewItem,
  onImportOpenApi,
  projectPath,
}: NodeRendererProps<FsTreeNode> & {
  onNewItem: (state: NewItemState) => void
  onImportOpenApi: (dir: string) => void
  projectPath: string
}) {
  const { openTab, closeTab, closeTabsUnderPath } = useProjectStore()

  const handleActivate = () => {
    if (node.isInternal) {
      node.toggle()
      if (node.id === 'reports') {
        openTab(REPORTS_TAB_PATH, 'Reports', projectPath)
      }
      if (node.id === 'keywords') {
        openTab(KEYWORDS_TAB_PATH, 'Keywords', projectPath)
      }
    } else {
      openTab(node.data.path, node.data.displayName ?? node.data.name, projectPath)
    }
  }

  const cb: MenuCallbacks = {
    onNewItem,
    onImportOpenApi,
    onDelete: async () => {
      const label = isFolder ? 'folder and all its contents' : `"${node.data.name}"`
      if (!confirm(`Delete ${label}? This cannot be undone.`)) return
      if (isFolder) {
        closeTabsUnderPath(node.data.path)
      } else {
        closeTab(node.data.path)
      }
      await invoke(IpcChannels.FS_DELETE, node.data.path)
    },
    onCopy: async () => {
      const parent = pathDirname(node.data.path)
      const base = pathBasename(node.data.name)
      const dotIdx = base.lastIndexOf('.')
      const name = dotIdx > 0 ? base.slice(0, dotIdx) : base
      const ext = dotIdx > 0 ? base.slice(dotIdx) : ''
      await invoke(IpcChannels.FS_COPY, node.data.path, pathJoin(parent, `${name}-copy${ext}`))
    },
    onOpenFolder: async () => { await invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, node.data.path) },
    // Defer until the context menu unmounts, otherwise Radix's focus
    // restore steals focus from the rename input and blur-submits it.
    onEdit: () => { setTimeout(() => node.edit(), 0) },
  }

  const isFolder = node.isInternal
  const FolderIcon = node.isOpen ? FolderOpen : Folder
  const FileIcon = getFileIcon(node.data)
  const TopLevelIcon = isFolder && isTopLevel(node.id) ? getTopLevelFolderIcon(node.id) : null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={dragHandle}
          style={style}
          className={cn(
            'flex items-center gap-1 h-full px-1 cursor-pointer select-none',
            'hover:bg-secondary/50 rounded-sm',
            node.isSelected && 'bg-secondary/80 hover:bg-secondary/80',
          )}
          onClick={handleActivate}
        >
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
            {isFolder &&
              (node.isOpen ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              ))}
          </span>

          {isFolder ? (
            TopLevelIcon
              ? <TopLevelIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              : <FolderIcon className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
          ) : (
            <FileIcon className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
          )}

          {node.isEditing ? (
            <input
              autoFocus
              defaultValue={node.data.displayName ?? node.data.name}
              className="flex-1 bg-input text-foreground text-xs px-1 rounded outline-none border border-primary min-w-0"
              onBlur={(e) => node.submit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') node.submit((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') node.reset()
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-xs truncate text-foreground/85 flex-1 min-w-0">
              {node.data.displayName ?? node.data.name}
            </span>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <FeatureContextMenu node={node} cb={cb} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── ExplorerTree ──────────────────────────────────────────────────────────────

interface ExplorerTreeProps {
  projectPath: string
}

const ROW_H = 24

export function ExplorerTree({ projectPath }: ExplorerTreeProps) {
  const { tree, reload } = useExplorerTree(projectPath)
  const explorerSettings = useAppSettingsStore((state) => state.settings?.explorer)
  const { renameTab, renameTabsUnderPath, closeTab, closeTabsUnderPath } = useProjectStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<TreeApi<FsTreeNode> | null>(null)
  const [width, setWidth] = useState(0)
  const [treeHeight, setTreeHeight] = useState(ROW_H)
  const [newItemState, setNewItemState] = useState<NewItemState | null>(null)
  const [importOpenApiDir, setImportOpenApiDir] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Height must track the tree's own open state — a local mirror via onToggle
  // desyncs on programmatic toggles and data reloads, clipping the tree.
  const syncHeight = useCallback(() => {
    requestAnimationFrame(() => {
      const count = treeRef.current?.visibleNodes.length ?? 0
      setTreeHeight(Math.max(count * ROW_H, ROW_H))
    })
  }, [])

  useEffect(() => { syncHeight() }, [tree, syncHeight])

  useEffect(() => {
    if (explorerSettings) reload()
  }, [explorerSettings, reload])

  useEffect(() => {
    const handler = () => reload()
    window.addEventListener('jkauto:refresh-explorer', handler)
    return () => window.removeEventListener('jkauto:refresh-explorer', handler)
  }, [reload])

  const handleRename = useCallback(
    async ({ id, name: displayName }: { id: string; name: string }) => {
      const node = findNodeById(tree, id)
      if (!node) return
      const isDir = node.type === 'directory'
      const physicalName = isDir
        ? toExplorerKey(displayName, node.name)
        : toExplorerKey(displayName, 'item') + getFileSuffix(node.name)
      if (physicalName === node.name) return
      const dir = pathDirname(node.path)
      const newPath = pathJoin(dir, physicalName)
      await invoke(IpcChannels.FS_RENAME_DISPLAY, node.path, newPath, displayName, isDir)
      if (isDir) {
        renameTabsUnderPath(node.path, newPath)
      } else {
        renameTab(node.path, newPath)
      }
    },
    [tree, renameTab, renameTabsUnderPath],
  )

  const handleMove = useCallback(
    async ({
      dragNodes,
      parentNode,
    }: {
      dragIds: string[]
      dragNodes: NodeApi<FsTreeNode>[]
      parentId: string | null
      parentNode: NodeApi<FsTreeNode> | null
      index: number
    }) => {
      if (!canDrop({ parentNode, dragNodes })) return
      for (const dragNode of dragNodes) {
        const newPath = pathJoin(parentNode!.data.path, dragNode.data.name)
        if (dragNode.data.path === newPath) continue
        await invoke(IpcChannels.FS_RENAME, dragNode.data.path, newPath)
      }
    },
    [],
  )

  const handleCreateItem = async (name: string, platform?: string) => {
    if (!newItemState) return
    const { dir, type } = newItemState
    const displayName = stripKnownExtension(name, type)
    const key = toExplorerKey(displayName)

    if (type === 'folder') {
      await invoke(IpcChannels.FS_CREATE_DIR, pathJoin(dir, key), displayName)
    } else if (type === 'test-case') {
      const fileName = `${key}.test.yaml`
      const now = new Date().toISOString()
      const resolvedPlatform = platform ?? 'web'
      const runner =
        resolvedPlatform === 'mobile' ? 'maestro'
        : resolvedPlatform === 'api' ? 'api'
        : 'playwright'
      const content = yamlStringify({
        schemaVersion: 1,
        id: randomUUID(),
        name: displayName,
        description: '',
        owner: '',
        tags: [],
        ...(platform ? { platform } : {}),
        runner,
        app: {
          id: '',
          env: '',
          path: '',
        },
        config: {
          timeoutMs: null,
          retry: 0,
          stepDelayMs: null,
        },
        variables: {},
        steps: [],
        createdAt: now,
        updatedAt: now,
      })
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    } else if (type === 'suite') {
      const fileName = `${key}.suite.yaml`
      const now = new Date().toISOString()
      const content = yamlStringify({
        schemaVersion: 1,
        id: randomUUID(),
        name: displayName,
        description: '',
        profile: 'default',
        continueOnFailure: false,
        items: [],
        createdAt: now,
        updatedAt: now,
      })
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    } else if (type === 'api-request') {
      const fileName = `${key}.request.json`
      const content = JSON.stringify(
        {
          schemaVersion: 1,
          id: randomUUID(),
          name: displayName,
          description: '',
          method: 'GET',
          url: '',
          params: [],
          headers: [],
          auth: { type: 'none' },
          body: { type: 'none' },
          assertions: [],
        },
        null,
        2,
      )
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    } else if (type === 'keyword') {
      const fileName = `${key}.keywords.json`
      const content = JSON.stringify(
        {
          schemaVersion: 1,
          id: randomUUID(),
          name: displayName,
          description: '',
          params: [],
          steps: [],
        },
        null,
        2,
      )
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    }

    setNewItemState(null)
    reload()
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const active = document.activeElement
      const isEditable =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active as HTMLElement)?.isContentEditable
      if (isEditable) return

      const selected = treeRef.current?.selectedNodes[0]
      if (!selected) return

      if (matchesBinding(e.nativeEvent, EXPLORER_KEYMAPS.delete.keys) && !isTopLevel(selected.id)) {
        e.preventDefault()
        const isFolder = selected.isInternal
        const label = isFolder ? 'folder and all its contents' : `"${selected.data.name}"`
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return
        if (isFolder) closeTabsUnderPath(selected.data.path)
        else closeTab(selected.data.path)
        invoke(IpcChannels.FS_DELETE, selected.data.path)
        return
      }

      if (matchesBinding(e.nativeEvent, EXPLORER_KEYMAPS.newItem.keys)) {
        e.preventDefault()
        const dir = selected.isInternal ? selected.data.path : pathDirname(selected.data.path)
        const feature = featureOf(selected.id)
        const type: NewItemType =
          feature === 'test-cases' ? 'test-case'
          : feature === 'test-suites' ? 'suite'
          : feature === 'api-requests' ? 'api-request'
          : feature === 'keywords' ? 'keyword'
          : 'folder'
        setNewItemState({ dir, type })
      }
    },
    [closeTab, closeTabsUnderPath, setNewItemState],
  )

  return (
    <div ref={containerRef} className="w-full" onKeyDown={handleKeyDown}>
      {width > 0 && (
        <Tree<FsTreeNode>
          ref={treeRef}
          data={tree}
          idAccessor={(n) => n.id}
          childrenAccessor={(n) => (n.type === 'directory' ? (n.children ?? []) : null)}
          onRename={handleRename}
          onMove={handleMove}
          onToggle={syncHeight}
          disableDrag={(node) => isTopLevel(node.id)}
          disableDrop={(args) => !canDrop(args)}
          disableEdit={(node) => isTopLevel(node.id)}
          openByDefault={false}
          width={width}
          height={treeHeight}
          rowHeight={ROW_H}
          indent={12}
          overscanCount={8}
        >
          {(props) => (
            <NodeRow
              {...props}
              onNewItem={setNewItemState}
              onImportOpenApi={setImportOpenApiDir}
              projectPath={projectPath}
            />
          )}
        </Tree>
      )}

      <NewItemDialog
        open={newItemState !== null}
        type={newItemState?.type ?? 'folder'}
        onConfirm={handleCreateItem}
        onCancel={() => setNewItemState(null)}
      />

      <ImportOpenApiDialog
        open={importOpenApiDir !== null}
        targetDir={importOpenApiDir ?? ''}
        onClose={() => setImportOpenApiDir(null)}
        onImported={reload}
      />
    </div>
  )
}
