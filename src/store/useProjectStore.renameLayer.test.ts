import { beforeEach, describe, expect, it } from "vitest"
import type { Layer } from "@/types/domain.types"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { useProjectStore } from "./useProjectStore"

/**
 * ADR 0012 rule 1. The store and the persistence layer state the same rule: for echelon layers
 * the built-in vocabulary is authoritative, so a rename here would persist in memory, survive
 * one save and revert on the next load. The guarded set is exactly the set
 * `applyGeoPackageResult` overwrites — `organisation` is deliberately outside it, unlike
 * `removeLayer`, because Industry's name does round-trip.
 *
 * Lives beside useProjectStore.test.ts rather than inside it: that file is already past the
 * 300-line cap in docs/CONSTRAINTS.md.
 */

const LAYERS: Layer[] = [
  { id: "Division", name: "Division", visible: true, kind: "echelon" },
  { id: "custom-1", name: "Task Force", visible: true, kind: "custom" },
  { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" },
]

function nameOf(layerId: string): string | undefined {
  return useProjectStore.getState().layers.find((l) => l.id === layerId)?.name
}

describe("useProjectStore.renameLayer (ADR 0012)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
    useProjectStore.getState().setProject({
      layers: LAYERS,
      entities: [],
      drawnGeometries: [],
      claims: [],
      selectedEntityId: null,
    })
  })

  it("leaves an echelon layer under its vocabulary label", () => {
    useProjectStore.getState().renameLayer("Division", "Divisions blindees")

    expect(nameOf("Division")).toBe("Division")
    expect(useProjectStore.getState().layers).toEqual(LAYERS)
  })

  it("renames a custom layer", () => {
    useProjectStore.getState().renameLayer("custom-1", "Northern grouping")

    expect(nameOf("custom-1")).toBe("Northern grouping")
  })

  it("renames the Industry layer, whose name does round-trip through a save", () => {
    useProjectStore.getState().renameLayer(INDUSTRY_LAYER_ID, "Industrie")

    expect(nameOf(INDUSTRY_LAYER_ID)).toBe("Industrie")
  })
})
