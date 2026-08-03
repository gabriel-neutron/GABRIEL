import { beforeEach, describe, expect, it } from "vitest"
import { useProjectStore } from "./useProjectStore"
import { useProvenanceStore } from "./useProvenanceStore"
import type { Claim } from "@/core/provenance/claim"

/**
 * The store's three credibility actions, moved here verbatim from `useProjectStore.test.ts` when
 * that file was split to get back under the 300-line cap (`CONSTRAINTS.md:113`). They travel
 * together because they are one concern — ADR 0009's review queue — and because they are the
 * store's only actions that write to the peripheral `useProvenanceStore`, which is why their
 * implementations now live together in `projectClaimActions.ts` too.
 */

describe("useProjectStore.confirmClaimCredibility (ADR 0009 Confirm gate)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
    useProvenanceStore.getState().resetSources()
  })

  it("promotes an eligible claim to credibility 1 and logs a rating event", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        {
          id: "c-1",
          entityId: "e-1",
          field: "sources",
          value: null,
          sourceId: "src-1",
          credibility: 2,
          timestamp: null,
          credibilityMeta: {
            confidence: 0.8,
            rationale: "r",
            assessor: { kind: "ai" },
            updatedAt: "t",
            overridden: false,
            evidenceRefs: ["https://a.example", "https://b.example"],
            corroborationClusters: 2,
            statedAttribution: null,
            dates: ["2026-01-01"],
          },
        },
      ],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().confirmClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(1)
    expect(useProvenanceStore.getState().ratingEvents).toHaveLength(1)
    expect(useProvenanceStore.getState().ratingEvents[0]).toMatchObject({ targetType: "claim", targetId: "c-1", kind: "credibility", value: "1" })
  })

  it("does not log an event when the claim is ineligible (confirmCredibility is a no-op)", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null },
      ],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().confirmClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(2)
    expect(useProvenanceStore.getState().ratingEvents).toEqual([])
  })

  it("refuteClaimCredibility marks the claim overridden, logs a 'refuted' event, and leaves credibility unchanged", () => {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims: [
        { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: 2, timestamp: null },
      ],
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
    useProjectStore.getState().refuteClaimCredibility("c-1")
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(2)
    expect(useProjectStore.getState().claims[0]!.credibilityMeta?.overridden).toBe(true)
    expect(useProvenanceStore.getState().ratingEvents[0]).toMatchObject({ targetType: "claim", targetId: "c-1", kind: "credibility", value: "refuted" })
  })
})

describe("useProjectStore.applyCredibilityToClaims (detached credibility patch)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  const result = {
    credibility: 2 as const,
    meta: {
      confidence: 0.8,
      rationale: "r",
      assessor: { kind: "ai" as const },
      updatedAt: "2026-07-14T00:00:00.000Z",
      overridden: false,
      evidenceRefs: ["https://a.example"],
      corroborationClusters: 1,
      statedAttribution: null,
    },
  }

  function setupClaims(claims: Claim[]) {
    useProjectStore.getState().setProject({
      layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
      entities: [{ kind: "unit", id: "e-1", name: "A", layerId: "custom-1", parentId: null }],
      drawnGeometries: [],
      claims,
      relationships: [], integrityEvents: [],
      selectedEntityId: null,
    })
  }

  it("patches only the targeted claim id(s), leaving others untouched", () => {
    setupClaims([
      { id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null },
      { id: "c-2", entityId: "e-1", field: "sources", value: null, sourceId: "src-2", credibility: null, timestamp: null },
    ])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], result)
    const claims = useProjectStore.getState().claims
    expect(claims.find((c) => c.id === "c-1")?.credibility).toBe(2)
    expect(claims.find((c) => c.id === "c-2")?.credibility).toBeNull()
  })

  it("is a no-op when the result is null", () => {
    setupClaims([{ id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], null)
    expect(useProjectStore.getState().claims[0]!.credibility).toBeNull()
  })

  it("is a no-op when the claim id no longer exists (e.g. deleted before the assessment resolved)", () => {
    setupClaims([{ id: "c-1", entityId: "e-1", field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }])
    expect(() => useProjectStore.getState().applyCredibilityToClaims(["gone"], result)).not.toThrow()
    expect(useProjectStore.getState().claims[0]!.credibility).toBeNull()
  })

  it("does not clobber a claim already overridden by a human in the meantime", () => {
    setupClaims([
      {
        id: "c-1",
        entityId: "e-1",
        field: "sources",
        value: null,
        sourceId: "src-1",
        credibility: 1,
        timestamp: null,
        credibilityMeta: { ...result.meta, overridden: true, assessor: { kind: "analyst" } },
      },
    ])
    useProjectStore.getState().applyCredibilityToClaims(["c-1"], result)
    expect(useProjectStore.getState().claims[0]!.credibility).toBe(1)
  })
})
