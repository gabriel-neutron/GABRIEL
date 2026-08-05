/**
 * Client for the Python FastAPI sidecar (localhost:8000, see sidecar/README.md). This is
 * the only place in the React app that talks to the sidecar — it never touches Telegram
 * or the .tgdb directly. No React; pure functions.
 */
import type { GraphEdgeAttributes, GraphNodeAttributes } from "@/core/graph/graphData"

const SIDECAR_BASE_URL = "http://localhost:8000"
const SIDECAR_WS_URL = "ws://localhost:8000"

export type SidecarHealth = {
  status: "ok"
  version: string
  telegram: "connected" | "not_connected"
}

/**
 * Throws on network failure or non-2xx — callers (the status indicator's poll loop)
 * catch and render "unreachable" rather than propagating.
 */
export async function fetchSidecarHealth(): Promise<SidecarHealth> {
  const res = await fetch(`${SIDECAR_BASE_URL}/health`)
  if (!res.ok) {
    throw new Error(`Sidecar health check failed: ${res.status}`)
  }
  return res.json() as Promise<SidecarHealth>
}

/**
 * The `/graph` wire format, expressed as the shared `GraphData` plus the two attributes
 * the sidecar adds. Written as an intersection rather than as a standalone shape so it is
 * assignable to `GraphData` and can be handed straight to `SigmaGraphCanvas` — a separate
 * declaration of the same fields would drift, and TypeScript's weak-type check would
 * reject the payload the moment the wire format gained a field of its own.
 */
export type SigmaGraphData = {
  nodes: { key: string; attributes: GraphNodeAttributes }[]
  edges: {
    key: string
    source: string
    target: string
    attributes: GraphEdgeAttributes & { edgeType: string; weight: number }
  }[]
}

/** FR-7. Works against a seed-only (uncollected) graph — no Telegram connection required. */
export async function fetchGraph(): Promise<SigmaGraphData> {
  const res = await fetch(`${SIDECAR_BASE_URL}/graph`)
  if (!res.ok) {
    throw new Error(`Graph fetch failed: ${res.status}`)
  }
  return res.json() as Promise<SigmaGraphData>
}

export type SearchResult = {
  kind: "channel" | "entity"
  id: number
  label: string
  entityType?: string
  sourceId?: number
}

/** FR-7. Works against seed-only data — pure SQL, no Telegram dependency. */
export async function searchGraph(query: string): Promise<SearchResult[]> {
  const res = await fetch(`${SIDECAR_BASE_URL}/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status}`)
  }
  const body = (await res.json()) as { results: SearchResult[] }
  return body.results
}

export type OobProposal = {
  id: number
  channel_id: number
  oob_entity_id: string
  confidence: number
  evidence_text: string
  username: string
  title: string
}

/** Phase 7's persisted review queue. No Telegram/`.gpkg` dependency — `oob_entity_id` is
 * an opaque string until gpkg_reader.py exists. */
export async function fetchOobProposals(): Promise<OobProposal[]> {
  const res = await fetch(`${SIDECAR_BASE_URL}/oob/proposals`)
  if (!res.ok) {
    throw new Error(`Fetching OOB proposals failed: ${res.status}`)
  }
  const body = (await res.json()) as { proposals: OobProposal[] }
  return body.proposals
}

export async function decideOobProposal(
  id: number,
  decision: "accept" | "reject",
): Promise<{ oob_entity_id: string; channel_url: string } | null> {
  const res = await fetch(`${SIDECAR_BASE_URL}/oob/${decision}/${id}`, { method: "POST" })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`OOB ${decision} failed: ${res.status}`)
  }
  return res.json()
}

export type CrawlProgressMessage = {
  session_id: number
  status: "running" | "paused" | "completed"
  frontier_size: number
  visited_count: number
  node_count: number
  edge_count: number
}

export type CrawlProgressError = { error: string; session_id: number }

/** Slice 7 (`sidecar/crawl_ws.py`). `main.py`'s `/crawl/ws/{session_id}` matches the
 * path-param style `/crawl/status/{session_id}` already uses. Callers open this URL with
 * `new WebSocket(...)` (or an injected factory in tests) — no client-side wrapper here,
 * since connection lifecycle (reconnect on drop) is stateful and belongs in the hook that
 * owns it, not this pure-function service file. */
export function crawlWebSocketUrl(sessionId: number): string {
  return `${SIDECAR_WS_URL}/crawl/ws/${sessionId}`
}

export type SeedImportResult = { requested: number; inserted: number; usernames: string[] }

/** FR-1. Only writes DB rows — no Telegram call, works with the sidecar offline from Telegram. */
export async function importSeeds(input: {
  csvText?: string
  usernames?: string[]
}): Promise<SeedImportResult> {
  const res = await fetch(`${SIDECAR_BASE_URL}/seed/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv_text: input.csvText, usernames: input.usernames }),
  })
  if (!res.ok) {
    throw new Error(`Seed import failed: ${res.status}`)
  }
  return res.json() as Promise<SeedImportResult>
}
