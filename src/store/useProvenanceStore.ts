import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { setSourceReliability } from "@/core/provenance/admiralty"
import type { AdmiraltyReliability } from "@/core/provenance/admiralty"
import { dedupeSources, type Source } from "@/core/provenance/source"

/**
 * `Source` records are peripheral, not part of the entity/geometry transactional
 * quintet (ADR 0006, E2.4): a Source's lifecycle isn't tied to any one entity — many
 * entities can cite the same Source, and it should outlive any single one of them.
 * `Claim`s (which *are* entity-keyed) live in `useProjectStore` instead, cascade-deleted
 * alongside `drawnGeometries` for the same reason geometries are — see ProjectState.
 */
export interface ProvenanceState {
  sources: Source[]
}

export interface ProvenanceActions {
  setSources(sources: Source[]): void
  resetSources(): void
  rateSourceReliability(sourceId: string, reliability: AdmiraltyReliability | null): void
  /** Creates-or-reuses a `Source` per URL by exact-match identity (ADR 0006). Returns the resulting records so a caller can resolve the id it needs (e.g. for a new Claim) without a second store read. */
  mergeUrls(urls: string[]): Source[]
}

function initialState(): ProvenanceState {
  return { sources: [] }
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
      },

      mergeUrls(urls) {
        const sources = dedupeSources(urls, get().sources)
        set({ sources }, false, "mergeUrls")
        return sources
      },
    }),
    { name: "GabrielProvenanceStore", enabled: import.meta.env.DEV },
  ),
)
