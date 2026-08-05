import type { EntityKind } from "@/core/entity/entity"
import { edgeTypeLabel } from "@/core/relationship/edgeForm"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
import type { Relationship, RelationshipTier, RelationshipType } from "@/core/relationship/relationship"
import { EDGE_TYPES, type EdgeLayer } from "@/core/relationship/vocabulary"
import type { GraphData } from "./graphData"
import { radialLayout } from "./radialLayout"

/**
 * The project's entities and relationships, as a graph.
 *
 * The PRD's complaint was "I can catalogue the nodes of the backbone; I cannot record the
 * backbone". The relationship editor made recording one possible; this is what makes a
 * recorded one *visible*. Twenty authored edges over 1,027 entities are invisible in a
 * tree view and in an inspector — they are only a backbone when seen at once.
 *
 * It is a projection, never a second opinion. Which edges place a child under a parent is
 * `isHierarchyBearing`'s answer via `hierarchyIndex`, the tier and layer of a type are the
 * vocabulary's, and the type's prose label is `edgeForm`'s. What is decided here, and only
 * here, is colour, size and position.
 *
 * Pure and React-free, in `core/` for the house reason: there is no React Testing Library
 * in this repo, so logic left inside a component is logic no test can reach.
 */

/** The minimum an entity must carry to be drawn. Deliberately narrower than `Entity`. */
export type GraphEntity = { id: string; name: string; kind: EntityKind }

export type EntityGraphInput = {
  entities: readonly GraphEntity[]
  relationships: readonly Relationship[]
}

export type EntityGraphFilters = {
  /** Undefined means every type. An empty array means none, and is not the same thing. */
  types?: readonly RelationshipType[]
  /** Undefined means both tiers. Applied BEFORE `types`, so the two intersect. */
  tiers?: readonly RelationshipTier[]
  /** Drop entities no surviving edge touches. Off by default: at 1,027 entities and one
   *  filter selected, "everything else vanished" needs to be something a reader asked for. */
  hideIsolated?: boolean
}

const KIND_COLORS: Record<EntityKind, string> = {
  unit: "#dc2626",
  corporate: "#f59e0b",
  vessel: "#0ea5e9",
  person: "#a855f7",
  equipment_class: "#10b981",
}

/**
 * By vocabulary layer, not by type: six layers are distinguishable at a glance where
 * thirteen types are not, and the layer is the grouping the vocabulary itself declares.
 * `assessment` is a seventh key because assessment-tier types declare `layer: null` — the
 * one edge class a reader most needs told apart, since it is an analytical judgement
 * rather than a documentary record and is excluded from the CC-BY export by default.
 */
const LAYER_COLORS: Record<EdgeLayer | "assessment", string> = {
  "orbat": "#94a3b8",
  "military-industrial": "#f97316",
  "industrial": "#eab308",
  "financial": "#22c55e",
  "logistics": "#06b6d4",
  "shipping": "#3b82f6",
  "assessment": "#e879f9",
}

/** An ended edge is a retired record, not a current one. Drawn, and drawn as spent. */
const ENDED_COLOR = "#cbd5e1"

const MIN_NODE_SIZE = 3
const MAX_NODE_SIZE = 18

/** The vocabulary's own partition, so a filter UI built from these cannot omit a type. */
export function edgeTypesInTier(tier: RelationshipTier): RelationshipType[] {
  return (Object.keys(EDGE_TYPES) as RelationshipType[]).filter((type) => EDGE_TYPES[type].tier === tier)
}

function edgeColor(rel: Relationship): string {
  if (rel.endDate != null) return ENDED_COLOR
  const definition = EDGE_TYPES[rel.type]
  if (definition == null) return LAYER_COLORS.orbat
  const key = definition.layer ?? "assessment"
  return LAYER_COLORS[key]
}

function keeps(rel: Relationship, filters: EntityGraphFilters): boolean {
  const definition = EDGE_TYPES[rel.type]
  if (definition == null) return false
  if (filters.tiers != null && !filters.tiers.includes(definition.tier)) return false
  if (filters.types != null && !filters.types.includes(rel.type)) return false
  return true
}

/**
 * Node size grows with degree but sub-linearly and with a ceiling: a formation with 200
 * subordinates would otherwise be a disc covering its own subtree. `sqrt` because that is
 * what makes a degree-4 node visibly bigger than a degree-1 one without making a degree-200
 * node fifty times either.
 */
function nodeSize(degree: number): number {
  return Math.min(MAX_NODE_SIZE, MIN_NODE_SIZE + Math.sqrt(degree) * 2.5)
}

export function buildEntityGraph(input: EntityGraphInput, filters: EntityGraphFilters): GraphData {
  const present = new Set(input.entities.map((e) => e.id))

  const kept = input.relationships.filter(
    (rel) => keeps(rel, filters) && present.has(rel.fromId) && present.has(rel.toId),
  )

  const degree = new Map<string, number>()
  for (const rel of kept) {
    degree.set(rel.fromId, (degree.get(rel.fromId) ?? 0) + 1)
    degree.set(rel.toId, (degree.get(rel.toId) ?? 0) + 1)
  }

  const drawn = filters.hideIsolated === true
    ? input.entities.filter((e) => degree.has(e.id))
    : input.entities

  // The layout is derived from the WHOLE hierarchy, not from `kept`. Recomputing it per
  // filter would re-root every entity the moment `subordinate_to` was deselected and
  // rearrange the entire canvas, so two filters could not be compared — the point of a
  // filter is that only the edges change.
  const index = hierarchyIndex(input.relationships, { entities: input.entities })
  const positions = radialLayout(drawn.map((e) => e.id), index.parents())

  return {
    nodes: drawn.map((entity) => {
      const point = positions.get(entity.id) ?? { x: 0, y: 0 }
      return {
        key: entity.id,
        attributes: {
          label: entity.name,
          color: KIND_COLORS[entity.kind] ?? KIND_COLORS.unit,
          size: nodeSize(degree.get(entity.id) ?? 0),
          x: point.x,
          y: point.y,
        },
      }
    }),
    edges: kept
      .filter((rel) => positions.has(rel.fromId) && positions.has(rel.toId))
      .map((rel) => ({
        key: rel.id,
        source: rel.fromId,
        target: rel.toId,
        attributes: {
          color: edgeColor(rel),
          size: rel.endDate == null ? 1.5 : 1,
          label: edgeTypeLabel(rel.type),
        },
      })),
  }
}
