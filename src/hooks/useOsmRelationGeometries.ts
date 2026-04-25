import { useEffect, useRef } from "react"
import { fetchRelationGeometry } from "@/services/overpass.service"
import { useProjectStore } from "@/store/useProjectStore"
import type { Layer } from "@/types/domain.types"

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

export function useOsmRelationGeometries(): void {
  const entities = useProjectStore((s) => s.entities)
  const layers = useProjectStore((s) => s.layers)
  const selectedEntityId = useProjectStore((s) => s.selectedEntityId)
  const setEntityOsmGeometries = useProjectStore((s) => s.setEntityOsmGeometries)

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
        selectedEntity?.osmRelationId != null
          ? new Set([selectedEntity.osmRelationId])
          : new Set<number>()

      setEntityOsmGeometries((prev) => {
        const next = { ...prev }
        for (const [entityId, featureCollection] of Object.entries(next)) {
          const relationId = entities.find((entity) => entity.id === entityId)?.osmRelationId
          if (relationId == null || !targetRelationIds.has(relationId)) {
            delete next[entityId]
            continue
          }
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
          if (overpassUnavailableRef.current) continue

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

      return () => {
        cancelled = true
      }
    },
    [entities, layers, selectedEntityId, setEntityOsmGeometries],
  )
}
