import { describe, expect, it } from "vitest"
import type { Entity } from "@/core/entity/entity"
import type { Claim } from "@/core/provenance/claim"
import type { DrawnGeometry } from "@/types/domain.types"
import { mergeEntities, type IdentityGraph } from "./merge"

function unit(id: string, name: string, extra: Partial<Entity> = {}): Entity {
  return { id, name, layerId: "L", parentId: null, kind: "unit", ...extra }
}
function citation(id: string, entityId: string, sourceId: string): Claim {
  return { id, entityId, field: "sources", value: null, sourceId, credibility: null, timestamp: null }
}
function point(id: string, entityId: string, layerId = "L"): DrawnGeometry {
  return { id, layerId, entityId, type: "point", lat: 0, lng: 0 }
}

describe("mergeEntities", () => {
  it("keeps the primary and records the secondary's name as an alias, with no secondary left", () => {
    const graph: IdentityGraph = { entities: [unit("a", "Wagner"), unit("b", "Вагнер")], claims: [], geometries: [] }
    const { entities } = mergeEntities(graph, "a", "b")
    expect(entities.map((e) => e.id)).toEqual(["a"])
    expect(entities[0].name).toBe("Wagner")
    expect(entities[0].aliases).toEqual(["Вагнер"])
  })

  it("carries the secondary's own aliases forward and drops a redundant restatement of the primary name", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "Wagner", { aliases: ["PMC Wagner"] }), unit("b", "Вагнер", { aliases: ["Wagner", "ЧВК Вагнер"] })],
      claims: [],
      geometries: [],
    }
    const { entities } = mergeEntities(graph, "a", "b")
    // primary aliases first, then secondary name, then secondary aliases; "Wagner" (== primary name) dropped.
    expect(entities[0].aliases).toEqual(["PMC Wagner", "Вагнер", "ЧВК Вагнер"])
  })

  it("re-parents the secondary's children onto the primary", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "HQ"), unit("b", "HQ dup"), unit("child", "Sub", { parentId: "b" })],
      claims: [],
      geometries: [],
    }
    const { entities } = mergeEntities(graph, "a", "b")
    expect(entities.find((e) => e.id === "child")!.parentId).toBe("a")
  })

  it("promotes the primary's parent when the primary was parented to the secondary", () => {
    const graph: IdentityGraph = {
      entities: [unit("grandparent", "GP"), unit("a", "A", { parentId: "b" }), unit("b", "B", { parentId: "grandparent" })],
      claims: [],
      geometries: [],
    }
    const { entities } = mergeEntities(graph, "a", "b")
    expect(entities.find((e) => e.id === "a")!.parentId).toBe("grandparent")
  })

  it("moves the secondary's geometries to the primary and adopts the primary's layer", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A", { layerId: "LA" }), unit("b", "B", { layerId: "LB" })],
      claims: [],
      geometries: [point("g1", "a", "LA"), point("g2", "b", "LB")],
    }
    const { geometries } = mergeEntities(graph, "a", "b")
    expect(geometries.every((g) => g.entityId === "a")).toBe(true)
    expect(geometries.find((g) => g.id === "g2")!.layerId).toBe("LA")
  })

  it("moves the secondary's claims to the primary and de-duplicates identical citations", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B")],
      claims: [citation("c1", "a", "src1"), citation("c2", "b", "src1"), citation("c3", "b", "src2")],
      geometries: [],
    }
    const { claims } = mergeEntities(graph, "a", "b")
    // c1 and c2 collapse (both a↔src1 after remap); c3 (a↔src2) survives.
    expect(claims).toHaveLength(2)
    expect(claims.every((c) => c.entityId === "a")).toBe(true)
    expect(new Set(claims.map((c) => c.sourceId))).toEqual(new Set(["src1", "src2"]))
  })

  it("back-fills fields the primary leaves empty and concatenates distinct notes", () => {
    const graph: IdentityGraph = {
      entities: [
        unit("a", "A", { notes: "first note" }),
        unit("b", "B", { echelon: "Division", militaryUnitId: "MUN-9", notes: "second note" }),
      ],
      claims: [],
      geometries: [],
    }
    const { entities } = mergeEntities(graph, "a", "b")
    const merged = entities[0]
    expect(merged.echelon).toBe("Division")
    expect(merged.militaryUnitId).toBe("MUN-9")
    expect(merged.notes).toBe("first note\n\nsecond note")
  })

  it("keeps the primary's value when both records set the same field", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A", { echelon: "Brigade" }), unit("b", "B", { echelon: "Division" })],
      claims: [],
      geometries: [],
    }
    expect(mergeEntities(graph, "a", "b").entities[0].echelon).toBe("Brigade")
  })

  it("returns the graph unchanged for equal ids, a missing id, or a cross-kind merge", () => {
    const corporate: Entity = { id: "c", name: "C", layerId: "industry", parentId: null, kind: "corporate", type: "other" }
    const graph: IdentityGraph = { entities: [unit("a", "A"), corporate], claims: [], geometries: [] }
    expect(mergeEntities(graph, "a", "a")).toBe(graph)
    expect(mergeEntities(graph, "a", "missing")).toBe(graph)
    expect(mergeEntities(graph, "a", "c")).toBe(graph)
  })

  it("does not mutate its input", () => {
    const graph: IdentityGraph = {
      entities: [unit("a", "A"), unit("b", "B", { parentId: null })],
      claims: [citation("c1", "b", "src1")],
      geometries: [point("g1", "b")],
    }
    const snapshot = JSON.stringify(graph)
    mergeEntities(graph, "a", "b")
    expect(JSON.stringify(graph)).toBe(snapshot)
  })
})
