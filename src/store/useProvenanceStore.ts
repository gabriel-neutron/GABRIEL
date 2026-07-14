import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { setSourceReliability } from "@/core/provenance/admiralty"
import type { AdmiraltyReliability } from "@/core/provenance/admiralty"
import { dedupeSources, type Source } from "@/core/provenance/source"
import { createRatingEvent, type RatingEvent } from "@/core/provenance/ratingEvent"

/**
 * `Source` records are peripheral, not part of the entity/geometry transactional
 * quintet (ADR 0006, E2.4): a Source's lifecycle isn't tied to any one entity — many
 * entities can cite the same Source, and it should outlive any single one of them.
 * `Claim`s (which *are* entity-keyed) live in `useProjectStore` instead, cascade-deleted
 * alongside `drawnGeometries` for the same reason geometries are — see ProjectState.
 */
export interface ProvenanceState {
  sources: Source[]
  /** Phase 4 (v1.5): append-only audit trail, written on every rating change (`ratingEvent.ts`). */
  ratingEvents: RatingEvent[]
}

export interface ProvenanceActions {
  setSources(sources: Source[]): void
  resetSources(): void
  rateSourceReliability(sourceId: string, reliability: AdmiraltyReliability | null): void
  /** Creates-or-reuses a `Source` per URL by exact-match identity (ADR 0006). Returns the resulting records so a caller can resolve the id it needs (e.g. for a new Claim) without a second store read. */
  mergeUrls(urls: string[]): Source[]
  setRatingEvents(events: RatingEvent[]): void
  appendRatingEvent(event: RatingEvent): void
}

function initialState(): ProvenanceState {
  return { sources: [], ratingEvents: [] }
}

export const useProvenanceStore = create<ProvenanceState & ProvenanceActions>()(
  devtools(
    (set, get) => ({
      ...initialState(),

      setSources(sources) {
        set({ sources }, false, "setSources")
      },

      resetSources() {
        set(initialState(), false, "resetSources")
      },

      rateSourceReliability(sourceId, reliability) {
        set((s) => ({ sources: setSourceReliability(s.sources, sourceId, reliability) }), false, "rateSourceReliability")
        // A cleared rating (null) has nothing to log — only a set/changed letter is a rating event.
        if (reliability == null) return
        get().appendRatingEvent(
          createRatingEvent({
            targetType: "source",
            targetId: sourceId,
            kind: "reliability",
            value: reliability,
            assessor: { kind: "analyst" },
          }),
        )
      },

      mergeUrls(urls) {
        const sources = dedupeSources(urls, get().sources)
        set({ sources }, false, "mergeUrls")
        return sources
      },

      setRatingEvents(ratingEvents) {
        set({ ratingEvents }, false, "setRatingEvents")
      },

      appendRatingEvent(event) {
        set((s) => ({ ratingEvents: [...s.ratingEvents, event] }), false, "appendRatingEvent")
      },
    }),
    { name: "GabrielProvenanceStore", enabled: import.meta.env.DEV },
  ),
)
