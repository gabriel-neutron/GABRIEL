import { beforeEach, describe, expect, it } from "vitest"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"
import type { Relationship } from "@/core/relationship/relationship"
import type { Layer, MapEntity } from "@/types/domain.types"
import { unacknowledgedIntegrityEvents, useProjectStore, type ProjectState } from "./useProjectStore"

/**
 * Criteria 56d and 57a. Lives beside useProjectStore.test.ts rather than inside it: that file is
 * capped at 385 lines by criterion 5 and sits at 382, and the split precedent is P1b's
 * projectIO.authority.test.ts and P2's useProjectStore.renameLayer.test.ts.
 */

const LAYERS: Layer[] = [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }]

function unit(id: string, parentId: string | null = null): MapEntity {
  return { kind: "unit", id, name: id.toUpperCase(), layerId: "custom-1", parentId }
}

function edge(id: string, fromId: string, toId: string): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {} }
}

function event(id: string, extra: Partial<IntegrityEvent> = {}): IntegrityEvent {
  return {
    id,
    kind: "multiple-active-hierarchy",
    createdAt: "2026-07-31T00:00:00.000Z",
    summary: "s",
    detail: {},
    ...extra,
  }
}

function seed(entities: MapEntity[], relationships: Relationship[] = [], integrityEvents: IntegrityEvent[] = []): void {
  useProjectStore.getState().setProject({
    layers: LAYERS,
    entities,
    drawnGeometries: [],
    claims: [],
    relationships,
    integrityEvents,
    selectedEntityId: null,
  })
}

describe("commitRelationships (ADR 0005 atomicity)", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("setRelationships makes a single store notification carrying the edges and the re-derived entities", () => {
    seed([unit("parent"), unit("child")])
    // The artefact is the LISTENER, not the final state: a final-state assertion passes just as
    // happily with two `set` calls, one notification apart, which is the bug ADR 0005 forbids.
    const seen: ProjectState[] = []
    const unsubscribe = useProjectStore.subscribe((s) => seen.push(s))
    useProjectStore.getState().setRelationships([edge("r-1", "child", "parent")])
    unsubscribe()

    expect(seen).toHaveLength(1)
    const observed = seen[0]!
    expect(observed.relationships.map((r) => r.id)).toEqual(["r-1"])
    expect(observed.entities.find((e) => e.id === "child")!.parentId).toBe("parent")
  })

  it("clearing the edge set is a single store notification that also clears the derived parents", () => {
    // As a load leaves it: `load.ts` runs the derivation, so the entities handed to `setProject`
    // already carry the `parentId` their edges imply (`setProject` itself derives nothing).
    seed([unit("parent"), unit("child", "parent")], [edge("r-1", "child", "parent")])

    const seen: ProjectState[] = []
    const unsubscribe = useProjectStore.subscribe((s) => seen.push(s))
    useProjectStore.getState().setRelationships([])
    unsubscribe()

    expect(seen).toHaveLength(1)
    expect(seen[0]!.relationships).toEqual([])
    expect(seen[0]!.entities.find((e) => e.id === "child")!.parentId).toBeNull()
  })

  it("a merge is a single store notification: the listener never sees merged entities against stale edges", () => {
    seed([unit("a"), unit("b"), unit("child", "b")], [edge("r-1", "child", "b")])

    const seen: ProjectState[] = []
    const unsubscribe = useProjectStore.subscribe((s) => seen.push(s))
    useProjectStore.getState().mergeEntities("a", "b")
    unsubscribe()

    expect(seen).toHaveLength(1)
    const observed = seen[0]!
    // Both halves at once: the secondary is gone from `entities` AND its edge already names the
    // survivor AND the derived parent already follows.
    expect(observed.entities.map((e) => e.id).sort()).toEqual(["a", "child"])
    expect(observed.relationships).toEqual([edge("r-1", "child", "a")])
    expect(observed.entities.find((e) => e.id === "child")!.parentId).toBe("a")
  })
})

