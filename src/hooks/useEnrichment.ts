import { useCallback, useMemo, useRef, useState } from "react"
import { buildDefaultEnrichmentPrompt, DEFAULT_ENRICHMENT_OUTPUT_SCHEMA, ENRICHMENT_MAX_DEPTH_DEFAULT, runEnrichment } from "@/services/enrichment"
import { toEnrichmentFeature, toEnrichmentContext } from "@/utils/enrichmentAdapters"
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
  setProposalDecision,
  startEnrichmentRun,
  updateEnrichmentProgress,
  type EnrichmentUiState,
} from "@/store/enrichment.store"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal, EnrichmentResponse } from "@/types/enrichment.types"
import { buildAcceptedPatch } from "@/utils/enrichmentApply"


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
  const [isCancellingRun, setIsCancellingRun] = useState(false)
  const runAbortControllerRef = useRef<AbortController | null>(null)
  const runEpochRef = useRef(0)
  const closeAfterCancelRef = useRef(false)

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
    closeAfterCancelRef.current = false
    setDraftPrompt(buildDefaultEnrichmentPrompt(feature, context))
    setIsDrawerOpen(true)
  }, [context, feature])

  const applyAcceptedProposals = useCallback(
    (runFeatureId: string) => {
      if (!onApplyAccepted) return
      const patch = buildAcceptedPatch({
        decisions: state.decisions[runFeatureId] ?? {},
        overlay: state.overlay[runFeatureId] ?? {},
        proposals: state.run.proposals,
        entity: entities.find((e) => e.id === runFeatureId) ?? null,
      })
      if (patch != null) onApplyAccepted(runFeatureId, patch)
    },
    [entities, onApplyAccepted, state],
  )

  const closeDrawer = useCallback(() => {
    const runFeatureId = state.run.featureId
    if (state.run.status === "running") {
      closeAfterCancelRef.current = true
      setIsCancellingRun(true)
      setCloseNotice("Cancelling enrichment...")
      runAbortControllerRef.current?.abort()
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

    closeAfterCancelRef.current = false
    setCloseNotice(null)
    setIsCancellingRun(false)
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
    setState((current) => resetEnrichmentRun(current))
    setCloseNotice(null)
    setIsCancellingRun(false)
    closeAfterCancelRef.current = false
    setIsDrawerOpen(false)
  }, [])

  const run = useCallback(async () => {
    if (!selectedEntity || !feature || !context) return
    closeAfterCancelRef.current = false
    setCloseNotice(null)
    const runEpoch = runEpochRef.current + 1
    runEpochRef.current = runEpoch
    const abortController = new AbortController()
    runAbortControllerRef.current = abortController
    setState((current) =>
      startEnrichmentRun(current, {
        featureId: selectedEntity.id,
        prompt: draftPrompt,
        maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
      }),
    )
    try {
      const result = await runEnrichment(
        {
          prompt: draftPrompt,
          feature,
          context,
          outputSchema: DEFAULT_ENRICHMENT_OUTPUT_SCHEMA,
          maxDepth: ENRICHMENT_MAX_DEPTH_DEFAULT,
        },
        {
          signal: abortController.signal,
          onProgress: (progress) => {
            if (runEpochRef.current !== runEpoch) return
            setState((current) => updateEnrichmentProgress(current, progress))
          },
        },
      )
      if (runEpochRef.current !== runEpoch) return
      setState((current) => completeEnrichmentRun(current, result.response))
      if (result.usage.estimatedInputTokens + result.usage.estimatedOutputTokens > 0) {
        console.debug("Enrichment usage", result.usage)
      }
    } catch (error) {
      if (runEpochRef.current !== runEpoch) return
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        setState((current) => resetEnrichmentRun(current))
        setIsCancellingRun(false)
        if (closeAfterCancelRef.current) {
          setCloseNotice(null)
          closeAfterCancelRef.current = false
          setIsDrawerOpen(false)
        } else {
          setCloseNotice("Enrichment cancelled.")
        }
        return
      }
      const message = error instanceof Error ? error.message : "Unknown enrichment failure"
      setState((current) =>
        failEnrichmentRun(current, {
          code: "UNKNOWN",
          message: "Enrichment failed",
          details: message,
        }),
      )
      setCloseNotice(null)
    } finally {
      if (runEpochRef.current === runEpoch) {
        runAbortControllerRef.current = null
        setIsCancellingRun(false)
      }
    }
  }, [context, draftPrompt, feature, selectedEntity])

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

  const ignore = useCallback(
    (proposal: EnrichmentProposal) => {
      if (!currentFeatureId) return
      setCloseNotice(null)
      setState((current) =>
        setProposalDecision(current, {
          featureId: currentFeatureId,
          field: proposal.field,
          decision: "pending",
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
    state,
    isDrawerOpen,
    draftPrompt,
    setDraftPrompt,
    openDrawer,
    closeDrawer,
    run,
    accept,
    reject,
    ignore,
    clearOverlayForSelected,
    loadBatchResult,
    closeNotice,
    isCancellingRun,
    allProposalsResolved,
    advanceBatchReview,
    forceCloseDrawer,
  }
}

