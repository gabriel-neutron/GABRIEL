import { useCallback, useState } from "react"
import type { DrawnGeometry, Layer, MapEntity } from "@/types/domain.types"
import type { SymbolAffiliation, SymbolDomain, SymbolEchelon } from "@/types/symbol.types"

export type UseEntityInspectorArgs = {
  selectedEntityId: string | null
  entities: MapEntity[]
  layers: Layer[]
  drawnGeometries: DrawnGeometry[]
  onUpdateEntity: (entityId: string, patch: Partial<MapEntity>) => void
}

export type EntityInspectorState = {
  entity: MapEntity | null
  linkedGeometries: DrawnGeometry[]
  layerName: string
  parentName: string | null
  typeValue: string
  echelonValue: SymbolEchelon
  affiliationValue: SymbolAffiliation
  domainValue: SymbolDomain
  parentOptions: MapEntity[]
  firstPoint: DrawnGeometry | undefined
  isEchelonLayerSelected: boolean
  findDialogOpen: boolean
  setFindDialogOpen: (open: boolean) => void
  handleEchelonChange: (v: string) => void
  handleSelectOsmRelation: (relationId: number) => void
}

export function useEntityInspector({
  selectedEntityId,
  entities,
  layers,
  drawnGeometries,
  onUpdateEntity,
}: UseEntityInspectorArgs): EntityInspectorState {
  const [findDialogOpen, setFindDialogOpen] = useState(false)

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
  const echelonValue = (entity?.echelon as SymbolEchelon) ?? "Division"
  const affiliationValue = (entity?.affiliation as SymbolAffiliation) ?? "Friend"
  const domainValue = (entity?.domain as SymbolDomain) ?? "Ground"
  const parentOptions = entity ? entities.filter((e) => e.id !== entity.id) : []
  const firstPoint = linkedGeometries.find((g) => g.type === "point")
  const isEchelonLayerSelected =
    entity != null &&
    layers.some((l) => l.kind === "echelon" && l.id === entity.layerId)

  const handleEchelonChange = useCallback(
    (v: string) => {
      if (!entity) return
      const patch: Partial<MapEntity> = { echelon: v }
      if (layers.some((l) => l.id === v)) patch.layerId = v
      onUpdateEntity(entity.id, patch)
    },
    [entity, layers, onUpdateEntity],
  )

  const handleSelectOsmRelation = useCallback(
    (relationId: number) => {
      if (!entity) return
      onUpdateEntity(entity.id, { osmRelationId: relationId })
      setFindDialogOpen(false)
    },
    [entity, onUpdateEntity],
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
    parentOptions,
    firstPoint,
    isEchelonLayerSelected,
    findDialogOpen,
    setFindDialogOpen,
    handleEchelonChange,
    handleSelectOsmRelation,
  }
}
