import { useCallback, useMemo, useState } from "react"
import type { DrawnGeometry, MapEntity, PositionMode } from "@/types/domain.types"
import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"
import type { OrganisationType } from "@/types/organisation.types"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { GENERAL_CITATION_FIELD, type Claim } from "@/core/provenance/claim"

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
    draft: string
    setDraft: (value: string) => void
    add: () => void
    remove: (index: number) => void
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
  const {
    selectedEntityId,
    entities,
    layers,
    drawnGeometries,
    claims,
    updateEntity,
    deleteGeometry,
    addClaims,
    removeClaim,
  } = useProjectStore()
  const provenanceSources = useProvenanceStore((s) => s.sources)
  const mergeUrls = useProvenanceStore((s) => s.mergeUrls)

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
    () =>
      entity
        ? claims.filter((c) => c.entityId === entity.id && c.field === GENERAL_CITATION_FIELD)
        : [],
    [entity, claims],
  )
  const sources = useMemo(() => {
    const sourceById = new Map(provenanceSources.map((s) => [s.id, s]))
    return entityClaims
      .map((c) => sourceById.get(c.sourceId)?.url)
      .filter((url): url is string => url != null)
  }, [entityClaims, provenanceSources])

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
      const patch: Partial<MapEntity> = { parentId }
      if (parentId == null && entity.positionMode === "parent") {
        patch.positionMode = "none"
      }
      updateEntity(entity.id, patch)
    },
    [entity, updateEntity],
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
    addClaims([
      {
        id: crypto.randomUUID(),
        entityId: entity.id,
        field: GENERAL_CITATION_FIELD,
        value: null,
        sourceId: source.id,
        credibility: null,
        timestamp: null,
      },
    ])
    setNewSource("")
  }, [entity, newSource, mergeUrls, addClaims])

  const handleRemoveSource = useCallback(
    (index: number) => {
      const claim = entityClaims[index]
      if (!claim) return
      removeClaim(claim.id)
    },
    [entityClaims, removeClaim],
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
      draft: newSource,
      setDraft: setNewSource,
      add: handleAddSource,
      remove: handleRemoveSource,
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
