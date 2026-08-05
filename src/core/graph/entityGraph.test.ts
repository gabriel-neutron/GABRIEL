import { describe, expect, it } from "vitest"
import type { Relationship, RelationshipType } from "@/core/relationship/relationship"
import { EDGE_TYPES } from "@/core/relationship/vocabulary"
import { buildEntityGraph, edgeTypesInTier, type GraphEntity } from "./entityGraph"

function entity(id: string, kind: GraphEntity["kind"] = "unit"): GraphEntity {
  return { id, name: id.toUpperCase(), kind }
}

function edge(id: string, fromId: string, toId: string, type: RelationshipType, extra: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type, startDate: null, endDate: null, metadata: {}, ...extra }
}

const ENTITIES = [entity("a"), entity("b"), entity("c", "corporate"), entity("p", "person")]

describe("buildEntityGraph", () => {
  it("turns each entity into a node and each edge into an edge", () => {
    const graph = buildEntityGraph(
      { entities: [entity("a"), entity("b")], relationships: [edge("e1", "b", "a", "subordinate_to")] },
      {},
    )

    expect(graph.nodes.map((n) => n.key).sort()).toEqual(["a", "b"])
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({ key: "e1", source: "b", target: "a" })
  })

  it("labels a node with its name, not its id", () => {
    const graph = buildEntityGraph({ entities: [entity("a")], relationships: [] }, {})
    expect(graph.nodes[0].attributes.label).toBe("A")
  })

  it("colours a node by kind, so a person is not a unit at a glance", () => {
    const graph = buildEntityGraph({ entities: ENTITIES, relationships: [] }, {})
    const colourOf = (id: string) => graph.nodes.find((n) => n.key === id)?.attributes.color
    expect(colourOf("a")).toBe(colourOf("b"))
    expect(colourOf("a")).not.toBe(colourOf("c"))
    expect(colourOf("c")).not.toBe(colourOf("p"))
  })

  it("keeps only the edge types asked for", () => {
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [edge("e1", "b", "a", "subordinate_to"), edge("e2", "c", "a", "supplies")],
      },
      { types: ["supplies"] },
    )
    expect(graph.edges.map((e) => e.key)).toEqual(["e2"])
  })

  it("keeps only the tiers asked for", () => {
    // The tier filter is the publication-relevant one: an assessment-tier edge is an
    // analytical judgement excluded from the CC-BY export, and being able to see the graph
    // without them is seeing what a reuser would get.
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [edge("e1", "b", "a", "subordinate_to"), edge("e2", "c", "p", "acts_for")],
      },
      { tiers: ["assessment"] },
    )
    expect(graph.edges.map((e) => e.key)).toEqual(["e2"])
  })

  it("applies the type filter within the tier filter, not instead of it", () => {
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [edge("e1", "c", "p", "acts_for"), edge("e2", "c", "a", "supplies")],
      },
      { tiers: ["record"], types: ["acts_for", "supplies"] },
    )
    expect(graph.edges.map((e) => e.key)).toEqual(["e2"])
  })

  it("drops an edge whose endpoint is not in the entity set", () => {
    // A dangling endpoint is a fatal violation `load.ts` refuses a file over, but the
    // entity list handed here can also be a filtered one. Either way graphology throws on
    // an edge to a node it does not hold, which would take the whole view down.
    const graph = buildEntityGraph(
      { entities: [entity("a")], relationships: [edge("e1", "a", "gone", "subordinate_to")] },
      {},
    )
    expect(graph.edges).toEqual([])
  })

  it("hides entities with no surviving edge when asked, and shows them when not", () => {
    const input = {
      entities: ENTITIES,
      relationships: [edge("e1", "b", "a", "subordinate_to")],
    }
    expect(buildEntityGraph(input, { hideIsolated: true }).nodes.map((n) => n.key).sort())
      .toEqual(["a", "b"])
    expect(buildEntityGraph(input, {}).nodes).toHaveLength(4)
  })

  it("sizes a node by how many surviving edges touch it", () => {
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [edge("e1", "b", "a", "subordinate_to"), edge("e2", "c", "a", "supplies")],
      },
      {},
    )
    const sizeOf = (id: string) => graph.nodes.find((n) => n.key === id)?.attributes.size ?? 0
    expect(sizeOf("a")).toBeGreaterThan(sizeOf("b"))
    expect(sizeOf("b")).toBeGreaterThan(sizeOf("p"))
  })

  it("positions every node it emits", () => {
    const graph = buildEntityGraph(
      { entities: ENTITIES, relationships: [edge("e1", "b", "a", "subordinate_to")] },
      {},
    )
    for (const node of graph.nodes) {
      expect(typeof node.attributes.x).toBe("number")
      expect(typeof node.attributes.y).toBe("number")
    }
  })

  it("holds positions still when only the edge filter changes", () => {
    // The layout comes from the WHOLE hierarchy, not the filtered edge set. Otherwise
    // filtering to `supplies` would dissolve the tree, re-root all 1,027 entities and
    // rearrange the entire canvas — so an analyst comparing two filters would be comparing
    // two different pictures.
    const input = {
      entities: ENTITIES,
      relationships: [edge("e1", "b", "a", "subordinate_to"), edge("e2", "c", "a", "supplies")],
    }
    const all = buildEntityGraph(input, {})
    const suppliesOnly = buildEntityGraph(input, { types: ["supplies"] })

    const positionOf = (graph: typeof all, id: string) => {
      const node = graph.nodes.find((n) => n.key === id)
      return { x: node?.attributes.x, y: node?.attributes.y }
    }
    expect(positionOf(suppliesOnly, "b")).toEqual(positionOf(all, "b"))
    expect(positionOf(suppliesOnly, "a")).toEqual(positionOf(all, "a"))
  })

  it("marks an ended edge differently from an active one", () => {
    // End-dating is how a record is retired without deleting it. Drawing the two alike
    // would say the relationship still holds.
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [
          edge("live", "c", "a", "supplies"),
          edge("dead", "c", "b", "supplies", { endDate: "2024-01-01" }),
        ],
      },
      {},
    )
    const colourOf = (key: string) => graph.edges.find((e) => e.key === key)?.attributes.color
    expect(colourOf("dead")).not.toBe(colourOf("live"))
  })

  it("colours an edge by the vocabulary layer it belongs to", () => {
    const graph = buildEntityGraph(
      {
        entities: ENTITIES,
        relationships: [
          edge("orbat", "b", "a", "subordinate_to"),
          edge("industrial", "c", "a", "supplies"),
          edge("assessment", "c", "p", "acts_for"),
        ],
      },
      {},
    )
    const colourOf = (key: string) => graph.edges.find((e) => e.key === key)?.attributes.color
    expect(colourOf("orbat")).not.toBe(colourOf("industrial"))
    // Assessment-tier types declare `layer: null`, so they need a colour of their own
    // rather than falling into whatever the null key happens to hit.
    expect(colourOf("assessment")).not.toBe(colourOf("orbat"))
    expect(colourOf("assessment")).not.toBe(colourOf("industrial"))
  })

  it("gives every declared edge type a colour", () => {
    const relationships = Object.keys(EDGE_TYPES).map((type, i) =>
      edge(`e${i}`, "a", "b", type as RelationshipType),
    )
    const graph = buildEntityGraph({ entities: [entity("a"), entity("b")], relationships }, {})
    expect(graph.edges).toHaveLength(Object.keys(EDGE_TYPES).length)
    for (const built of graph.edges) {
      expect(built.attributes.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("labels an edge with its type, so a chord can be read", () => {
    const graph = buildEntityGraph(
      { entities: ENTITIES, relationships: [edge("e1", "c", "p", "owned_by")] },
      {},
    )
    expect(graph.edges[0].attributes.label).toBe("owned by")
  })

  it("survives an empty project", () => {
    expect(buildEntityGraph({ entities: [], relationships: [] }, {})).toEqual({ nodes: [], edges: [] })
  })
})

describe("edgeTypesInTier", () => {
  it("partitions the vocabulary, so the filter UI cannot omit a type", () => {
    const partitioned = [...edgeTypesInTier("record"), ...edgeTypesInTier("assessment")].sort()
    expect(partitioned).toEqual(Object.keys(EDGE_TYPES).sort())
  })
})
