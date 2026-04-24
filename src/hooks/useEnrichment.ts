import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildDefaultEnrichmentPrompt, DEFAULT_ENRICHMENT_OUTPUT_SCHEMA, ENRICHMENT_MAX_DEPTH_DEFAULT, runEnrichment } from "@/services/enrichment"
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
import type { EnrichmentContext, EnrichmentFeature, EnrichmentProposal, EnrichmentResponse } from "@/types/enrichment.types"

function firstGeometryPoint(geometries: DrawnGeometry[]): [number, number] {
  const point = geometries.find((geometry) => geometry.type === "point")
  if (point) return [point.lng, point.lat]
  return [0, 0]
}

function toFeature(entity: MapEntity, geometries: DrawnGeometry[]): EnrichmentFeature {
  const [lng, lat] = firstGeometryPoint(geometries)
  return {
    type: "Feature",
    id: entity.id,
    geometry: {
      type: "Point",
      coordinates: [lng, lat],
    },
    properties: {
      id: entity.id,
      name: entity.name,
      echelon: entity.echelon ?? null,
      country: "RU",
      parentId: entity.parentId,
      natoSymbolCode: entity.natoSymbolCode ?? null,
      status: "active",
    },
  }
}

function toContext(entity: MapEntity, entities: MapEntity[]): EnrichmentContext {
  const parent = entity.parentId
    ? entities.find((candidate) => candidate.id === entity.parentId) ?? null
    : null
  const children = entities.filter((candidate) => candidate.parentId === entity.id)
  return {
    parent: parent
      ? {
          id: parent.id,
          name: parent.name,
          echelon: parent.echelon ?? "unknown",
          hq_location: undefined,
        }
      : null,
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      echelon: child.echelon ?? "unknown",
    })),
  }
}

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
  const selectedGeometries = useMemo(
    () =>
      selectedEntity
        ? drawnGeometries.filter((geometry) => geometry.entityId === selectedEntity.id)
        : [],
    [drawnGeometries, selectedEntity],
  )

  const feature = useMemo(
    () => (selectedEntity ? toFeature(selectedEntity, selectedGeometries) : null),
    [selectedEntity, selectedGeometries],
  )
  const context = useMemo(
    () => (selectedEntity ? toContext(selectedEntity, entities) : null),
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

  /**
   * Shared apply logic used by both closeDrawer and advanceBatchReview.
   *
   * For every accepted proposal:
   * - The field value is applied to the entity.
   * - The evidence URLs cited by that proposal are merged into entity.sources
   *   (deduped with existing sources) so that accepting any field automatically
   *   records where the information came from.
   * - If the "sources" field itself was accepted its proposed URLs are merged in
   *   rather than replacing existing ones.
   */
  const applyAcceptedProposals = useCallback(
    (runFeatureId: string) => {
      if (!onApplyAccepted) return
      const decisions = state.decisions[runFeatureId] ?? {}
      const overlay = state.overlay[runFeatureId] ?? {}
      const hasAccepted = Object.values(decisions).some((d) => d === "accepted")
      if (!hasAccepted) return

      const patch: Record<string, unknown> = {}

      // Apply every accepted field except "sources" — handled separately below
      for (const [field, decision] of Object.entries(decisions)) {
        if (decision === "accepted" && field !== "sources" && field in overlay) {
          patch[field] = overlay[field]
        }
      }

      // Build merged source URL list:
      // 1. existing entity sources
      const entity = entities.find((e) => e.id === runFeatureId)
      const existingUrls =
        typeof entity?.sources === "string"
          ? entity.sources.split("\n").map((s) => s.trim()).filter(Boolean)
          : []

      // 2. URLs from an accepted "sources" proposal value
      const proposedUrls =
        decisions["sources"] === "accepted" && "sources" in overlay
          ? String(overlay["sources"] ?? "").split("\n").map((s) => s.trim()).filter(Boolean)
          : []

      // 3. Evidence URLs cited by other accepted proposals (adds provenance automatically)
      const evidenceUrls = state.run.proposals
        .filter((p) => p.field !== "sources" && decisions[p.field] === "accepted")
        .flatMap((p) => p.sources.map((s) => s.url).filter(Boolean))

      const mergedUrls = [...new Set([...existingUrls, ...proposedUrls, ...evidenceUrls])]
      const mergedSources = mergedUrls.join("\n")

      if (mergedSources !== (entity?.sources ?? "")) {
        patch.sources = mergedSources || null
      }

      if (Object.keys(patch).length > 0) {
        onApplyAccepted(runFeatureId, patch as Partial<MapEntity>)
      }
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

  /**
   * True when the drawer is open, has proposals, and every proposal has been
   * accepted or rejected (none remain "pending").  Used to trigger auto-advance
   * in the batch review flow without requiring the user to click Close.
   */
  const allProposalsResolved = useMemo(() => {
    if (!isDrawerOpen) return false
    if (state.run.proposals.length === 0) return false
    const featureId = state.run.featureId
    if (!featureId) return false
    return !hasPendingProposalsForFeature(state, featureId, state.run.proposals)
  }, [isDrawerOpen, state])

  /**
   * Applies accepted proposals for the current entity and clears its enrichment
   * state WITHOUT closing the drawer.  Called by the auto-advance logic in
   * EditPage so the drawer can transition directly to the next entity.
   */
  const advanceBatchReview = useCallback(() => {
    const runFeatureId = state.run.featureId
    if (!runFeatureId) return
    applyAcceptedProposals(runFeatureId)
    setState((current) => clearFeatureEnrichmentState(current, runFeatureId))
  }, [applyAcceptedProposals, state])

  /**
   * Closes the drawer immediately, bypassing the pending-proposals check.
   * Used when the review queue is exhausted so the last entity's drawer
   * can close without showing the "Resolve all proposals" notice.
   */
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
      const featureId = state.run.featureId ?? selectedEntity?.id
      if (!featureId) return
      setCloseNotice(null)
      setState((current) =>
        acceptProposalToOverlay(current, {
          featureId,
          field: proposal.field,
          value: proposal.proposedValue,
        }),
      )
    },
    [selectedEntity, state.run.featureId],
  )

  const reject = useCallback(
    (proposal: EnrichmentProposal) => {
      const featureId = state.run.featureId ?? selectedEntity?.id
      if (!featureId) return
      setCloseNotice(null)
      setState((current) =>
        rejectProposal(current, {
          featureId,
          field: proposal.field,
        }),
      )
    },
    [selectedEntity, state.run.featureId],
  )

  const ignore = useCallback(
    (proposal: EnrichmentProposal) => {
      const featureId = state.run.featureId ?? selectedEntity?.id
      if (!featureId) return
      setCloseNotice(null)
      setState((current) =>
        setProposalDecision(current, {
          featureId,
          field: proposal.field,
          decision: "pending",
        }),
      )
    },
    [selectedEntity, state.run.featureId],
  )

  const clearOverlayForSelected = useCallback(() => {
    if (!selectedEntity) return
    setState((current) => clearOverlayForFeature(current, selectedEntity.id))
  }, [selectedEntity])

  /**
   * Loads a pre-computed EnrichmentResponse directly into the enrichment UI
   * state, bypassing the live runEnrichment call. Used by the layered research
   * review flow to step through batch results one entity at a time.
   */
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

