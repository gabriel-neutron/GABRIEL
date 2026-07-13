import { describe, expect, it } from "vitest"
import {
  advanceReviewQueue,
  applyBatchOutcome,
  hasProcessedEntities,
  INITIAL_RESEARCH_PROGRESS_STATE,
  markEntityCompleted,
  markEntityRunning,
  startResearchBatch,
} from "./researchProgress.store"

describe("research progress store", () => {
  it("starts a fresh batch marking new entities pending", () => {
    const next = startResearchBatch(INITIAL_RESEARCH_PROGRESS_STATE, {
      orderedIds: ["entity-1", "entity-2"],
      recentAnalyzedEntityIds: new Set(),
    })
    expect(next.entityStatuses).toEqual({ "entity-1": "pending", "entity-2": "pending" })
  })

  it("marks entities within the skip-recency window as skipped-recent on batch start", () => {
    const next = startResearchBatch(INITIAL_RESEARCH_PROGRESS_STATE, {
      orderedIds: ["entity-1", "entity-2"],
      recentAnalyzedEntityIds: new Set(["entity-1"]),
    })
    expect(next.entityStatuses["entity-1"]).toBe("skipped-recent")
    expect(next.entityStatuses["entity-2"]).toBe("pending")
  })

  it("preserves a previously-recorded status when starting a continuation batch after processing", () => {
    const completed = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 2,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    const continued = startResearchBatch(completed, {
      orderedIds: ["entity-1", "entity-2"],
      recentAnalyzedEntityIds: new Set(),
    })
    expect(continued.entityStatuses["entity-1"]).toBe("done")
    expect(continued.entityStatuses["entity-2"]).toBe("pending")
  })

  it("defaults a processed entity with no recorded status to done-empty on batch start", () => {
    const state = {
      ...INITIAL_RESEARCH_PROGRESS_STATE,
      processedEntityIds: { "entity-1": true as const },
    }
    const next = startResearchBatch(state, {
      orderedIds: ["entity-1"],
      recentAnalyzedEntityIds: new Set(),
    })
    expect(next.entityStatuses["entity-1"]).toBe("done-empty")
  })

  it("marks an entity running", () => {
    const next = markEntityRunning(INITIAL_RESEARCH_PROGRESS_STATE, "entity-1")
    expect(next.entityStatuses["entity-1"]).toBe("running")
  })

  it("marks a completed entity with proposals as done, enqueues it, and accumulates usage", () => {
    const next = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 1,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    expect(next.entityStatuses["entity-1"]).toBe("done")
    expect(next.reviewQueue).toEqual(["entity-1"])
    expect(next.processedEntityIds["entity-1"]).toBe(true)
    expect(next.totalUsage).toEqual({ inputTokens: 10, outputTokens: 5 })
  })

  it("marks a completed entity with no proposals as done-empty and does not enqueue it", () => {
    const next = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 0,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    expect(next.entityStatuses["entity-1"]).toBe("done-empty")
    expect(next.reviewQueue).toEqual([])
  })

  it("does not duplicate an entity already in the review queue when completed twice", () => {
    const once = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 1,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    const twice = markEntityCompleted(once, {
      entityId: "entity-1",
      proposalsCount: 1,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    expect(twice.reviewQueue).toEqual(["entity-1"])
  })

  it("accumulates usage across multiple completed entities", () => {
    const first = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 0,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    const second = markEntityCompleted(first, {
      entityId: "entity-2",
      proposalsCount: 0,
      usage: { estimatedInputTokens: 3, estimatedOutputTokens: 2 },
    })
    expect(second.totalUsage).toEqual({ inputTokens: 13, outputTokens: 7 })
  })

  it("applies failed status to failed entities and marks them processed", () => {
    const next = applyBatchOutcome(INITIAL_RESEARCH_PROGRESS_STATE, {
      failedEntityIds: ["entity-1"],
      skippedRichEntityIds: [],
      skippedEntityIds: [],
    })
    expect(next.entityStatuses["entity-1"]).toBe("failed")
    expect(next.processedEntityIds["entity-1"]).toBe(true)
  })

  it("applies skipped-rich status without marking the entity processed", () => {
    const next = applyBatchOutcome(INITIAL_RESEARCH_PROGRESS_STATE, {
      failedEntityIds: [],
      skippedRichEntityIds: ["entity-1"],
      skippedEntityIds: [],
    })
    expect(next.entityStatuses["entity-1"]).toBe("skipped-rich")
    expect(next.processedEntityIds["entity-1"]).toBeUndefined()
  })

  it("applies skipped-abort status to an entity not yet processed", () => {
    const next = applyBatchOutcome(INITIAL_RESEARCH_PROGRESS_STATE, {
      failedEntityIds: [],
      skippedRichEntityIds: [],
      skippedEntityIds: ["entity-1"],
    })
    expect(next.entityStatuses["entity-1"]).toBe("skipped-abort")
    expect(next.processedEntityIds["entity-1"]).toBeUndefined()
  })

  it("does not overwrite an already-processed entity's status when it also appears in skippedEntityIds", () => {
    const completed = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 1,
      usage: { estimatedInputTokens: 1, estimatedOutputTokens: 1 },
    })
    const next = applyBatchOutcome(completed, {
      failedEntityIds: [],
      skippedRichEntityIds: [],
      skippedEntityIds: ["entity-1"],
    })
    expect(next.entityStatuses["entity-1"]).toBe("done")
  })

  it("keeps completed entities done and re-queues aborted ones as pending on continue after abort", () => {
    const started = startResearchBatch(INITIAL_RESEARCH_PROGRESS_STATE, {
      orderedIds: ["entity-1", "entity-2"],
      recentAnalyzedEntityIds: new Set(),
    })
    const completed = markEntityCompleted(started, {
      entityId: "entity-1",
      proposalsCount: 1,
      usage: { estimatedInputTokens: 10, estimatedOutputTokens: 5 },
    })
    const aborted = applyBatchOutcome(completed, {
      failedEntityIds: [],
      skippedRichEntityIds: [],
      skippedEntityIds: ["entity-2"],
    })
    expect(aborted.entityStatuses).toEqual({ "entity-1": "done", "entity-2": "skipped-abort" })

    const continued = startResearchBatch(aborted, {
      orderedIds: ["entity-1", "entity-2"],
      recentAnalyzedEntityIds: new Set(),
    })
    expect(continued.entityStatuses["entity-1"]).toBe("done")
    expect(continued.entityStatuses["entity-2"]).toBe("pending")
    expect(continued.reviewQueue).toEqual(["entity-1"])
    expect(continued.totalUsage).toEqual({ inputTokens: 10, outputTokens: 5 })
  })

  it("advances the review queue by removing the first entry", () => {
    const withQueue = { ...INITIAL_RESEARCH_PROGRESS_STATE, reviewQueue: ["entity-1", "entity-2"] }
    const next = advanceReviewQueue(withQueue)
    expect(next.reviewQueue).toEqual(["entity-2"])
  })

  it("reports no processed entities on the initial state", () => {
    expect(hasProcessedEntities(INITIAL_RESEARCH_PROGRESS_STATE)).toBe(false)
  })

  it("reports processed entities once at least one entity has been recorded", () => {
    const next = markEntityCompleted(INITIAL_RESEARCH_PROGRESS_STATE, {
      entityId: "entity-1",
      proposalsCount: 0,
      usage: { estimatedInputTokens: 0, estimatedOutputTokens: 0 },
    })
    expect(hasProcessedEntities(next)).toBe(true)
  })
})
