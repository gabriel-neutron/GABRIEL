import { useState, useEffect, useRef } from "react"
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

function relationFeatureCollectionFromLayers(
  relationId: number,
  layers: Layer[],
): GeoJSON.FeatureCollection | null {
  const features: GeoJSON.Feature[] = []
  const relationIdString = String(relationId)

  for (const layer of layers) {
    const layerData = layer.osmData
    if (!layerData) continue
    for (const feature of layerData.features) {
      const id = (feature as GeoJSON.Feature & { id?: unknown }).id
      const properties = (feature.properties ?? {}) as Record<string, unknown>
      const type = properties["@type"] ?? properties.type
      const rawId = properties["@id"] ?? properties.id
      const idMatch =
        typeof id === "string" &&
        id.startsWith("relation/") &&
        id.slice("relation/".length) === relationIdString
      const propsMatch = type === "relation" && String(rawId) === relationIdString
      if (idMatch || propsMatch) {
        features.push(feature)
      }
    }
  }

  if (features.length === 0) return null
  return { type: "FeatureCollection", features }
}

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
  const relationGeometryCacheRef = useRef<Map<number, GeoJSON.FeatureCollection>>(new Map())
  const overpassUnavailableRef = useRef(false)

  useEffect(
    function fetchOsmRelationGeometries() {
      let cancelled = false
      const selectedEntity =
        selectedEntityId == null
          ? null
          : entities.find((entity) => entity.id === selectedEntityId) ?? null
      const targetRelationIds =
        selectedEntity?.osmRelationId != null ? new Set([selectedEntity.osmRelationId]) : new Set<number>()

      setEntityOsmGeometries((prev) => {
        const next = { ...prev }
        for (const [entityId, featureCollection] of Object.entries(next)) {
          const relationId = entities.find((entity) => entity.id === entityId)?.osmRelationId
          if (relationId == null || !targetRelationIds.has(relationId)) {
            delete next[entityId]
            continue
          }
          // Keep cached geometry for current target only.
          next[entityId] = featureCollection
        }
        return next
      })

      const relationToEntityIds = new Map<number, string[]>()
      for (const e of entities) {
        if (e.osmRelationId == null || !targetRelationIds.has(e.osmRelationId)) continue
        const list = relationToEntityIds.get(e.osmRelationId) ?? []
        list.push(e.id)
        relationToEntityIds.set(e.osmRelationId, list)
      }

      void (async () => {
        for (const [relationId, entityIds] of relationToEntityIds.entries()) {
          if (cancelled) return
          if (overpassUnavailableRef.current) {
            continue
          }

          const cachedGeometry = relationGeometryCacheRef.current.get(relationId)
          if (cachedGeometry) {
            setEntityOsmGeometries((prev) => {
              const next = { ...prev }
              for (const entityId of entityIds) next[entityId] = cachedGeometry
              return next
            })
            continue
          }

          const localLayerGeometry = relationFeatureCollectionFromLayers(relationId, layers)
          if (localLayerGeometry) {
            relationGeometryCacheRef.current.set(relationId, localLayerGeometry)
            setEntityOsmGeometries((prev) => {
              const next = { ...prev }
              for (const entityId of entityIds) next[entityId] = localLayerGeometry
              return next
            })
            continue
          }

          try {
            const fc = await fetchRelationGeometry(relationId)
            if (cancelled) return
            relationGeometryCacheRef.current.set(relationId, fc)
            setEntityOsmGeometries((prev) => {
              const next = { ...prev }
              for (const entityId of entityIds) next[entityId] = fc
              return next
            })
          } catch (error) {
            if (error instanceof Error && error.message.includes("Failed to fetch")) {
              overpassUnavailableRef.current = true
            }
          }
        }
      })()

      return () => { cancelled = true }
    },
    [entities, layers, selectedEntityId],
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
