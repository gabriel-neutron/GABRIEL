import { useState } from "react"
import type { DrawnGeometry } from "@/types/domain.types"

type Options = {
  onCreateNewEntity: (geom: DrawnGeometry) => void
  onLinkGeometryToEntity: (geom: DrawnGeometry, entityId: string) => void
}

export type MapTool = "pan" | "point" | "line" | "polygon"

export function useMapDrawing({ onCreateNewEntity, onLinkGeometryToEntity }: Options) {
  const [mapTool, setMapTool] = useState<MapTool>("pan")
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
    handleLinkToExisting,
    handleCancel,
  }
}