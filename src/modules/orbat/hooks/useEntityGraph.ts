import { useCallback, useMemo, useState } from "react"
import { buildEntityGraph, edgeTypesInTier, type GraphEntity } from "@/core/graph/entityGraph"
import type { GraphData } from "@/core/graph/graphData"
import type { RelationshipTier, RelationshipType } from "@/core/relationship/relationship"
import { useProjectStore } from "@/store/useProjectStore"

/**
 * The entity graph's filter state, and the graph it produces.
 *
 * Everything decided here is React state; everything computed is `buildEntityGraph`.
 * The split is the house rule — there is no React Testing Library in this repo, so any
 * rule left inside a component is a rule no test can reach.
 */

export const ALL_TIERS: readonly RelationshipTier[] = ["record", "assessment"]

export type EntityGraphState = {
  graph: GraphData
  /** Every type, grouped by the tier the vocabulary assigns it. */
  typesByTier: { tier: RelationshipTier; types: RelationshipType[] }[]
  selectedTiers: RelationshipTier[]
  selectedTypes: RelationshipType[]
  hideIsolated: boolean
  toggleTier: (tier: RelationshipTier) => void
  toggleType: (type: RelationshipType) => void
  setHideIsolated: (hide: boolean) => void
  reset: () => void
  /** Entities drawn / entities in the project, for the status line. */
  drawnCount: number
  totalCount: number
  edgeCount: number
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function useEntityGraph(): EntityGraphState {
  const entities = useProjectStore((s) => s.entities)
  const relationships = useProjectStore((s) => s.relationships)

  const typesByTier = useMemo(
    () => ALL_TIERS.map((tier) => ({ tier, types: edgeTypesInTier(tier) })),
    [],
  )
  const allTypes = useMemo(() => typesByTier.flatMap((group) => group.types), [typesByTier])

  // Everything selected initially rather than nothing: an empty selection is a legitimate
  // filter meaning "no edges", and opening on it would show 1,027 unconnected dots and
  // read as a broken view.
  const [selectedTiers, setSelectedTiers] = useState<RelationshipTier[]>([...ALL_TIERS])
  const [selectedTypes, setSelectedTypes] = useState<RelationshipType[]>(allTypes)
  const [hideIsolated, setHideIsolated] = useState(false)

  const graphEntities = useMemo<GraphEntity[]>(
    () => entities.map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
    [entities],
  )

  const graph = useMemo(
    () =>
      buildEntityGraph(
        { entities: graphEntities, relationships },
        { tiers: selectedTiers, types: selectedTypes, hideIsolated },
      ),
    [graphEntities, relationships, selectedTiers, selectedTypes, hideIsolated],
  )

  const toggleTier = useCallback((tier: RelationshipTier) => {
    setSelectedTiers((prev) => toggle(prev, tier))
  }, [])

  const toggleType = useCallback((type: RelationshipType) => {
    setSelectedTypes((prev) => toggle(prev, type))
  }, [])

  const reset = useCallback(() => {
    setSelectedTiers([...ALL_TIERS])
    setSelectedTypes(allTypes)
    setHideIsolated(false)
  }, [allTypes])

  return {
    graph,
    typesByTier,
    selectedTiers,
    selectedTypes,
    hideIsolated,
    toggleTier,
    toggleType,
    setHideIsolated,
    reset,
    drawnCount: graph.nodes.length,
    totalCount: entities.length,
    edgeCount: graph.edges.length,
  }
}
