import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { RatingEvent } from "@/core/provenance/ratingEvent"
import type { Source } from "@/core/provenance/source"
import type { ProjectState } from "./useProjectStore"

/**
 * The two React-free readers over `ProjectState`, split out of `useProjectStore.ts` so that file
 * stays inside criterion 5's line cap while the store keeps the behaviour it gained in 2B. The
 * precedent is P1b's `projectSave.ts`, extracted from `useProjectIO.ts` for the same reason.
 * Both are re-exported from `useProjectStore.ts`, so no import site had to move.
 *
 * `ProjectState` is imported as a TYPE only, so nothing is imported back at runtime and the
 * re-export in `useProjectStore.ts` is the single runtime edge between the two files.
 */

/**
 * The single source of truth for what data gets written to disk. `sourceCache`/
 * `sources` live in peripheral stores (ADR 0005/0006) — passed in explicitly rather
 * than read off `ProjectState` so this stays the one place callers assemble a save
 * snapshot from, even though the data now spans multiple stores.
 */
export function selectPersistableSnapshot(
  state: ProjectState,
  sourceCache: Map<string, string>,
  sources: Source[] = [],
  ratingEvents: RatingEvent[] = [],
) {
  const nonOsmLayerIds = new Set(state.layers.filter((l) => l.osmData == null).map((l) => l.id))
  const entities = state.entities
    .filter((e) => nonOsmLayerIds.has(e.layerId))
    .map((e) => ({ ...e, name: e.name.trim() || "Untitled" }))
  const survivingEntityIds = new Set(entities.map((e) => e.id))
  return {
    layers: state.layers.map((l) => ({ ...l, kind: l.kind ?? (l.osmData != null ? ("osm" as const) : undefined) })),
    entities,
    geometries: state.drawnGeometries.filter((g) => nonOsmLayerIds.has(g.layerId)),
    sourceCache,
    // Only the claims belonging to a surviving (non-OSM) entity are persisted —
    // otherwise an OSM entity filtered out above would leave a dangling claim.entityId.
    claims: state.claims.filter((c) => survivingEntityIds.has(c.entityId)),
    // Same reasoning one step further: an edge onto an entity the OSM filter removed would reach
    // disk with a dangling endpoint, and `load.ts` throws on one — an unopenable project file.
    relationships: state.relationships.filter(
      (r) => survivingEntityIds.has(r.fromId) && survivingEntityIds.has(r.toId),
    ),
    integrityEvents: state.integrityEvents,
    sources,
    ratingEvents,
  }
}

/** Wired to the deliverable-export path when that path exists. It deliberately does NOT gate
 *  saving: blocking a save on an irreplaceable working file is the wrong failure direction
 *  (GABRIEL_V2_SLICE_0_1_BUILD.md:576-579). */
export function unacknowledgedIntegrityEvents(state: ProjectState): IntegrityEvent[] {
  return state.integrityEvents.filter((e) => e.acknowledgedAt == null)
}
