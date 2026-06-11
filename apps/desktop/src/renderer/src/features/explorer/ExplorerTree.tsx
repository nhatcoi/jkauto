import { useCallback, useEffect, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeRendererProps, NodeApi } from 'react-arborist'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileJson,
  TestTube2,
  Layers,
  Database,
  Code2,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { IpcChannels } from '@jkauto/core'
import type { FsTreeNode } from '@jkauto/core'
import { invoke } from '@/lib/utils'
import { useProjectStore } from '@/store/project.store'
import { cn } from '@/lib/utils'
import { useExplorerTree } from './useExplorerTree'
import { NewItemDialog } from './NewItemDialog'
import { randomUUID } from './utils'

type NewItemType = 'folder' | 'test-case' | 'suite' | 'keyword'

interface NewItemState {
  dir: string
  type: NewItemType
}

// ── path helpers (renderer has no node:path) ──────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

function getFileIcon(node: FsTreeNode): React.ElementType {
  const name = node.name.toLowerCase()
  if (name.endsWith('.test.json') || name.endsWith('.test.yaml')) return TestTube2
  if (name.endsWith('.suite.json') || name.endsWith('.suite.yaml')) return Layers
  if (name.endsWith('.objects.json') || name.endsWith('.objects.yaml')) return Database
  if (name.endsWith('.keywords.json') || name.endsWith('.keywords.yaml')) return Code2
  if (node.ext === '.json') return FileJson
  return FileText
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

// id is relative path from project root, e.g. "test-cases/foo.test.json"
// Top-level feature folders have no "/" in their id
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
  if (!parentNode) return false                                  // no dropping to root
  for (const n of dragNodes) {
    if (isTopLevel(n.id)) return false                          // can't drag feature folders
    if (!isSameFeature(n.id, parentNode.id)) return false       // cross-feature blocked
  }
  return true
}

function NodeRow({
  node,
  style,
  dragHandle,
  onNewItem,
  projectPath,
}: NodeRendererProps<FsTreeNode> & { onNewItem: (state: NewItemState) => void; projectPath: string }) {
  const { openTab } = useProjectStore()

  const handleActivate = () => {
    if (node.isInternal) {
      node.toggle()
    } else {
      openTab(node.data.path, node.data.name, projectPath)
    }
  }

  const handleDelete = async () => {
    await invoke(IpcChannels.FS_DELETE, node.data.path)
  }

  const handleCopy = async () => {
    const parent = pathDirname(node.data.path)
    const base = pathBasename(node.data.name)
    const dotIdx = base.lastIndexOf('.')
    const name = dotIdx > 0 ? base.slice(0, dotIdx) : base
    const ext = dotIdx > 0 ? base.slice(dotIdx) : ''
    const dest = pathJoin(parent, `${name}-copy${ext}`)
    await invoke(IpcChannels.FS_COPY, node.data.path, dest)
  }

  const handleOpenFolder = async () => {
    await invoke(IpcChannels.FS_OPEN_CONTAINING_FOLDER, node.data.path)
  }

  const isFolder = node.isInternal
  const FolderIcon = node.isOpen ? FolderOpen : Folder
  const FileIcon = getFileIcon(node.data)

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
            <FolderIcon className="w-3.5 h-3.5 text-yellow-400/80 shrink-0" />
          ) : (
            <FileIcon className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
          )}

          {node.isEditing ? (
            <input
              autoFocus
              defaultValue={node.data.name}
              className="flex-1 bg-input text-foreground text-xs px-1 rounded outline-none border border-primary min-w-0"
              onBlur={(e) => node.submit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') node.submit((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') node.reset()
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-xs truncate text-foreground/85 flex-1 min-w-0">{node.data.name}</span>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {isFolder && (
          <>
            <ContextMenuItem onSelect={() => onNewItem({ dir: node.data.path, type: 'test-case' })}>
              New Test Case
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onNewItem({ dir: node.data.path, type: 'suite' })}>
              New Test Suite
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onNewItem({ dir: node.data.path, type: 'folder' })}>
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {!isTopLevel(node.id) && (
          <>
            <ContextMenuItem onSelect={() => node.edit()}>Rename</ContextMenuItem>
            {!isFolder && (
              <ContextMenuItem onSelect={handleCopy}>Copy</ContextMenuItem>
            )}
            <ContextMenuItem
              onSelect={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={handleOpenFolder}>Open Containing Folder</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

interface ExplorerTreeProps {
  projectPath: string
}

const ROW_H = 24

function countVisible(nodes: FsTreeNode[], openIds: Set<string>): number {
  let n = 0
  for (const node of nodes) {
    n++
    if (node.type === 'directory' && openIds.has(node.id) && node.children) {
      n += countVisible(node.children, openIds)
    }
  }
  return n
}

export function ExplorerTree({ projectPath }: ExplorerTreeProps) {
  const { tree, reload } = useExplorerTree(projectPath)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [newItemState, setNewItemState] = useState<NewItemState | null>(null)

  // width-only ResizeObserver — height computed from visible rows
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // reset open state when tree reloads (new project or watch event)
  useEffect(() => { setOpenIds(new Set()) }, [projectPath])

  const treeHeight = Math.max(countVisible(tree, openIds) * ROW_H, ROW_H)

  const handleRename = useCallback(
    async ({ id, name }: { id: string; name: string }) => {
      const node = findNodeById(tree, id)
      if (!node) return
      const dir = pathDirname(node.path)
      const newPath = pathJoin(dir, name)
      await invoke(IpcChannels.FS_RENAME, node.path, newPath)
    },
    [tree],
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

  const handleCreateItem = async (name: string) => {
    if (!newItemState) return
    const { dir, type } = newItemState

    if (type === 'folder') {
      await invoke(IpcChannels.FS_CREATE_DIR, pathJoin(dir, name))
    } else if (type === 'test-case') {
      const fileName = name.endsWith('.test.json') ? name : `${name}.test.json`
      const content = JSON.stringify(
        { schemaVersion: 1, id: randomUUID(), name, description: '', steps: [] },
        null,
        2,
      )
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    } else if (type === 'suite') {
      const fileName = name.endsWith('.suite.json') ? name : `${name}.suite.json`
      const content = JSON.stringify(
        { schemaVersion: 1, id: randomUUID(), name, description: '', testCaseIds: [] },
        null,
        2,
      )
      await invoke(IpcChannels.FS_CREATE_FILE, pathJoin(dir, fileName), content)
    }

    setNewItemState(null)
    reload()
  }

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <Tree<FsTreeNode>
          data={tree}
          idAccessor={(n) => n.id}
          childrenAccessor={(n) => (n.type === 'directory' ? (n.children ?? []) : null)}
          onRename={handleRename}
          onMove={handleMove}
          onToggle={(id) =>
            setOpenIds((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
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
          {(props) => <NodeRow {...props} onNewItem={setNewItemState} projectPath={projectPath} />}
        </Tree>
      )}

      <NewItemDialog
        open={newItemState !== null}
        type={newItemState?.type ?? 'folder'}
        onConfirm={handleCreateItem}
        onCancel={() => setNewItemState(null)}
      />
    </div>
  )
}
