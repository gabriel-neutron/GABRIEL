import { useCallback, useMemo, useState } from "react"
import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"
import type { OrganisationType } from "@/types/organisation.types"
import { withActiveParent } from "@/core/relationship/activeParent"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { createCitationClaim, filterCitationClaims, type Claim } from "@/core/provenance/claim"
import type { AdmiraltyCredibility, AdmiraltyReliability } from "@/core/provenance/admiralty"
import type { CredibilityMeta, RatingMeta } from "@/core/provenance/ratingMeta"

function detectEchelonFromName(name: string): SymbolEchelon | null {
  const n = name.toLowerCase()
  if (n.includes("division")) return "Division"
  if (n.includes("brigade")) return "Brigade"
  if (n.includes("regiment") || n.includes("régiment")) return "Regiment/group"
  if (n.includes("battalion") || n.includes("bataillon")) return "Battalion/squadron"
  if (n.includes("company") || n.includes("compagnie")) return "Company/battery/troop"
  if (n.includes("platoon") || n.includes("section")) return "Platoon/detachment"
  return null
}

export type EntityInspectorState = {
  entity: MapEntity | null
  linkedGeometries: DrawnGeometry[]
  layerName: string
  parentName: string | null
  typeValue: string
  echelonValue: SymbolEchelon | ""
  affiliationValue: SymbolAffiliation
  domainValue: SymbolDomain
  positionModeValue: PositionMode
  isExactPositionValue: boolean
  parentOptions: MapEntity[]
  firstPoint: DrawnGeometry | undefined
  isEchelonLayerSelected: boolean
  sourceEditor: {
    sources: string[]
    /** ADMIRALTY reliability rating (STANAG 2511) per `sources[index]`, 1:1 (ADR 0006, E2.9). */
    reliabilities: (AdmiraltyReliability | null)[]
    /** Rating provenance per `sources[index]`, 1:1 — drives the provisional-vs-human-assessed badge. */
    reliabilityMetas: (RatingMeta | undefined)[]
    /** ADMIRALTY credibility (STANAG 2511) per `sources[index]`, 1:1 — set by Phase 3's AI pass on the citing Claim. */
    credibilities: (AdmiraltyCredibility | null)[]
    credibilityMetas: (CredibilityMeta | undefined)[]
    draft: string
    setDraft: (value: string) => void
    add: () => void
    remove: (index: number) => void
    rate: (index: number, reliability: AdmiraltyReliability | null) => void
  }
  findDialogOpen: boolean
  setFindDialogOpen: (open: boolean) => void
  handleNameChange: (name: string) => void
  handleTypeChange: (type: string) => void
  handleEchelonChange: (v: string) => void
  handlePositionModeChange: (mode: PositionMode) => void
  handleIsExactPositionChange: (value: boolean) => void
  handleParentChange: (parentId: string | null) => void
  handleSelectOsmRelation: (relationId: number) => void
}

