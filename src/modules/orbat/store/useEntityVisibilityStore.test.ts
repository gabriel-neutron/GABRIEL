import { beforeEach, describe, expect, it } from "vitest"
import type { MapEntity } from "@/types/domain.types"
import { useEntityVisibilityStore } from "./useEntityVisibilityStore"

/**
 * The cascade walker, and specifically its cycle safety. `buildOrbat` has explicit cycle tests
 * (`hierarchy.test.ts`); this walker is a separate implementation with no test file at all until
 * now, which is how it kept the only unguarded loop in the codebase.
 */
function unit(id: string, parentId: string | null = null): MapEntity {
  return { kind: "unit", id, name: id.toUpperCase(), layerId: "custom-1", parentId }
}

describe("useEntityVisibilityStore cascade", () => {
  beforeEach(() => {
    useEntityVisibilityStore.getState().reset()
  })

  it("hides the entity and every descendant", () => {
    const entities = [unit("a"), unit("b", "a"), unit("c", "b"), unit("d")]
    useEntityVisibilityStore.getState().setEntityVisible("a", false, entities)
    expect([...useEntityVisibilityStore.getState().hiddenEntityIds].sort()).toEqual(["a", "b", "c"])
  })

  // Without a `seen` set this never returns: `a` enqueues `b`, `b` re-enqueues `a`, forever.
  // The timeout is the assertion — a regression hangs the tab, so it must fail the suite rather
  // than stall it. Reachable in two edits: the parent picker filters only self and kind.
  it("terminates on a two-entity parent cycle", { timeout: 2000 }, () => {
    const entities = [unit("a", "b"), unit("b", "a")]
    useEntityVisibilityStore.getState().setEntityVisible("a", false, entities)
    expect([...useEntityVisibilityStore.getState().hiddenEntityIds].sort()).toEqual(["a", "b"])
  })

  it("terminates on a three-entity cycle and hides each member once", () => {
    const entities = [unit("a", "c"), unit("b", "a"), unit("c", "b")]
    useEntityVisibilityStore.getState().setEntityVisible("a", false, entities)
    expect([...useEntityVisibilityStore.getState().hiddenEntityIds].sort()).toEqual(["a", "b", "c"])
  })

  it("shows the entity and its descendants again", () => {
    const entities = [unit("a"), unit("b", "a")]
    useEntityVisibilityStore.getState().setEntityVisible("a", false, entities)
    useEntityVisibilityStore.getState().setEntityVisible("a", true, entities)
    expect([...useEntityVisibilityStore.getState().hiddenEntityIds]).toEqual([])
  })
})
