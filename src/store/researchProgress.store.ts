export type EntityResearchStatus =
  | "pending" // in BFS queue, not yet started
  | "running" // currently being enriched
  | "done" // completed with actionable proposals
  | "done-empty" // completed, no proposals found
  | "failed" // attempted but failed
  | "skipped-rich" // skipped — entity already has enough information
  | "skipped-recent" // skipped — entity was analyzed recently
  | "skipped-abort" // skipped — run was stopped before this entity

export type ResearchProgressState = {
  entityStatuses: Record<string, EntityResearchStatus>
  reviewQueue: string[]
  processedEntityIds: Record<string, true>
  totalUsage: { inputTokens: number; outputTokens: number }
}

export const INITIAL_RESEARCH_PROGRESS_STATE: ResearchProgressState = {
  entityStatuses: {},
  reviewQueue: [],
  processedEntityIds: {},
  totalUsage: { inputTokens: 0, outputTokens: 0 },
}

export function startResearchBatch(
  state: ResearchProgressState,
  args: { orderedIds: string[]; recentAnalyzedEntityIds: ReadonlySet<string> },
): ResearchProgressState {
  const entityStatuses: Record<string, EntityResearchStatus> = {}
  for (const id of args.orderedIds) {
    if (state.processedEntityIds[id]) {
      entityStatuses[id] = state.entityStatuses[id] ?? "done-empty"
    } else if (args.recentAnalyzedEntityIds.has(id)) {
      entityStatuses[id] = "skipped-recent"
    } else {
      entityStatuses[id] = "pending"
    }
  }
  return { ...state, entityStatuses }
}

export function markEntityRunning(
  state: ResearchProgressState,
  entityId: string,
): ResearchProgressState {
  return {
    ...state,
    entityStatuses: { ...state.entityStatuses, [entityId]: "running" },
  }
}

export function markEntityCompleted(
  state: ResearchProgressState,
  args: {
    entityId: string
    proposalsCount: number
    usage: { estimatedInputTokens: number; estimatedOutputTokens: number }
  },
): ResearchProgressState {
  const hasProposals = args.proposalsCount > 0
  const reviewQueue =
    hasProposals && !state.reviewQueue.includes(args.entityId)
      ? [...state.reviewQueue, args.entityId]
      : state.reviewQueue

  return {
    entityStatuses: {
      ...state.entityStatuses,
      [args.entityId]: hasProposals ? "done" : "done-empty",
    },
    reviewQueue,
    processedEntityIds: { ...state.processedEntityIds, [args.entityId]: true },
    totalUsage: {
      inputTokens: state.totalUsage.inputTokens + args.usage.estimatedInputTokens,
      outputTokens: state.totalUsage.outputTokens + args.usage.estimatedOutputTokens,
    },
  }
}

export function applyBatchOutcome(
  state: ResearchProgressState,
  result: {
    failedEntityIds: string[]
    skippedRichEntityIds: string[]
    skippedEntityIds: string[]
  },
): ResearchProgressState {
  const processedEntityIds = { ...state.processedEntityIds }
  const entityStatuses = { ...state.entityStatuses }
  for (const id of result.failedEntityIds) {
    processedEntityIds[id] = true
    entityStatuses[id] = "failed"
  }
  for (const id of result.skippedRichEntityIds) entityStatuses[id] = "skipped-rich"
  for (const id of result.skippedEntityIds) {
    if (!processedEntityIds[id]) entityStatuses[id] = "skipped-abort"
  }

  return { ...state, entityStatuses, processedEntityIds }
}

export function advanceReviewQueue(state: ResearchProgressState): ResearchProgressState {
  return { ...state, reviewQueue: state.reviewQueue.slice(1) }
}

export function hasProcessedEntities(state: ResearchProgressState): boolean {
  return Object.keys(state.processedEntityIds).length > 0
}
