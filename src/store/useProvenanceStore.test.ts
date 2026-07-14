import { beforeEach, describe, expect, it } from "vitest"
import { useProvenanceStore } from "./useProvenanceStore"
import type { Source } from "@/core/provenance/source"

const sources: Source[] = [
  { id: "src-1", url: "https://a.example", domainType: "web", reliability: null },
  { id: "src-2", url: "https://b.example", domainType: "web", reliability: null },
]

describe("useProvenanceStore", () => {
  beforeEach(() => {
    useProvenanceStore.getState().resetSources()
  })

  it("starts empty", () => {
    expect(useProvenanceStore.getState().sources).toEqual([])
  })

  it("setSources replaces the whole array", () => {
    useProvenanceStore.getState().setSources(sources)
    expect(useProvenanceStore.getState().sources).toEqual(sources)
  })

  it("rateSourceReliability sets the rating on the matching source only", () => {
    useProvenanceStore.getState().setSources(sources)
    useProvenanceStore.getState().rateSourceReliability("src-1", "B")
    const state = useProvenanceStore.getState().sources
    expect(state.find((s) => s.id === "src-1")?.reliability).toBe("B")
    expect(state.find((s) => s.id === "src-2")?.reliability).toBeNull()
  })

  it("resetSources clears back to empty", () => {
    useProvenanceStore.getState().setSources(sources)
    useProvenanceStore.getState().resetSources()
    expect(useProvenanceStore.getState().sources).toEqual([])
  })

  it("rateSourceReliability appends a rating event for a human-set letter", () => {
    useProvenanceStore.getState().setSources(sources)
    useProvenanceStore.getState().rateSourceReliability("src-1", "B")
    const events = useProvenanceStore.getState().ratingEvents
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ targetType: "source", targetId: "src-1", kind: "reliability", value: "B", assessor: { kind: "analyst" } })
  })

  it("rateSourceReliability does not log an event when clearing a rating to null", () => {
    useProvenanceStore.getState().setSources(sources)
    useProvenanceStore.getState().rateSourceReliability("src-1", "B")
    useProvenanceStore.getState().rateSourceReliability("src-1", null)
    expect(useProvenanceStore.getState().ratingEvents).toHaveLength(1)
  })

  it("resetSources also clears the rating event log", () => {
    useProvenanceStore.getState().setSources(sources)
    useProvenanceStore.getState().rateSourceReliability("src-1", "B")
    useProvenanceStore.getState().resetSources()
    expect(useProvenanceStore.getState().ratingEvents).toEqual([])
  })
})
