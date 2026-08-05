import { SigmaContainer, useLoadGraph, useRegisterEvents } from "@react-sigma/core"
import "@react-sigma/core/lib/style.css"
import { MultiGraph } from "graphology"
import { useEffect } from "react"
import type { GraphData } from "@/core/graph/graphData"

/**
 * The one Sigma/WebGL canvas, shared by the Telegram channel graph and the entity graph.
 *
 * A `MultiGraph`, not a `Graph`: two entities can stand in more than one recorded
 * relationship at once — a supplier that also ships to its customer is two edges of two
 * types between one pair — and a simple graph silently drops the second, which would
 * quietly under-report the very thing the view exists to show.
 */

const LABEL_NODE_LIMIT = 500

/**
 * Nodes with no opinion about position land on a deterministic ring rather than at
 * `Math.random()`. Random coordinates are not a layout; they are noise that changes on
 * every render, and adjacency read off one of them is read off nothing.
 */
function fallbackPoint(index: number, total: number): { x: number; y: number } {
  const angle = (index / Math.max(1, total)) * 2 * Math.PI
  return { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 }
}

function GraphLoader({ data }: { data: GraphData }): null {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    const graph = new MultiGraph()
    data.nodes.forEach((node, index) => {
      if (graph.hasNode(node.key)) return
      const fallback = fallbackPoint(index, data.nodes.length)
      graph.addNode(node.key, {
        ...node.attributes,
        x: node.attributes.x ?? fallback.x,
        y: node.attributes.y ?? fallback.y,
        size: node.attributes.size ?? 4,
        color: node.attributes.color ?? "#64748b",
      })
    })
    for (const edge of data.edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
      if (graph.hasEdge(edge.key)) continue
      graph.addEdgeWithKey(edge.key, edge.source, edge.target, {
        size: edge.attributes.size ?? 1,
        color: edge.attributes.color ?? "#cbd5e1",
        label: edge.attributes.label,
      })
    }
    loadGraph(graph)
  }, [loadGraph, data])
  return null
}

function NodeClicks({ onNodeClick }: { onNodeClick: (key: string) => void }): null {
  const registerEvents = useRegisterEvents()
  useEffect(() => {
    registerEvents({ clickNode: (event) => onNodeClick(event.node) })
  }, [registerEvents, onNodeClick])
  return null
}

export type SigmaGraphCanvasProps = {
  data: GraphData
  /** Defaults to "only under 500 nodes" — per the Phase 1 Sigma finding
   *  (sidecar/validation/RESULTS.md), label density is what collapses frame rate. */
  renderLabels?: boolean
  renderEdgeLabels?: boolean
  onNodeClick?: (key: string) => void
}

export function SigmaGraphCanvas({
  data,
  renderLabels,
  renderEdgeLabels = false,
  onNodeClick,
}: SigmaGraphCanvasProps): React.ReactElement {
  return (
    <SigmaContainer
      style={{ width: "100%", height: "100%" }}
      settings={{
        renderLabels: renderLabels ?? data.nodes.length <= LABEL_NODE_LIMIT,
        renderEdgeLabels,
        defaultEdgeType: "line",
      }}
    >
      <GraphLoader data={data} />
      {onNodeClick && <NodeClicks onNodeClick={onNodeClick} />}
    </SigmaContainer>
  )
}