export function useEntityInspector(): EntityInspectorState {
  // Granular selectors (CONSTRAINTS.md: no leaf selects the whole root) — a whole-store
  // useProjectStore() here would re-render this hook (and its entityClaims/resolvedClaims/
  // sources/reliabilities memo chain) on every mutation anywhere in the store, not just
  // ones relevant to the inspected entity's claims.
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  const entities = useProjectStore((s) => s.entities)
  const layers = useProjectStore((s) => s.layers)
  const drawnGeometries = useProjectStore((s) => s.drawnGeometries)
  const claims = useProjectStore((s) => s.claims)
  const relationships = useProjectStore((s) => s.relationships)
  const setRelationships = useProjectStore((s) => s.setRelationships)
  const updateEntity = useProjectStore((s) => s.updateEntity)
  const deleteGeometry = useProjectStore((s) => s.deleteGeometry)
  const addClaims = useProjectStore((s) => s.addClaims)
  const removeClaim = useProjectStore((s) => s.removeClaim)
  const provenanceSources = useProvenanceStore((s) => s.sources)
  const mergeUrls = useProvenanceStore((s) => s.mergeUrls)
  const rateSourceReliability = useProvenanceStore((s) => s.rateSourceReliability)

  const [findDialogOpen, setFindDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState("")

  const entity = selectedEntityId
    ? entities.find((e) => e.id === selectedEntityId) ?? null
    : null
  const linkedGeometries = useMemo(
    () => (entity ? drawnGeometries.filter((g) => g.entityId === entity.id) : []),
    [entity, drawnGeometries],
  )

  const layerName = entity
    ? layers.find((l) => l.id === entity.layerId)?.name ?? entity.layerId
    : ""
  const parentName =
    entity?.parentId != null
      ? entities.find((e) => e.id === entity.parentId)?.name ?? entity.parentId
      : null

  const typeValue = entity?.type ?? (entity?.kind === "corporate" ? "other" : "unknown")
  const echelonValue = (entity?.echelon as SymbolEchelon | undefined) ?? ""
  const affiliationValue = (entity?.affiliation as SymbolAffiliation) ?? "Hostile"
  const domainValue = (entity?.domain as SymbolDomain) ?? "Ground"
  const positionModeValue: PositionMode = entity?.positionMode ?? "own"
  const isExactPositionValue = entity?.isExactPosition ?? false
  /** Parenting stays within the same Profile: a unit can't parent a corporate entity or vice versa. */
  const parentOptions = entity
    ? entities.filter((e) => e.id !== entity.id && e.kind === entity.kind)
    : []
  const firstPoint = linkedGeometries.find((g) => g.type === "point")
  const isEchelonLayerSelected =
    entity != null &&
    layers.some((l) => l.kind === "echelon" && l.id === entity.layerId)
  // Own, non-deduping 1:1 claim->URL projection — deliberately NOT `projectEntityLedger`
  // (which dedupes by URL), because this list is what `add`/`remove` index into by
  // position. Two manually-added duplicate URLs must stay two distinct, independently
  // removable rows (the deliberate asymmetry vs. the AI-accept flow, which does dedupe).
  const entityClaims: Claim[] = useMemo(
    () => (entity ? filterCitationClaims(claims, entity.id) : []),
    [entity, claims],
  )
  // sources/reliabilities/resolvedClaims stay 1:1-indexed — one row per claim, in claim
  // order — so `rate`/`remove` can index by the same position the UI renders.
  //
  // A claim whose `sourceId` no longer resolves (corrupted/desynced `.gpkg`) is KEPT with
  // `source: undefined` rather than filtered out. Filtering hid it AND made it un-removable,
  // yet `selectPersistableSnapshot` still re-persisted it every save — a dangling claim that
  // round-tripped forever with no way to see or delete it (E2 review finding #3). Keeping the
  // row surfaces a placeholder URL and a working Remove button so the user can clear it.
  const resolvedClaims = useMemo(() => {
    const sourceById = new Map(provenanceSources.map((s) => [s.id, s]))
    return entityClaims.map((c) => ({ claim: c, source: sourceById.get(c.sourceId) }))
  }, [entityClaims, provenanceSources])
  const sources = useMemo(
    () => resolvedClaims.map((r) => r.source?.url ?? "(source unavailable)"),
    [resolvedClaims],
  )
  const reliabilities = useMemo(
    () => resolvedClaims.map((r) => r.source?.reliability ?? null),
    [resolvedClaims],
  )
  const reliabilityMetas = useMemo(
    () => resolvedClaims.map((r) => r.source?.reliabilityMeta),
    [resolvedClaims],
  )
  const credibilities = useMemo(
    () => resolvedClaims.map((r) => r.claim.credibility),
    [resolvedClaims],
  )
  const credibilityMetas = useMemo(
    () => resolvedClaims.map((r) => r.claim.credibilityMeta),
    [resolvedClaims],
  )

  const handleNameChange = useCallback(
    (name: string) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { name }
      if (entity.kind === "unit" && (!entity.echelon || entity.echelon === "")) {
        const detected = detectEchelonFromName(name)
        if (detected) {
          patch.echelon = detected
        }
      }
      updateEntity(entity.id, patch)
    },
    [entity, updateEntity],
  )

  const handleTypeChange = useCallback(
    (type: string) => {
      if (!entity) return
      updateEntity(entity.id, { type: type as OrganisationType })
    },
    [entity, updateEntity],
  )

  const handleEchelonChange = useCallback(
    (v: string) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { echelon: v }
      if (layers.some((l) => l.id === v)) patch.layerId = v
      updateEntity(entity.id, patch)
    },
    [entity, layers, updateEntity],
  )

  const handlePositionModeChange = useCallback(
    (mode: PositionMode) => {
      if (!entity) return
      updateEntity(entity.id, {
        positionMode: mode,
        isExactPosition: mode === "own" ? (entity.isExactPosition ?? false) : false,
      })
      if (mode !== "own") {
        for (const g of linkedGeometries) {
          deleteGeometry(g.id)
        }
      }
    },
    [entity, linkedGeometries, updateEntity, deleteGeometry],
  )

  const handleParentChange = useCallback(
    (parentId: string | null) => {
      if (!entity) return
      // `parentId` is derived (ADR 0011); `withActiveParent` REPLACES the child's edge, never adds.
      setRelationships(withActiveParent(relationships, entity, parentId, crypto.randomUUID()))
      // Separate concern, kept: an entity positioned BY its parent has nowhere left to be.
      if (parentId == null && entity.positionMode === "parent") {
        updateEntity(entity.id, { positionMode: "none" })
      }
    },
    [entity, relationships, setRelationships, updateEntity],
  )

  const handleIsExactPositionChange = useCallback(
    (value: boolean) => {
      if (!entity) return
      updateEntity(entity.id, { isExactPosition: value })
    },
    [entity, updateEntity],
  )

  const handleSelectOsmRelation = useCallback(
    (relationId: number) => {
      if (!entity) return
      updateEntity(entity.id, { osmRelationId: relationId })
      setFindDialogOpen(false)
    },
    [entity, updateEntity],
  )

  const handleAddSource = useCallback(() => {
    if (!entity) return
    const value = newSource.trim()
    if (value === "") return
    // Never dedupes against this entity's existing claims — the deliberate asymmetry
    // vs. the AI-accept flow (`enrichmentApply.ts`), which always does. `mergeUrls`
    // itself dedupes only at the *Source*-identity layer (reuse a Source another entity
    // already cited), an orthogonal concern from "does this entity already cite it".
    const merged = mergeUrls([value])
    const source = merged.find((s) => s.url === value)
    if (!source) return
    addClaims([createCitationClaim(entity.id, source.id)])
    setNewSource("")
  }, [entity, newSource, mergeUrls, addClaims])

  const handleRemoveSource = useCallback(
    (index: number) => {
      const claim = resolvedClaims[index]?.claim
      if (!claim) return
      removeClaim(claim.id)
    },
    [resolvedClaims, removeClaim],
  )

  const handleRateSource = useCallback(
    (index: number, reliability: AdmiraltyReliability | null) => {
      const source = resolvedClaims[index]?.source
      if (!source) return
      rateSourceReliability(source.id, reliability)
    },
    [resolvedClaims, rateSourceReliability],
  )

  return {
    entity,
    linkedGeometries,
    layerName,
    parentName,
    typeValue,
    echelonValue,
    affiliationValue,
    domainValue,
    positionModeValue,
    isExactPositionValue,
    parentOptions,
    firstPoint,
    isEchelonLayerSelected,
    sourceEditor: {
      sources,
      reliabilities,
      reliabilityMetas,
      credibilities,
      credibilityMetas,
      draft: newSource,
      setDraft: setNewSource,
      add: handleAddSource,
      remove: handleRemoveSource,
      rate: handleRateSource,
    },
    findDialogOpen,
    setFindDialogOpen,
    handleNameChange,
    handleTypeChange,
    handleEchelonChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
  }
}
