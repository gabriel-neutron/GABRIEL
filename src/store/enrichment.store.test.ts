import { describe, expect, it } from "vitest"
import {
  acceptProposalToOverlay,
  clearFeatureEnrichmentState,
  completeEnrichmentRun,
  hasPendingProposalsForFeature,
  INITIAL_ENRICHMENT_UI_STATE,
  rejectProposal,
  startEnrichmentRun,
} from "./enrichment.store"
import { CORE_ENRICHMENT_FIELDS } from "@/types/enrichment.types"
import type { EnrichmentResponse } from "@/types/enrichment.types"

describe("enrichment store", () => {
  it("keeps the minimal core enrichment field contract", () => {
    expect(CORE_ENRICHMENT_FIELDS).toEqual(["notes", "sources", "militaryUnitId", "osmRelationId"])
  })

  it("starts a run and updates status", () => {
    const next = startEnrichmentRun(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      prompt: "Find commander and deployment area",
      maxDepth: 2,
    })
    expect(next.run.status).toBe("running")
    expect(next.run.featureId).toBe("feature-1")
  })

  it("applies accepted proposal to overlay", () => {
    const next = acceptProposalToOverlay(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      field: "commander",
      value: "Colonel Example",
    })
    expect(next.overlay["feature-1"]?.commander).toBe("Colonel Example")
    expect(next.decisions["feature-1"]?.commander).toBe("accepted")
  })

  it("marks rejected proposal decision", () => {
    const started = startEnrichmentRun(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      prompt: "Find commander and deployment area",
      maxDepth: 2,
    })
    const rejected = rejectProposal(started, {
      featureId: "feature-1",
      field: "commander",
    })
    expect(rejected.decisions["feature-1"]?.commander).toBe("rejected")
  })

  it("completes run with response payload", () => {
    const started = startEnrichmentRun(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      prompt: "Find commander and deployment area",
      maxDepth: 2,
    })
    const response: EnrichmentResponse = {
      status: "partial",
      featureId: "feature-1",
      depthUsed: 2,
      proposals: [],
      unresolvedFields: ["commander"],
      unresolvedReasons: { commander: "no-evidence" },
      notes: "No reliable source",
      queryTrace: ["query a"],
      processingTimeMs: 1000,
    }
    const completed = completeEnrichmentRun(started, response)
    expect(completed.run.status).toBe("partial")
    expect(completed.run.unresolvedFields).toEqual(["commander"])
    expect(completed.run.unresolvedReasons).toEqual({ commander: "no-evidence" })
  })

  it("detects unresolved pending proposals for feature", () => {
    const started = startEnrichmentRun(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      prompt: "Find commander and deployment area",
      maxDepth: 2,
    })
    const response: EnrichmentResponse = {
      status: "success",
      featureId: "feature-1",
      depthUsed: 1,
      proposals: [
        {
          field: "commander",
          currentValue: null,
          proposedValue: "Colonel Example",
          sources: [
            {
              url: "https://example.com",
              title: "Example",
              snippet: "Example snippet with enough characters.",
              domainType: "web",
            },
          ],
          reasoning: "Evidence-backed proposal",
        },
      ],
      unresolvedFields: [],
      unresolvedReasons: {},
      notes: "",
      queryTrace: [],
      processingTimeMs: 100,
    }
    const completed = completeEnrichmentRun(started, response)
    expect(hasPendingProposalsForFeature(completed, "feature-1", completed.run.proposals)).toBe(true)
    const accepted = acceptProposalToOverlay(completed, {
      featureId: "feature-1",
      field: "commander",
      value: "Colonel Example",
    })
    expect(hasPendingProposalsForFeature(accepted, "feature-1", accepted.run.proposals)).toBe(false)
  })

  it("clears overlay and decisions for a feature", () => {
    const withOverlay = acceptProposalToOverlay(INITIAL_ENRICHMENT_UI_STATE, {
      featureId: "feature-1",
      field: "commander",
      value: "Colonel Example",
    })
    const cleared = clearFeatureEnrichmentState(withOverlay, "feature-1")
    expect(cleared.overlay["feature-1"]).toBeUndefined()
    expect(cleared.decisions["feature-1"]).toBeUndefined()
  })
})

