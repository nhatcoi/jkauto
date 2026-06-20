import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'

interface CodeRelation {
  from: string
  to: string
  type: 'contains' | 'imports' | 'declares' | 'renders' | 'exposes' | 'reads' | 'calls' | 'depends-on'
  sourceRef?: { file: string; line?: number }
  confidence: number
}

interface AnalysisFinding {
  id: string
  kind: string
  name: string
  summary: string
  status: 'verified' | 'inferred' | 'unknown'
  confidence: number
}

interface GraphData {
  relations?: CodeRelation[]
  findings?: AnalysisFinding[]
}

const EDGE_COLORS: Record<CodeRelation['type'], string> = {
  contains: '#4b5563',
  imports: '#6b7280',
  declares: '#7c3aed',
  renders: '#8b5cf6',
  exposes: '#3b82f6',
  reads: '#10b981',
  calls: '#f59e0b',
  'depends-on': '#6b7280',
}

const NODE_KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  module: { bg: '#1e1b4b', border: '#4f46e5', text: '#a5b4fc' },
  file: { bg: '#0f172a', border: '#334155', text: '#94a3b8' },
  route: { bg: '#064e3b', border: '#059669', text: '#6ee7b7' },
  endpoint: { bg: '#1e3a5f', border: '#2563eb', text: '#93c5fd' },
  default: { bg: '#1a1a1a', border: '#374151', text: '#9ca3af' },
}

type ViewLevel = 'module' | 'file'

function extractKind(stableKey: string): string {
  return stableKey.split(':')[0] ?? 'default'
}

function shortLabel(stableKey: string): string {
  const parts = stableKey.split(':')
  const value = parts.slice(1).join(':')
  const segments = value.replace(/\\/g, '/').split('/')
  return segments[segments.length - 1] ?? value
}

function buildGraph(
  relations: CodeRelation[],
  level: ViewLevel,
): { nodes: Node[]; edges: Edge[] } {
  const filtered =
    level === 'module'
      ? relations.filter((rel) => rel.from.startsWith('module:') || rel.to.startsWith('module:'))
      : relations.slice(0, 400)

  const keySet = new Set<string>()
  for (const rel of filtered) {
    keySet.add(rel.from)
    keySet.add(rel.to)
  }

  const keys = Array.from(keySet)
  const nodeCount = keys.length
  const cols = Math.ceil(Math.sqrt(nodeCount))

  const nodes: Node[] = keys.map((key, i) => {
    const kind = extractKind(key)
    const colors = NODE_KIND_COLORS[kind] ?? NODE_KIND_COLORS.default
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: key,
      position: { x: col * 200, y: row * 100 },
      data: { label: shortLabel(key) },
      style: {
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 6,
        fontSize: 11,
        padding: '6px 10px',
        maxWidth: 180,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      },
    }
  })

  const seenEdges = new Set<string>()
  const edges: Edge[] = []
  for (const rel of filtered) {
    const edgeId = `${rel.from}→${rel.to}→${rel.type}`
    if (seenEdges.has(edgeId)) continue
    seenEdges.add(edgeId)
    edges.push({
      id: edgeId,
      source: rel.from,
      target: rel.to,
      label: rel.type,
      style: { stroke: EDGE_COLORS[rel.type] ?? '#4b5563', strokeWidth: 1.5 },
      labelStyle: { fontSize: 9, fill: '#6b7280' },
      labelBgStyle: { fill: '#111', fillOpacity: 0.7 },
      animated: rel.type === 'exposes' || rel.type === 'renders',
    })
  }

  return { nodes, edges }
}

export function KnowledgeGraphView({ contentJson }: { contentJson: string }) {
  let data: GraphData = {}
  try { data = JSON.parse(contentJson) } catch { /* noop */ }

  const relations = data.relations ?? []
  const findings = data.findings ?? []
  const [level, setLevel] = useState<ViewLevel>('module')

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(relations, level),
    [relations, level],
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onLevelChange = useCallback(
    (next: ViewLevel) => setLevel(next),
    [],
  )

  if (relations.length === 0) {
    return <p className="text-xs text-muted-foreground">No graph relations available.</p>
  }

  const moduleLevelCount = relations.filter(
    (rel) => rel.from.startsWith('module:') || rel.to.startsWith('module:'),
  ).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          {(['module', 'file'] as ViewLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLevelChange(l)}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                level === l
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l === 'module' ? `Module (${moduleLevelCount})` : `File (${Math.min(400, relations.length)})`}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {relations.length.toLocaleString()} total relations ·{' '}
          {findings.length} findings
        </span>
      </div>

      {findings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {findings.slice(0, 8).map((finding) => (
            <div
              key={finding.id}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]',
                finding.status === 'verified'
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : finding.status === 'inferred'
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                    : 'border-border bg-card/30 text-muted-foreground',
              )}
              title={finding.summary}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {finding.name}
            </div>
          ))}
        </div>
      )}

      <div className="h-[480px] overflow-hidden rounded-lg border border-border bg-[#0d0d0d]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#1f2937" gap={20} size={1} />
          <Controls
            style={{ background: '#111', border: '1px solid #1f2937' }}
          />
          <MiniMap
            style={{ background: '#111', border: '1px solid #1f2937' }}
            nodeColor={(node) => {
              const kind = extractKind(node.id)
              return (NODE_KIND_COLORS[kind] ?? NODE_KIND_COLORS.default).border
            }}
          />
        </ReactFlow>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.entries(EDGE_COLORS) as [CodeRelation['type'], string][]).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  )
}
