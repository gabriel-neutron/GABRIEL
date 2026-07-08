import { useCallback, useMemo, useRef, useState } from "react"
import { buildDefaultEnrichmentPrompt, buildEnrichmentRequest, ENRICHMENT_MAX_DEPTH_DEFAULT, runEnrichment } from "@/modules/enrichment/services"
import { toEnrichmentFeature, toEnrichmentContext } from "@/modules/enrichment/services/enrichmentAdapters"
import {
  acceptProposalToOverlay,
  clearFeatureEnrichmentState,
  completeEnrichmentRun,
  clearOverlayForFeature,
  failEnrichmentRun,
  getFeatureOverlay,
  hasPendingProposalsForFeature,
  INITIAL_ENRICHMENT_UI_STATE,
  rejectProposal,
  resetEnrichmentRun,
  startEnrichmentRun,
  updateEnrichmentProgress,
  type EnrichmentUiState,
} from "@/store/enrichment.store"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal, EnrichmentResponse } from "@/types/enrichment.types"
import { buildAcceptedPatch } from "@/modules/enrichment/services/enrichmentApply"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { createEnrichmentRunner } from "./enrichmentRunner"

export type UseEnrichmentArgs = {
  entities: MapEntity[]
  drawnGeometries: DrawnGeometry[]
  selectedEntityId: string | null
  onApplyAccepted?: (entityId: string, patch: Partial<MapEntity>) => void
}

