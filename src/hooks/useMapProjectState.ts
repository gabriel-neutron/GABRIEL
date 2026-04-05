import { useState, useEffect } from "react"
import { getDefaultEchelonLayers } from "@/services/geopackage.service"
import { fetchRelationGeometry } from "@/services/overpass.service"
import type { Layer, MapEntity, DrawnGeometry } from "@/types/domain.types"
import type { BaseMapId } from "@/components/shared/BaseMapSwitcher"

export type SelectedOsmObject =
  | {
      type: "node" | "way" | "relation"
      id: number
      cachedFeature?: GeoJSON.Feature & { id?: string }
    }
  | null

type Options = { initialShowNetworks: boolean }

/**
 * Shared map project state: layers, entities, geometries, selection, OSM relation overlays.
 * GeoPackage I/O and edit mutations stay in pages; this hook only holds UI state and shared helpers.
 */
export function useMapProjectState(options: Options) {
  const [layers, setLayers] = useState<Layer[]>(() => getDefaultEchelonLayers())
  const [entities, setEntities] = useState<MapEntity[]>([])
  const [drawnGeometries, setDrawnGeometries] = useState<DrawnGeometry[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [selectedOsmObject, setSelectedOsmObject] = useState<SelectedOsmObject>(null)
  const [showNetworks, setShowNetworks] = useState(options.initialShowNetworks)
  const [baseMap, setBaseMap] = useState<BaseMapId>("osm")
  const [entityOsmGeometries, setEntityOsmGeometries] = useState<Record<string, GeoJSON.FeatureCollection>>({})

  useEffect(
    function fetchOsmRelationGeometries() {
      const entityIdsWithRelation = new Set(
        entities.filter((e) => e.osmRelationId != null).map((e) => e.id),
      )
      setEntityOsmGeometries((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if (!entityIdsWithRelation.has(id)) delete next[id]
        }
        return next
      })
      for (const e of entities) {
        if (e.osmRelationId == null) continue
        fetchRelationGeometry(e.osmRelationId).then(
          (fc) => setEntityOsmGeometries((prev) => ({ ...prev, [e.id]: fc })),
          () => {},
        )
      }
    },
    [entities],
  )

  function setLayerVisible(id: string, visible: boolean): void {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible } : l)))
  }

  function handleCloseDetail(): void {
    setSelectedEntityId(null)
    setSelectedOsmObject(null)
  }

  return {
    layers,
    setLayers,
    entities,
    setEntities,
    drawnGeometries,
    setDrawnGeometries,
    selectedEntityId,
    setSelectedEntityId,
    selectedOsmObject,
    setSelectedOsmObject,
    showNetworks,
    setShowNetworks,
    baseMap,
    setBaseMap,
    entityOsmGeometries,
    setLayerVisible,
    handleCloseDetail,
  }
}
