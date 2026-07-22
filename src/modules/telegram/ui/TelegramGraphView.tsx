import { SigmaContainer, useLoadGraph } from "@react-sigma/core"
import "@react-sigma/core/lib/style.css"
import Graph from "graphology"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useCrawlProgress } from "@/modules/telegram/hooks/useCrawlProgress"
import { fetchGraph, type SigmaGraphData } from "@/modules/telegram/services/sidecar.service"
import { Input } from "@/ui/input"

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
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionInput, setSessionInput] = useState("")
  const progress = useCrawlProgress(sessionId)
  const lastSeenCounts = useRef<{ nodeCount: number; edgeCount: number } | null>(null)

  const refetchGraph = useCallback(() => {
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

  useEffect(() => refetchGraph(), [refetchGraph])

  // Refetches the full graph whenever the live crawl's node/edge counts change — simpler
  // and safer than incrementally patching the graphology graph client-side, and at the
  // scale this crawl operates at (Slice 0: tens to low hundreds of channels) a full
  // refetch per change is cheap.
  useEffect(() => {
    if (progress.kind !== "live") return
    const { node_count: nodeCount, edge_count: edgeCount } = progress.message
    const last = lastSeenCounts.current
    if (last && last.nodeCount === nodeCount && last.edgeCount === edgeCount) return
    lastSeenCounts.current = { nodeCount, edgeCount }
    refetchGraph()
  }, [progress, refetchGraph])

  function handleAttach() {
    const parsed = Number(sessionInput)
    lastSeenCounts.current = null
    setSessionId(Number.isFinite(parsed) && sessionInput.trim() !== "" ? parsed : null)
  }

  const crawlStatusLine =
    progress.kind === "live"
      ? `Crawl #${progress.message.session_id}: ${progress.message.status} — ${progress.message.visited_count} visited, ${progress.message.frontier_size} queued, ${progress.message.node_count} nodes, ${progress.message.edge_count} edges`
      : progress.kind === "error"
        ? `Crawl session error: ${progress.message}`
        : progress.kind === "connecting"
          ? "Connecting to crawl session…"
          : null

  const controls = (
    <div className="flex items-center gap-2 border-b p-2 text-sm">
      <Input
        className="h-7 w-32"
        placeholder="Session id"
        value={sessionInput}
        onChange={(e) => setSessionInput(e.target.value)}
      />
      <button type="button" className="text-sm underline" onClick={handleAttach}>
        {sessionId === null ? "Watch live crawl" : "Change session"}
      </button>
      {crawlStatusLine && <span className="text-muted-foreground">{crawlStatusLine}</span>}
    </div>
  )

  let body: ReactNode
  if (state.kind === "loading") {
    body = <div className="p-4 text-sm text-muted-foreground">Loading graph…</div>
  } else if (state.kind === "error") {
    body = (
      <div className="p-4 text-sm text-destructive">
        {state.message} — is the sidecar running? (`npm run sidecar`)
      </div>
    )
  } else if (state.data.nodes.length === 0) {
    body = (
      <div className="p-4 text-sm text-muted-foreground">
        No channels yet — import seeds from the Telegram panel to get started.
      </div>
    )
  } else {
    body = (
      <div className="min-h-0 flex-1">
        <SigmaContainer
          style={{ width: "100%", height: "100%" }}
          settings={{ renderLabels: state.data.nodes.length <= 500 }}
        >
          <GraphLoader data={state.data} />
        </SigmaContainer>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {controls}
      {body}
    </div>
  )
}
