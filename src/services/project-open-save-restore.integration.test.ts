import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { asLatLng } from "@/types/coordinates"
import type { MapEntity } from "@/types/domain.types"
import { applyGeoPackageResult, loadGeoPackage, saveGeoPackage, type GpkgGeometry, type GpkgLayer } from "./geopackage.service"
import { clearProject, loadProject, saveProject } from "./projectStorage.service"

describe("project open/save/session-restore flow", () => {
  beforeEach(async () => {
    await clearProject()
  })

  afterEach(async () => {
    await clearProject()
  })

  it("round-trips persisted project through GeoPackage and session storage", async () => {
    const layers: GpkgLayer[] = [
      { id: "custom-1", name: "Custom Ops", visible: true, kind: "custom" },
    ]
    const entities: MapEntity[] = [
      {
        id: "e-1",
        name: "Headquarters Alpha",
        layerId: "custom-1",
        parentId: null,
        affiliation: "Friend",
        domain: "Ground",
        notes: "Persist me",
      },
    ]
    const geometries: GpkgGeometry[] = [
      { id: "g-point", layerId: "custom-1", entityId: "e-1", type: "point", lat: 48.8, lng: 2.3 },
      {
        id: "g-line",
        layerId: "custom-1",
        entityId: null,
        type: "line",
        positions: [asLatLng(48.8, 2.3), asLatLng(48.9, 2.4)],
      },
    ]
    const sourceCache = new Map<string, string>([["https://example.org/source", "snippet"]])

    const exported = await saveGeoPackage(layers, entities, geometries, sourceCache)
    const bufferToPersist = Uint8Array.from(exported).buffer
    await saveProject(bufferToPersist)

    const restoredSession = await loadProject()
    expect(restoredSession?.buffer).toBeInstanceOf(ArrayBuffer)

    const loaded = await loadGeoPackage(restoredSession?.buffer ?? new ArrayBuffer(0))
    const nextState = applyGeoPackageResult(loaded, null)

    expect(nextState.entities).toHaveLength(1)
    expect(nextState.drawnGeometries).toHaveLength(2)
    expect(nextState.layers.some((layer) => layer.id === "custom-1")).toBe(true)
    expect(nextState.layers.length).toBeGreaterThanOrEqual(1)
    expect(nextState.entities.every((entity) => nextState.layers.some((layer) => layer.id === entity.layerId))).toBe(
      true,
    )
    expect(loaded.sourceCache.get("https://example.org/source")).toBe("snippet")

    await clearProject()
    await expect(loadProject()).resolves.toBeNull()
  })
})
