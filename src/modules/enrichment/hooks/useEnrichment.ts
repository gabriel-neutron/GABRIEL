import { useCallback, useMemo, useRef, useState } from "react"
import { buildDefaultEnrichmentPrompt, buildEnrichmentRequest, ENRICHMENT_MAX_DEPTH_DEFAULT, runEnrichment } from "@/modules/enrichment/services"
import { toEnrichmentFeature, toEnrichmentContext } from "@/modules/enrichment/services/enrichmentAdapters"
import { hierarchyIndex } from "@/core/relationship/hierarchyIndex"
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
} from "@/modules/enrichment/store/enrichment.store"
import type { DrawnGeometry, MapEntity } from "@/types/domain.types"
import type { EnrichmentProposal, EnrichmentResponse } from "@/types/enrichment.types"
import type { Source } from "@/core/provenance/source"
import type { Claim } from "@/core/provenance/claim"
import type { CredibilityAssessmentResult } from "@/core/provenance/reviewQueue"
import { buildAcceptedPatch, resolveAcceptedPatchTarget } from "@/modules/enrichment/services/enrichmentApply"
import { assessEntityCredibility, selectCitationsForClaims } from "@/modules/enrichment/services/credibility.service"
import { createDefaultProviderBundle } from "@/modules/enrichment/services/providers"
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
  const entityMergeMap = useProjectStore((s) => s.entityMergeMap)
  const relationships = useProjectStore((s) => s.relationships)

  const selectedEntity = useMemo(
    () => (selectedEntityId ? entities.find((entity) => entity.id === selectedEntityId) ?? null : null),
    [entities, selectedEntityId],
  )
  const currentFeatureId = state.run.featureId ?? selectedEntity?.id ?? null
  const feature = useMemo(
    () => (selectedEntity ? toEnrichmentFeature(selectedEntity, drawnGeometries) : null),
    [selectedEntity, drawnGeometries],
  )
  // The edge set, so a selected entity with two recorded parents is described to the model
  // as disputed rather than as independent (ADR 0011).
  const parentLink = useMemo(
    () => (selectedEntity
      ? hierarchyIndex(relationships, { entityIds: new Set(entities.map((e) => e.id)) })
        .linkFor(selectedEntity.id)
      : undefined),
    [entities, relationships, selectedEntity],
  )
  const context = useMemo(
    () => (selectedEntity ? toEnrichmentContext(selectedEntity, entities, parentLink) : null),
    [entities, selectedEntity, parentLink],
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

  /**
   * ADR 0009: one batched credibility call per entity for its newly-accepted citations,
   * best-effort — a missing/failed model call resolves to `null` (so the caller leaves
   * those claims unrated) rather than blocking acceptance, since STANAG assessment is a
   * value-add on top of the citation, never a gate on recording it. `citedSources` must
   * cover every `newClaims` entry's Source — both newly-minted and reused-existing —
   * or a claim citing a reused Source silently gets no citation sent to the model.
   */
  const assessNewClaimsCredibility = useCallback(
    async (
      entity: MapEntity,
      proposals: EnrichmentProposal[],
      citedSources: Source[],
      newClaims: Claim[],
    ): Promise<CredibilityAssessmentResult | null> => {
      if (newClaims.length === 0) return null
      const { assessCredibility } = createDefaultProviderBundle().model
      if (!assessCredibility) return null

      const citations = selectCitationsForClaims(newClaims, citedSources, proposals)
      if (citations.length === 0) return null

      try {
        return await assessEntityCredibility({
          entityName: entity.name,
          field: "sources",
          value: null,
          citations,
          model: { assessCredibility },
        })
      } catch (e) {
        console.error("assessEntityCredibility failed; leaving new claims unrated", e)
        return null
      }
    },
    [],
  )

  const applyAcceptedProposals = useCallback(
    (runFeatureId: string) => {
      // Preserved exactly: claims/sources are not committed at all when no callback is
      // wired, same as the pre-E2.6 behavior of never touching `entity.sources` either.
      if (!onApplyAccepted) return
      const targetId = resolveAcceptedPatchTarget(entities, entityMergeMap, runFeatureId)
      const entity = entities.find((e) => e.id === targetId) ?? null
      const result = buildAcceptedPatch({
        decisions: state.decisions[runFeatureId] ?? {},
        overlay: state.overlay[runFeatureId] ?? {},
        proposals: state.run.proposals,
        entity,
        existingClaims: claims.filter((c) => c.entityId === targetId),
        existingSources: useProvenanceStore.getState().sources,
      })
      if (!result) return
      if (result.newSources.length > 0) {
        useProvenanceStore
          .getState()
          .setSources([...useProvenanceStore.getState().sources, ...result.newSources])
      }
      if (result.newClaims.length > 0) {
        // Commit synchronously and unconditionally — the accept must land even if the
        // user immediately closes the drawer or navigates away. Credibility is assessed
        // afterward, detached (not awaited): it patches the already-committed claims by
        // id once it resolves, via useProjectStore's applyCredibilityToClaims, rather
        // than gating the commit itself on a live AI call.
        addClaims(result.newClaims)
        if (entity) {
          const newClaimIds = result.newClaims.map((c) => c.id)
          void assessNewClaimsCredibility(entity, state.run.proposals, result.citedSources, result.newClaims).then(
            (assessment) => useProjectStore.getState().applyCredibilityToClaims(newClaimIds, assessment),
          )
        }
      }
      if (result.patch != null) onApplyAccepted(targetId, result.patch)
    },
    [entities, onApplyAccepted, state, claims, addClaims, entityMergeMap, assessNewClaimsCredibility],
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
      buildEnrichmentRequest(selectedEntity, entities, drawnGeometries, {
        prompt: draftPrompt, claims, parentLink,
      }),
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
  }, [context, draftPrompt, drawnGeometries, entities, feature, parentLink, selectedEntity, state.run.status, claims])

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

