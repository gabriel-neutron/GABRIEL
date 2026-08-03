import { beforeEach, describe, expect, it } from "vitest"
import { isHierarchyBearing } from "@/core/relationship/validate"
import { applyParentChange } from "./entityInspectorCommands"
import { useProjectStore } from "@/store/useProjectStore"
import type { Layer, MapEntity } from "@/types/domain.types"

/**
 * Criterion 62c — the inspector's parent picker, against the REAL store and the REAL
 * `withActiveParent`.
 *
 * `handleParentChange` is a `useCallback` inside `useEntityInspector`, so it cannot be invoked
 * without a React renderer, and this project has no jsdom and no @testing-library (vitest runs
 * `environment: "node"`; server-rendering would not help either — zustand v5 hands a server
 * render `getInitialState()`, so the hook would see an empty store rather than the fixture).
 *
 * These tests originally MIRRORED the callback body in four local lines, which meant deleting the
 * body left them green (Q2B-21). They now call the body itself: `applyParentChange` is the
 * extracted function the callback delegates to, so a deletion or a rewiring fails here. What this
 * file still contributes over `entityInspectorCommands.test.ts` is the real collaborators — the
 * store's own derivation of `parentId` from the committed edges, which recording doubles cannot
 * show.
 */
function changeParent(entity: MapEntity, parentId: string | null, edgeId: string): void {
  const { relationships, setRelationships, updateEntity } = useProjectStore.getState()
  applyParentChange(entity, relationships, parentId, edgeId, { setRelationships, updateEntity })
}

const LAYERS: Layer[] = [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }]

function unit(id: string, extra: Partial<MapEntity> = {}): MapEntity {
  return { kind: "unit", id, name: id.toUpperCase(), layerId: "custom-1", parentId: null, ...extra } as MapEntity
}

function entityOf(id: string): MapEntity {
  return useProjectStore.getState().entities.find((e) => e.id === id)!
}

function hierarchyEdgesFrom(childId: string): string[] {
  return useProjectStore.getState()
    .relationships.filter((r) => r.fromId === childId && isHierarchyBearing(r))
    .map((r) => r.toId)
}

function seed(entities: MapEntity[]): void {
  useProjectStore.getState().setProject({
    layers: LAYERS,
    entities,
    drawnGeometries: [],
    claims: [],
    relationships: [],
    integrityEvents: [],
    selectedEntityId: "child",
  })
}

describe("useEntityInspector parent picker (criterion 62)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("sets the parent by committing an edge, never by writing the derived parentId", () => {
    seed([unit("p1"), unit("child")])
    changeParent(entityOf("child"), "p1", "e-1")

    expect(hierarchyEdgesFrom("child")).toEqual(["p1"])
    expect(entityOf("child").parentId).toBe("p1")
    // The artefact that the write was an EDGE and not a field: drop the edge set and the field
    // goes with it. A direct `parentId` write would survive this.
    useProjectStore.getState().setRelationships([])
    expect(entityOf("child").parentId).toBeNull()
  })

  it("replaces the child's existing edge when the parent is changed, instead of adding a second (Q2B-15)", () => {
    seed([unit("p1"), unit("p2"), unit("child")])
    changeParent(entityOf("child"), "p1", "e-1")
    changeParent(entityOf("child"), "p2", "e-2")

    // Adding would leave the child CONTESTED, `activeParentMap` would drop it from `parentById`,
    // and the analyst's pick would vanish on the next load — the data-loss bug replace avoids.
    expect(hierarchyEdgesFrom("child")).toEqual(["p2"])
    expect(entityOf("child").parentId).toBe("p2")
  })

  it("still holds one edge when the same parent is picked twice", () => {
    seed([unit("p1"), unit("child")])
    changeParent(entityOf("child"), "p1", "e-1")
    changeParent(entityOf("child"), "p1", "e-2")
    expect(hierarchyEdgesFrom("child")).toEqual(["p1"])
    expect(entityOf("child").parentId).toBe("p1")
  })

  it("clears the parent by removing the edge, and forces positionMode 'none' for a parent-positioned entity", () => {
    seed([unit("p1"), unit("child", { positionMode: "parent" })])
    changeParent(entityOf("child"), "p1", "e-1")
    changeParent(entityOf("child"), null, "e-2")

    expect(hierarchyEdgesFrom("child")).toEqual([])
    expect(entityOf("child").parentId).toBeNull()
    // The coupling that must survive the port: an entity positioned BY its parent has nowhere
    // left to be once the parent is gone.
    expect(entityOf("child").positionMode).toBe("none")
  })

  it("leaves positionMode alone when the cleared entity was not positioned by its parent", () => {
    seed([unit("p1"), unit("child", { positionMode: "own" })])
    changeParent(entityOf("child"), "p1", "e-1")
    changeParent(entityOf("child"), null, "e-2")

    expect(hierarchyEdgesFrom("child")).toEqual([])
    expect(entityOf("child").positionMode).toBe("own")
  })

  it("leaves another entity's parent edge untouched when this child's parent changes", () => {
    seed([unit("p1"), unit("p2"), unit("child"), unit("sibling")])
    changeParent(entityOf("sibling"), "p1", "e-1")
    changeParent(entityOf("child"), "p1", "e-2")
    changeParent(entityOf("child"), "p2", "e-3")

    expect(hierarchyEdgesFrom("sibling")).toEqual(["p1"])
    expect(entityOf("sibling").parentId).toBe("p1")
  })
})
