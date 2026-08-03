import { describe, expect, it } from "vitest"
import type { Entity } from "@/core/entity/entity"
import type { Claim } from "@/core/provenance/claim"
import { activeParentMap } from "@/core/relationship/activeParent"
import type { Relationship } from "@/core/relationship/relationship"
import type { DrawnGeometry } from "@/types/domain.types"
import { mergeEntities, resolveEntityId, type IdentityGraph } from "./merge"

/** Injected, never read from a clock: `mergeEntities` is pure, so `createdAt` is assertable. */
const NOW = "2026-07-31T00:00:00.000Z"

function unit(id: string, name: string, extra: Partial<Entity> = {}): Entity {
  return { id, name, layerId: "L", parentId: null, kind: "unit", ...extra }
}
function citation(id: string, entityId: string, sourceId: string): Claim {
  return { id, entityId, field: "sources", value: null, sourceId, credibility: null, timestamp: null }
}
function point(id: string, entityId: string, layerId = "L"): DrawnGeometry {
  return { id, layerId, entityId, type: "point", lat: 0, lng: 0 }
}
function edge(id: string, fromId: string, toId: string, extra: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {}, ...extra }
}

describe("mergeEntities", () => {
  it("keeps the primary and records the secondary's name as an alias, with no secondary left", () => {
    const graph: IdentityGraph = { entities: [unit("a", "Wagner"), unit("b", "Вагнер")], claims: [], geometries: [], relationships: [] }
    const { entities } = mergeEntities(graph, "a", "b", NOW)
    expect(entities.map((e) => e.id)).toEqual(["a"])
    expect(entities[0].name).toBe("Wagner")
    expect(entities[0].aliases).toEqual(["Вагнер"])
  })

  it("carries the secondary's own aliases forward and drops a redundant restatement of the primary name", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "Wagner", { aliases: ["PMC Wagner"] }), unit("b", "Вагнер", { aliases: ["Wagner", "ЧВК Вагнер"] })],
      claims: [],
      geometries: [], relationships: [],
    }
    const { entities } = mergeEntities(graph, "a", "b", NOW)
    // primary aliases first, then secondary name, then secondary aliases; "Wagner" (== primary name) dropped.
    expect(entities[0].aliases).toEqual(["PMC Wagner", "Вагнер", "ЧВК Вагнер"])
  })

  it("re-points the secondary's children onto the primary", () => {
    // Was a `parentId` assertion; the hierarchy IS the edge set now (ADR 0011), so the same
    // proposition is that the child's EDGE names the survivor — and it keeps its id and type.
    const graph: IdentityGraph = {
      entities: [unit("a", "HQ"), unit("b", "HQ dup"), unit("child", "Sub")],
      claims: [],
      geometries: [], relationships: [edge("r-1", "child", "b")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships).toEqual([edge("r-1", "child", "a")])
    expect(activeParentMap(relationships).parentById.get("child")).toBe("a")
  })

  it("promotes the primary's parent when the primary was parented to the secondary", () => {
    const graph: IdentityGraph = {
      entities: [unit("grandparent", "GP"), unit("a", "A"), unit("b", "B")],
      claims: [],
      geometries: [], relationships: [edge("r-a", "a", "b"), edge("r-b", "b", "grandparent")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    // a -> b became a self-loop and went; b -> grandparent is now a -> grandparent.
    expect(relationships).toEqual([edge("r-b", "a", "grandparent")])
    expect(activeParentMap(relationships).parentById.get("a")).toBe("grandparent")
  })

  it("moves the secondary's geometries to the primary and adopts the primary's layer", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A", { layerId: "LA" }), unit("b", "B", { layerId: "LB" })],
      claims: [],
      geometries: [point("g1", "a", "LA"), point("g2", "b", "LB")], relationships: [],
    }
    const { geometries } = mergeEntities(graph, "a", "b", NOW)
    expect(geometries.every((g) => g.entityId === "a")).toBe(true)
    expect(geometries.find((g) => g.id === "g2")!.layerId).toBe("LA")
  })

  it("moves the secondary's claims to the primary and de-duplicates identical citations", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [citation("c1", "a", "src1"), citation("c2", "b", "src1"), citation("c3", "b", "src2")],
      geometries: [], relationships: [],
    }
    const { claims } = mergeEntities(graph, "a", "b", NOW)
    // c1 and c2 collapse (both a↔src1 after remap); c3 (a↔src2) survives.
    expect(claims).toHaveLength(2)
    expect(claims.every((c) => c.entityId === "a")).toBe(true)
    expect(new Set(claims.map((c) => c.sourceId))).toEqual(new Set(["src1", "src2"]))
  })

  it("keeps an analyst-assigned credibility/timestamp instead of dropping it when claims collapse", () => {
    const rated: Claim = { id: "c2", entityId: "b", field: "sources", value: null, sourceId: "src1", credibility: 4, timestamp: "2026-01-01" }
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [citation("c1", "a", "src1"), rated],
      geometries: [], relationships: [],
    }
    const { claims } = mergeEntities(graph, "a", "b", NOW)
    expect(claims).toHaveLength(1)
    expect(claims[0].credibility).toBe(4)
    expect(claims[0].timestamp).toBe("2026-01-01")
  })

  it("back-fills fields the primary leaves empty and concatenates distinct notes", () => {
    const graph: IdentityGraph = {
      entities: [
        unit("a", "A", { notes: "first note" }),
        unit("b", "B", { echelon: "Division", militaryUnitId: "MUN-9", notes: "second note" }),
      ],
      claims: [],
      geometries: [], relationships: [],
    }
    const { entities } = mergeEntities(graph, "a", "b", NOW)
    const merged = entities[0]
    expect(merged.echelon).toBe("Division")
    expect(merged.militaryUnitId).toBe("MUN-9")
    expect(merged.notes).toBe("first note\n\nsecond note")
  })

  it("keeps the primary's value when both records set the same field", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A", { echelon: "Brigade" }), unit("b", "B", { echelon: "Division" })],
      claims: [],
      geometries: [], relationships: [],
    }
    expect(mergeEntities(graph, "a", "b", NOW).entities[0].echelon).toBe("Brigade")
  })

  it("returns the graph unchanged for equal ids, a missing id, or a cross-kind merge", () => {
    const corporate: Entity = { id: "c", name: "C", layerId: "industry", parentId: null, kind: "corporate", type: "other" }
    const graph: IdentityGraph = { entities: [unit("a", "A"), corporate], claims: [], geometries: [], relationships: [edge("r-1", "a", "c")] }
    // Equality, not identity: the no-op paths now return `{ ...graph, integrityEvents: [] }`,
    // so the function no longer hands back the very object it was given.
    const unchanged = { ...graph, integrityEvents: [] }
    expect(mergeEntities(graph, "a", "a", NOW)).toEqual(unchanged)
    expect(mergeEntities(graph, "a", "missing", NOW)).toEqual(unchanged)
    expect(mergeEntities(graph, "a", "c", NOW)).toEqual(unchanged)
  })

  it("reconciles positionMode to 'own' so a located secondary's moved geometry still renders (F1)", () => {
    const graph: IdentityGraph = {
      entities: [
        unit("a", "A", { positionMode: "none" }),
        unit("b", "B", { positionMode: "own", isExactPosition: true }),
      ],
      claims: [],
      geometries: [point("g1", "b")], relationships: [],
    }
    const { entities, geometries } = mergeEntities(graph, "a", "b", NOW)
    expect(entities[0].positionMode).toBe("own")
    expect(entities[0].isExactPosition).toBe(true)
    expect(geometries[0].entityId).toBe("a")
  })

  it("back-fills the secondary's parent when the primary is at the root (F3)", () => {
    const graph: IdentityGraph = {
      entities: [unit("brigade", "1st Brigade"), unit("a", "A"), unit("b", "B")],
      claims: [],
      geometries: [], relationships: [edge("r-b", "b", "brigade")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(activeParentMap(relationships).parentById.get("a")).toBe("brigade")
  })

  it("leaves the survivor contested rather than snapping an edge when an ancestor merges into its descendant (F2)", () => {
    // Root -> B -> X -> A; merge B (an ancestor) into A (its descendant). B's edge onto Root and
    // A's edge onto X both end up on A. Nothing here elects a winner (Q40) — the cycle A <-> X
    // that leaves is traversed cycle-safely by `buildOrbat` and unwound by a human.
    const graph: IdentityGraph = {
      entities: [unit("root", "Root"), unit("b", "B"), unit("x", "X"), unit("a", "A")],
      claims: [],
      geometries: [], relationships: [edge("r-b", "b", "root"), edge("r-x", "x", "b"), edge("r-a", "a", "x")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships).toEqual([edge("r-b", "a", "root"), edge("r-x", "x", "a"), edge("r-a", "a", "x")])
    const map = activeParentMap(relationships)
    expect(map.parentById.has("a")).toBe(false)
    expect(map.contested.get("a")).toEqual(["r-b", "r-a"])
  })

  it("does not inherit the secondary's stored NATO symbol code (F5)", () => {
    const graph: IdentityGraph = {
      entities: [
        unit("a", "A", { type: "infantry", echelon: "Brigade" }),
        unit("b", "B", { natoSymbolCode: "10031000001211000000" }),
      ],
      claims: [],
      geometries: [], relationships: [],
    }
    const merged = mergeEntities(graph, "a", "b", NOW).entities[0]
    expect(merged.natoSymbolCode).toBeUndefined()
    expect(merged.type).toBe("infantry")
  })

  it("does not mutate its input", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B", { parentId: null })],
      claims: [citation("c1", "b", "src1")],
      geometries: [point("g1", "b")], relationships: [edge("r-1", "b", "z")],
    }
    const snapshot = JSON.stringify(graph)
    mergeEntities(graph, "a", "b", NOW)
    expect(JSON.stringify(graph)).toBe(snapshot)
  })

  it("drops an edge joining the primary and the secondary and records it verbatim (Q41)", () => {
    const joining = edge("r-join", "a", "b", { type: "corporate_parent", metadata: { percent: 25 } })
    const original = { id: joining.id, fromId: joining.fromId, toId: joining.toId, type: joining.type }
    const graph: IdentityGraph = {
      entities: [unit("a", "Wagner"), unit("b", "Вагнер")],
      claims: [],
      geometries: [], relationships: [joining, edge("r-keep", "a", "z")],
    }
    const { relationships, integrityEvents } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships.map((r) => r.id)).toEqual(["r-keep"])
    expect(integrityEvents).toHaveLength(1)
    expect(integrityEvents[0].kind).toBe("merge-dropped-edge")
    expect(integrityEvents[0].createdAt).toBe(NOW)
    // The quadruple as it was BEFORE re-pointing: a normalised or post-re-point copy
    // (fromId === toId === "a") fails here, which is the whole point of the record.
    expect(integrityEvents[0].detail).toEqual(original)
    expect(integrityEvents[0].detail.fromId).toBe("a")
    expect(integrityEvents[0].detail.toId).toBe("b")
    // Owner ruling, 2026-08-03: the summary is prose, so it carries the vocabulary's endpoint
    // labels and never the type's machine name — which stays in `detail`.
    expect(integrityEvents[0].summary).toBe("A recorded relationship between a subsidiary and a " +
      "parent org was dropped when Вагнер was merged into Wagner: both of its endpoints are now " +
      "the same entity.")
    expect(integrityEvents[0].summary).not.toContain("corporate_parent")
  })

  it("leaves a self-loop that arrived as one alone, and mints no event for it", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [],
      geometries: [], relationships: [edge("r-loop", "z", "z")],
    }
    const { relationships, integrityEvents } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships).toEqual([edge("r-loop", "z", "z")])
    expect(integrityEvents).toEqual([])
  })

  it("collapses edges that become duplicates once the secondary's endpoint is re-pointed", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [],
      geometries: [], relationships: [edge("r-1", "x", "a"), edge("r-2", "x", "b")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships).toEqual([edge("r-1", "x", "a")])
  })

  it("leaves two edges that were already identical before the merge alone", () => {
    // Untouched by this merge, so collapsing them would be `mergeEntities` deciding two separate
    // assertions say the same thing — `activeParentMap` treats them as a contest.
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [],
      geometries: [], relationships: [edge("r-1", "x", "y"), edge("r-2", "x", "y")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships.map((r) => r.id)).toEqual(["r-1", "r-2"])
  })

  it("leaves a survivor that inherits two parents contested, electing no winner (Q40)", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B"), unit("p1", "P1"), unit("p2", "P2")],
      claims: [],
      geometries: [], relationships: [edge("r-a", "a", "p1"), edge("r-b", "b", "p2")],
    }
    const { relationships } = mergeEntities(graph, "a", "b", NOW)
    expect(relationships).toEqual([edge("r-a", "a", "p1"), edge("r-b", "a", "p2")])
    const map = activeParentMap(relationships)
    // Absent, not mapped to null and not resolved to either candidate: a human adjudicates.
    expect(map.parentById.has("a")).toBe(false)
    expect(map.contested.get("a")).toEqual(["r-a", "r-b"])
  })
})

describe("resolveEntityId", () => {
  it("returns the id unchanged when it was never merged", () => {
    expect(resolveEntityId({}, "a")).toBe("a")
  })

  it("resolves a single merge hop", () => {
    expect(resolveEntityId({ b: "a" }, "b")).toBe("a")
  })

  it("resolves a chain of merges to the final survivor", () => {
    expect(resolveEntityId({ b: "a", c: "b" }, "c")).toBe("a")
  })

  it("does not loop forever on a cyclical map", () => {
    expect(resolveEntityId({ a: "b", b: "a" }, "a")).toBe("a")
  })
})
