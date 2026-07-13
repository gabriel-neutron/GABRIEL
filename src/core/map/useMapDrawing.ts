import { useState } from "react"
import type { DrawnGeometry } from "@/types/domain.types"
import { useMapViewStore, type MapTool } from "./useMapViewStore"

type Options = {
  onCreateNewEntity: (geom: DrawnGeometry) => void
  onCreateNewOrganisation?: (geom: DrawnGeometry) => void
  onLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
}

export type { MapTool }

/**
 * `mapTool` is shared via `useMapViewStore` (ADR 0007) so self-contained map layers
 * (`SymbolsLayer` etc.) know whether to be interactive without a prop from `MapView`.
 */
export function useMapDrawing({ onCreateNewEntity, onCreateNewOrganisation, onLinkGeometryToEntity }: Options) {
  const mapTool = useMapViewStore((s) => s.mapTool)
  const setMapTool = useMapViewStore((s) => s.setMapTool)
  const [pendingGeometry, setPendingGeometry] = useState<DrawnGeometry | null>(null)

  function handleGeometryCreated(geom: DrawnGeometry) {
    setPendingGeometry(geom)
    setMapTool("pan")
  }

  function handleCreateNew() {
    if (!pendingGeometry) return
    onCreateNewEntity(pendingGeometry)
    setPendingGeometry(null)
  }

  function handleCreateNewOrganisation() {
    if (!pendingGeometry || !onCreateNewOrganisation) return
    onCreateNewOrganisation(pendingGeometry)
    setPendingGeometry(null)
  }

  function handleLinkToExisting(entityId: string) {
    if (!pendingGeometry) return
    onLinkGeometryToEntity(pendingGeometry, entityId)
    setPendingGeometry(null)
  }

  function handleCancel() {
    setPendingGeometry(null)
  }

  return {
    mapTool,
    setMapTool,
    pendingGeometry,
    isDrawing: mapTool !== "pan",
    handleGeometryCreated,
    handleCreateNew,
    handleCreateNewOrganisation,
    handleLinkToExisting,
    handleCancel,
  }
}