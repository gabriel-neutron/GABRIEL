import { useCallback, useState } from "react"
import type { DrawnGeometry, Layer, MapEntity, PositionMode } from "@/types/domain.types"
import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"

const SOURCES_DELIMITER = "\n"

function parseSources(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(SOURCES_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

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

export type UseEntityInspectorArgs = {
  selectedEntityId: string | null
  entities: MapEntity[]
  layers: Layer[]
  drawnGeometries: DrawnGeometry[]
  onUpdateEntity: (entityId: string, patch: Partial<MapEntity>) => void
  onDeleteGeometry: (geometryId: string) => void
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
  sources: string[]
  newSource: string
  findDialogOpen: boolean
  setFindDialogOpen: (open: boolean) => void
  handleNameChange: (name: string) => void
  handleEchelonChange: (v: string) => void
  handlePositionModeChange: (mode: PositionMode) => void
  handleIsExactPositionChange: (value: boolean) => void
  handleParentChange: (parentId: string | null) => void
  handleSelectOsmRelation: (relationId: number) => void
  setNewSource: (value: string) => void
  handleAddSource: () => void
  handleRemoveSource: (index: number) => void
}

export function useEntityInspector({
  selectedEntityId,
  entities,
  layers,
  drawnGeometries,
  onUpdateEntity,
  onDeleteGeometry,
}: UseEntityInspectorArgs): EntityInspectorState {
  const [findDialogOpen, setFindDialogOpen] = useState(false)
  const [newSource, setNewSource] = useState("")

  const entity = selectedEntityId
    ? entities.find((e) => e.id === selectedEntityId) ?? null
    : null
  const linkedGeometries = entity
    ? drawnGeometries.filter((g) => g.entityId === entity.id)
    : []

  const layerName = entity
    ? layers.find((l) => l.id === entity.layerId)?.name ?? entity.layerId
    : ""
  const parentName =
    entity?.parentId != null
      ? entities.find((e) => e.id === entity.parentId)?.name ?? entity.parentId
      : null

  const typeValue = entity?.type ?? "unknown"
  const echelonValue = (entity?.echelon as SymbolEchelon | undefined) ?? ""
  const affiliationValue = (entity?.affiliation as SymbolAffiliation) ?? "Hostile"
  const domainValue = (entity?.domain as SymbolDomain) ?? "Ground"
  const positionModeValue: PositionMode = entity?.positionMode ?? "own"
  const isExactPositionValue = entity?.isExactPosition ?? false
  const parentOptions = entity ? entities.filter((e) => e.id !== entity.id) : []
  const firstPoint = linkedGeometries.find((g) => g.type === "point")
  const isEchelonLayerSelected =
    entity != null &&
    layers.some((l) => l.kind === "echelon" && l.id === entity.layerId)
  const sources = entity ? parseSources(entity.sources) : []

  const handleNameChange = useCallback(
    (name: string) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { name }
      if (!entity.echelon || entity.echelon === "") {
        const detected = detectEchelonFromName(name)
        if (detected) {
          patch.echelon = detected
        }
      }
      onUpdateEntity(entity.id, patch)
    },
    [entity, onUpdateEntity],
  )

  const handleEchelonChange = useCallback(
    (v: string) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { echelon: v }
      if (layers.some((l) => l.id === v)) patch.layerId = v
      onUpdateEntity(entity.id, patch)
    },
    [entity, layers, onUpdateEntity],
  )

  const handlePositionModeChange = useCallback(
    (mode: PositionMode) => {
      if (!entity) return
      onUpdateEntity(entity.id, {
        positionMode: mode,
        isExactPosition: mode === "own" ? (entity.isExactPosition ?? false) : false,
      })
      if (mode !== "own") {
        for (const g of linkedGeometries) {
          onDeleteGeometry(g.id)
        }
      }
    },
    [entity, linkedGeometries, onUpdateEntity, onDeleteGeometry],
  )

  const handleParentChange = useCallback(
    (parentId: string | null) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { parentId }
      if (parentId == null && entity.positionMode === "parent") {
        patch.positionMode = "none"
      }
      onUpdateEntity(entity.id, patch)
    },
    [entity, onUpdateEntity],
  )

  const handleIsExactPositionChange = useCallback(
    (value: boolean) => {
      if (!entity) return
      onUpdateEntity(entity.id, { isExactPosition: value })
    },
    [entity, onUpdateEntity],
  )

  const handleSelectOsmRelation = useCallback(
    (relationId: number) => {
      if (!entity) return
      onUpdateEntity(entity.id, { osmRelationId: relationId })
      setFindDialogOpen(false)
    },
    [entity, onUpdateEntity],
  )

  const handleAddSource = useCallback(() => {
    if (!entity) return
    const value = newSource.trim()
    if (value === "") return
    const next = entity.sources ? `${entity.sources}${SOURCES_DELIMITER}${value}` : value
    onUpdateEntity(entity.id, { sources: next })
    setNewSource("")
  }, [entity, newSource, onUpdateEntity, sources])

  const handleRemoveSource = useCallback(
    (index: number) => {
      if (!entity) return
      const updated = sources.filter((_, i) => i !== index)
      const next = updated.join(SOURCES_DELIMITER)
      onUpdateEntity(entity.id, { sources: next === "" ? null : next })
    },
    [entity, onUpdateEntity, sources],
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
    sources,
    newSource,
    findDialogOpen,
    setFindDialogOpen,
    handleNameChange,
    handleEchelonChange,
    handlePositionModeChange,
    handleIsExactPositionChange,
    handleParentChange,
    handleSelectOsmRelation,
    setNewSource,
    handleAddSource,
    handleRemoveSource,
  }
}