describe("a contest decided on the edit path is recorded on the edit path", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("mints one multiple-active-hierarchy event per contested child in the same notification", () => {
    seed([unit("p-1"), unit("p-2"), unit("child")])
    const seen: ProjectState[] = []
    const unsubscribe = useProjectStore.subscribe((s) => seen.push(s))
    useProjectStore.getState().setRelationships([edge("r-1", "child", "p-1"), edge("r-2", "child", "p-2")])
    unsubscribe()

    // The artefact is that the finding and the parent it removes arrive TOGETHER: before this,
    // the analyst saw the parent vanish and the ledger learnt of it only after a save + reload.
    expect(seen).toHaveLength(1)
    const observed = seen[0]!
    expect(observed.entities.find((e) => e.id === "child")!.parentId).toBeNull()
    expect(observed.integrityEvents).toHaveLength(1)
    const minted = observed.integrityEvents[0]!
    // The id `load.ts` mints for the same finding, so the two paths write ONE row.
    expect(minted.id).toBe("integrity:multiple-active-hierarchy:child")
    expect(minted.kind).toBe("multiple-active-hierarchy")
    expect(minted.detail).toEqual({
      childId: "child",
      relationshipIds: ["r-1", "r-2"],
      parentIds: ["p-1", "p-2"],
    })
    expect(minted.summary).toContain("\"CHILD\"")
  })

  it("re-detects the same contest as one row, and never overwrites an acknowledgement", () => {
    const acknowledged = event("integrity:multiple-active-hierarchy:child", {
      acknowledgedAt: "2026-07-31T12:00:00.000Z",
      acknowledgedBy: "gabriel",
    })
    seed([unit("p-1"), unit("p-2"), unit("child")], [], [acknowledged])
    const commit = (): void =>
      useProjectStore.getState().setRelationships([edge("r-1", "child", "p-1"), edge("r-2", "child", "p-2")])
    commit()
    commit()

    const { integrityEvents } = useProjectStore.getState()
    expect(integrityEvents).toEqual([acknowledged])
  })

  it("keeps the row once the contest is resolved: a finding is retired by acknowledgement, not by silence", () => {
    seed([unit("p-1"), unit("p-2"), unit("child")])
    useProjectStore.getState().setRelationships([edge("r-1", "child", "p-1"), edge("r-2", "child", "p-2")])
    useProjectStore.getState().setRelationships([edge("r-1", "child", "p-1")])

    const state = useProjectStore.getState()
    expect(state.entities.find((e) => e.id === "child")!.parentId).toBe("p-1")
    expect(state.integrityEvents.map((e) => e.id)).toEqual(["integrity:multiple-active-hierarchy:child"])
  })

  it("mints nothing when no child is contested, and leaves the ledger array untouched", () => {
    seed([unit("p-1"), unit("child")])
    const before = useProjectStore.getState().integrityEvents
    useProjectStore.getState().setRelationships([edge("r-1", "child", "p-1")])
    // Same reference, not merely an equal array: a fresh array on every commit would wake every
    // subscriber selecting on the ledger for a change that did not happen.
    expect(useProjectStore.getState().integrityEvents).toBe(before)
  })
})

describe("unacknowledgedIntegrityEvents", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("returns only the rows with no acknowledgedAt", () => {
    const open = event("i-open")
    const acknowledged = event("i-done", { acknowledgedAt: "2026-07-31T12:00:00.000Z", acknowledgedBy: "gabriel" })
    seed([], [], [open, acknowledged])
    expect(unacknowledgedIntegrityEvents(useProjectStore.getState()).map((e) => e.id)).toEqual(["i-open"])
  })

  it("still returns a row that names an acknowledger but carries no acknowledgedAt", () => {
    // Acknowledgement is defined by the TIMESTAMP, not by the name: a row someone typed a name
    // into and never confirmed is still open, and treating the name as the flag would retire a
    // finding nobody acknowledged.
    const named = event("i-named", { acknowledgedBy: "gabriel", acknowledgedNote: "looking into it" })
    seed([], [], [named])
    expect(unacknowledgedIntegrityEvents(useProjectStore.getState()).map((e) => e.id)).toEqual(["i-named"])
  })

  it("returns an empty array when every row is acknowledged, and on a fresh project", () => {
    expect(unacknowledgedIntegrityEvents(useProjectStore.getState())).toEqual([])
    seed([], [], [event("i-1", { acknowledgedAt: "2026-07-31T12:00:00.000Z" })])
    expect(unacknowledgedIntegrityEvents(useProjectStore.getState())).toEqual([])
  })
})
