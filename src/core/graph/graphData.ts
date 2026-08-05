/**
 * The shape a Sigma canvas is handed, independent of who built it.
 *
 * There are two producers — the Telegram sidecar's `/graph` endpoint, which returns this
 * over the wire, and `entityGraph.ts`, which projects the project's own entities and
 * relationships into it — and one consumer, `SigmaGraphCanvas`. Declaring it here rather
 * than in either producer is what stops the orbat module importing a type out of the
 * telegram module's service layer to draw its own data.
 *
 * Every attribute except `label` is optional because the sidecar's payload is a fixed wire
 * format this repo does not control: a producer supplies what it knows and the canvas
 * fills in the rest.
 */

export type GraphNodeAttributes = {
  label: string
  size?: number
  color?: string
  /** Unitless. Absent means "no opinion" — the canvas falls back to a deterministic ring. */
  x?: number
  y?: number
}

export type GraphEdgeAttributes = {
  size?: number
  color?: string
  label?: string
}

export type GraphData = {
  nodes: { key: string; attributes: GraphNodeAttributes }[]
  edges: { key: string; source: string; target: string; attributes: GraphEdgeAttributes }[]
}