export function useEnrichment({
  entities,
  drawnGeometries,
  selectedEntityId,
  onApplyAccepted,
}: UseEnrichmentArgs) {
  const [state, setState] = useState<EnrichmentUiState>(INITIAL_ENRICHMENT_UI_STATE)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [draftPrompt, setDraftPrompt] = useState("")
  const [closeNotice, setCloseNotice] = useState<string | null>(null)
  const runnerRef = useRef(createEnrichmentRunner(runEnrichment))
  const claims = useProjectStore((s) => s.claims)
  const addClaims = useProjectStore((s) => s.addClaims)

  const selectedEntity = useMemo(
    () => (selectedEntityId ? entities.find((entity) => entity.id === selectedEntityId) ?? null : null),
    [entities, selectedEntityId],
  )
  const currentFeatureId = state.run.featureId ?? selectedEntity?.id ?? null
  const feature = useMemo(
    () => (selectedEntity ? toEnrichmentFeature(selectedEntity, drawnGeometries) : null),
    [selectedEntity, drawnGeometries],
  )
  const context = useMemo(
    () => (selectedEntity ? toEnrichmentContext(selectedEntity, entities) : null),
    [entities, selectedEntity],
  )
  const overlay = useMemo(
    () => getFeatureOverlay(state, selectedEntityId),
    [selectedEntityId, state],
  )

  const openDrawer = useCallback(() => {
    if (!feature || !context) return
    setCloseNotice(null)
    setDraftPrompt(buildDefaultEnrichmentPrompt(feature, context))
    setIsDrawerOpen(true)
  }, [context, feature])

  const applyAcceptedProposals = useCallback(
    (runFeatureId: string) => {
      // Preserved exactly: claims/sources are not committed at all when no callback is
      // wired, same as the pre-E2.6 behavior of never touching `entity.sources` either.
      if (!onApplyAccepted) return
      const result = buildAcceptedPatch({
        decisions: state.decisions[runFeatureId] ?? {},
        overlay: state.overlay[runFeatureId] ?? {},
        proposals: state.run.proposals,
        entity: entities.find((e) => e.id === runFeatureId) ?? null,
        existingClaims: claims.filter((c) => c.entityId === runFeatureId),
        existingSources: useProvenanceStore.getState().sources,
      })
      if (!result) return
      if (result.newSources.length > 0) {
        useProvenanceStore
          .getState()
          .setSources([...useProvenanceStore.getState().sources, ...result.newSources])
      }
      if (result.newClaims.length > 0) addClaims(result.newClaims)
      if (result.patch != null) onApplyAccepted(runFeatureId, result.patch)
    },
    [entities, onApplyAccepted, state, claims, addClaims],
  )

  const closeDrawer = useCallback(() => {
    const runFeatureId = state.run.featureId
    if (state.run.status === "running") {
      runnerRef.current.requestCloseDuringRun()
      setCloseNotice("Cancelling enrichment...")
      return { closed: false as const, reason: "cancelling" as const }
    }

    if (runFeatureId && hasPendingProposalsForFeature(state, runFeatureId, state.run.proposals)) {
      setCloseNotice("Resolve all proposals before closing.")
      return { closed: false as const, reason: "pending-proposals" as const }
    }

    if (runFeatureId) {
      applyAcceptedProposals(runFeatureId)
      setState((current) => clearFeatureEnrichmentState(current, runFeatureId))
    } else {
      setState((current) => resetEnrichmentRun(current))
    }

    setCloseNotice(null)
    setIsDrawerOpen(false)
    return { closed: true as const, reason: "closed" as const }
  }, [applyAcceptedProposals, state])

  const allProposalsResolved = useMemo(() => {
    if (!isDrawerOpen) return false
    if (state.run.proposals.length === 0) return false
    const featureId = state.run.featureId
    if (!featureId) return false
    return !hasPendingProposalsForFeature(state, featureId, state.run.proposals)
  }, [isDrawerOpen, state])

  const advanceBatchReview = useCallback(() => {
    const runFeatureId = state.run.featureId
    if (!runFeatureId) return
    applyAcceptedProposals(runFeatureId)
    setState((current) => clearFeatureEnrichmentState(current, runFeatureId))
  }, [applyAcceptedProposals, state])

  const forceCloseDrawer = useCallback(() => {
    runnerRef.current.cancelNow()
    setState((current) => resetEnrichmentRun(current))
    setCloseNotice(null)
    setIsDrawerOpen(false)
  }, [])

  const run = useCallback(async () => {
    if (!selectedEntity || !feature || !context) return
    if (state.run.status === "running" || runnerRef.current.isRunning()) return
    setCloseNotice(null)
    setState((current) =>
      startEnrichmentRun(current, {
        featureId: selectedEntity.id,
        prompt: draftPrompt,
        maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
      }),
    )
    await runnerRef.current.run(
      buildEnrichmentRequest(selectedEntity, entities, drawnGeometries, { prompt: draftPrompt, claims }),
      {
        onProgress: (progress) => {
          setState((current) => updateEnrichmentProgress(current, progress))
        },
        onSuccess: (response, usage) => {
          setState((current) => completeEnrichmentRun(current, response))
          if (usage.estimatedInputTokens + usage.estimatedOutputTokens > 0) {
            console.debug("Enrichment usage", usage)
          }
        },
        onAbort: (closeAfterCancel) => {
          setState((current) => resetEnrichmentRun(current))
          if (closeAfterCancel) {
            setCloseNotice(null)
            setIsDrawerOpen(false)
          } else {
            setCloseNotice("Enrichment cancelled.")
          }
        },
        onError: (message) => {
          setState((current) =>
            failEnrichmentRun(current, {
              code: "UNKNOWN",
              message: "Enrichment failed",
              details: message,
            }),
          )
          setCloseNotice(null)
        },
        onFinally: () => {},
      },
    )
  }, [context, draftPrompt, drawnGeometries, entities, feature, selectedEntity, state.run.status, claims])

  const accept = useCallback(
    (proposal: EnrichmentProposal) => {
      if (!currentFeatureId) return
      setState((current) =>
        acceptProposalToOverlay(current, {
          featureId: currentFeatureId,
          field: proposal.field,
          value: proposal.proposedValue,
        }),
      )
    },
    [currentFeatureId],
  )

  const reject = useCallback(
    (proposal: EnrichmentProposal) => {
      if (!currentFeatureId) return
      setCloseNotice(null)
      setState((current) =>
        rejectProposal(current, {
          featureId: currentFeatureId,
          field: proposal.field,
        }),
      )
    },
    [currentFeatureId],
  )

  const clearOverlayForSelected = useCallback(() => {
    if (!selectedEntity) return
    setState((current) => clearOverlayForFeature(current, selectedEntity.id))
  }, [selectedEntity])

  const loadBatchResult = useCallback((response: EnrichmentResponse) => {
    setState((current) => completeEnrichmentRun(current, response))
    setIsDrawerOpen(true)
  }, [])

  return {
    selectedEntityId,
    selectedEntity,
    feature,
    context,
    overlay,
    isDrawerOpen,
    draftPrompt,
    setDraftPrompt,
    openDrawer,
    closeDrawer,
    run,
    accept,
    reject,
    clearOverlayForSelected,
    loadBatchResult,
    closeNotice,
    allProposalsResolved,
    advanceBatchReview,
    forceCloseDrawer,
    runStatus: state.run.status,
    proposals: state.run.proposals,
    queryTrace: state.run.queryTrace,
    depthUsed: state.run.depthUsed,
    unresolvedFields: state.run.unresolvedFields,
    unresolvedReasons: state.run.unresolvedReasons,
    conflicts: state.run.conflicts,
    notes: state.run.notes,
    runError: state.run.error?.details ?? null,
    decisions: selectedEntityId ? (state.decisions[selectedEntityId] ?? {}) : {},
  }
}

