import { SigmaContainer, useLoadGraph } from "@react-sigma/core"
import "@react-sigma/core/lib/style.css"
import Graph from "graphology"
import { useEffect, useState } from "react"
import { fetchGraph, type SigmaGraphData } from "@/modules/telegram/services/sidecar.service"

function GraphLoader({ data }: { data: SigmaGraphData }) {
  const loadGraph = useLoadGraph()
  useEffect(() => {
    const graph = new Graph()
    for (const node of data.nodes) {
      graph.addNode(node.key, {
        ...node.attributes,
        x: Math.random() * 100,
        y: Math.random() * 100,
      })
    }
    for (const edge of data.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target) && !graph.hasEdge(edge.source, edge.target)) {
        graph.addEdge(edge.source, edge.target, { size: 1, color: "#cbd5e1" })
      }
    }
    loadGraph(graph)
  }, [loadGraph, data])
  return null
}

/**
 * FR-7 graph view (`views` entry, Phase 6). Renders whatever the sidecar's `/graph`
 * endpoint returns — a seed-only graph today, a real BFS-discovered one once Phase 5
 * lands, same rendering code either way. Labels default off above 500 nodes per the
 * Phase 1 Sigma.js finding (sidecar/validation/RESULTS.md): edge/label density, not
 * node count, is what collapses frame rate — this is a conservative guard until a real
 * crawl's actual density is measured.
 */
export function TelegramGraphView() {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ready"; data: SigmaGraphData } | { kind: "error"; message: string }
  >({ kind: "loading" })

  useEffect(() => {
    let cancelled = false
    fetchGraph()
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data })
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === "loading") {
    return <div className="p-4 text-sm text-muted-foreground">Loading graph…</div>
  }
  if (state.kind === "error") {
    return (
      <div className="p-4 text-sm text-destructive">
        {state.message} — is the sidecar running? (`npm run sidecar`)
      </div>
    )
  }
  if (state.data.nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No channels yet — import seeds from the Telegram panel to get started.
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{ renderLabels: state.data.nodes.length <= 500 }}
      >
        <GraphLoader data={state.data} />
      </SigmaContainer>
    </div>
  )
}
