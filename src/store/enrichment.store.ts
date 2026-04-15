import type {
  EnrichmentError,
  EnrichmentProposal,
  EnrichmentResponse,
  EnrichmentRunStatus,
} from "@/types/enrichment.types"

export type ProposalDecision = "accepted" | "rejected" | "pending"

export type EnrichmentRunState = {
  status: EnrichmentRunStatus
  featureId: string | null
  prompt: string
  maxDepth: number
  depthUsed: number
  queryTrace: string[]
  processingTimeMs: number
  proposals: EnrichmentProposal[]
  unresolvedFields: string[]
  notes: string
  error: EnrichmentError | null
  startedAtMs: number | null
  finishedAtMs: number | null
}

export type OverlayByFeature = Record<string, Record<string, unknown>>
export type ProposalDecisionsByFeature = Record<string, Record<string, ProposalDecision>>

export type EnrichmentUiState = {
  run: EnrichmentRunState
  overlay: OverlayByFeature
  decisions: ProposalDecisionsByFeature
}

export const INITIAL_ENRICHMENT_RUN: EnrichmentRunState = {
  status: "idle",
  featureId: null,
  prompt: "",
  maxDepth: 2,
  depthUsed: 0,
  queryTrace: [],
  processingTimeMs: 0,
  proposals: [],
  unresolvedFields: [],
  notes: "",
  error: null,
  startedAtMs: null,
  finishedAtMs: null,
}

export const INITIAL_ENRICHMENT_UI_STATE: EnrichmentUiState = {
  run: INITIAL_ENRICHMENT_RUN,
  overlay: {},
  decisions: {},
}

export function startEnrichmentRun(
  state: EnrichmentUiState,
  args: { featureId: string; prompt: string; maxDepth: number },
): EnrichmentUiState {
  return {
    ...state,
    run: {
      ...INITIAL_ENRICHMENT_RUN,
      status: "running",
      featureId: args.featureId,
      prompt: args.prompt,
      maxDepth: args.maxDepth,
      startedAtMs: Date.now(),
    },
  }
}

export function updateEnrichmentProgress(
  state: EnrichmentUiState,
  progress: { depthUsed: number; queryTrace: string[] },
): EnrichmentUiState {
  if (state.run.status !== "running") return state
  return {
    ...state,
    run: {
      ...state.run,
      depthUsed: progress.depthUsed,
      queryTrace: progress.queryTrace,
    },
  }
}

export function completeEnrichmentRun(
  state: EnrichmentUiState,
  response: EnrichmentResponse,
): EnrichmentUiState {
  return {
    ...state,
    run: {
      ...state.run,
      status: response.status,
      featureId: response.featureId,
      depthUsed: response.depthUsed,
      queryTrace: response.queryTrace,
      processingTimeMs: response.processingTimeMs,
      proposals: response.proposals,
      unresolvedFields: response.unresolvedFields,
      notes: response.notes,
      error: null,
      finishedAtMs: Date.now(),
    },
    decisions: {
      ...state.decisions,
      [response.featureId]: Object.fromEntries(
        response.proposals.map((proposal) => [proposal.field, "pending" as const]),
      ),
    },
  }
}

export function failEnrichmentRun(
  state: EnrichmentUiState,
  error: EnrichmentError,
): EnrichmentUiState {
  return {
    ...state,
    run: {
      ...state.run,
      status: "failed",
      error,
      finishedAtMs: Date.now(),
    },
  }
}

export function resetEnrichmentRun(state: EnrichmentUiState): EnrichmentUiState {
  return {
    ...state,
    run: INITIAL_ENRICHMENT_RUN,
  }
}

export function setProposalDecision(
  state: EnrichmentUiState,
  args: { featureId: string; field: string; decision: ProposalDecision },
): EnrichmentUiState {
  const current = state.decisions[args.featureId] ?? {}
  return {
    ...state,
    decisions: {
      ...state.decisions,
      [args.featureId]: {
        ...current,
        [args.field]: args.decision,
      },
    },
  }
}

export function acceptProposalToOverlay(
  state: EnrichmentUiState,
  args: { featureId: string; field: string; value: unknown },
): EnrichmentUiState {
  const featureOverlay = state.overlay[args.featureId] ?? {}
  return {
    ...state,
    overlay: {
      ...state.overlay,
      [args.featureId]: {
        ...featureOverlay,
        [args.field]: args.value,
      },
    },
    decisions: {
      ...state.decisions,
      [args.featureId]: {
        ...(state.decisions[args.featureId] ?? {}),
        [args.field]: "accepted",
      },
    },
  }
}

export function rejectProposal(
  state: EnrichmentUiState,
  args: { featureId: string; field: string },
): EnrichmentUiState {
  return setProposalDecision(state, {
    featureId: args.featureId,
    field: args.field,
    decision: "rejected",
  })
}

export function clearOverlayForFeature(
  state: EnrichmentUiState,
  featureId: string,
): EnrichmentUiState {
  if (!(featureId in state.overlay)) return state
  const nextOverlay = { ...state.overlay }
  delete nextOverlay[featureId]
  return { ...state, overlay: nextOverlay }
}

export function getOverlayValue(
  state: EnrichmentUiState,
  featureId: string,
  field: string,
): unknown {
  return state.overlay[featureId]?.[field]
}

export function getFeatureOverlay(
  state: EnrichmentUiState,
  featureId: string | null,
): Record<string, unknown> {
  if (!featureId) return {}
  return state.overlay[featureId] ?? {}
}

export function hasPendingProposalsForFeature(
  state: EnrichmentUiState,
  featureId: string,
  proposals: EnrichmentProposal[],
): boolean {
  const decisions = state.decisions[featureId] ?? {}
  return proposals.some((proposal) => (decisions[proposal.field] ?? "pending") === "pending")
}

export function clearFeatureEnrichmentState(
  state: EnrichmentUiState,
  featureId: string,
): EnrichmentUiState {
  const nextOverlay = { ...state.overlay }
  const nextDecisions = { ...state.decisions }
  delete nextOverlay[featureId]
  delete nextDecisions[featureId]
  return {
    ...state,
    overlay: nextOverlay,
    decisions: nextDecisions,
    run: state.run.featureId === featureId ? INITIAL_ENRICHMENT_RUN : state.run,
  }
}

