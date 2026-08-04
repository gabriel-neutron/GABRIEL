import { describe, expect, it } from "vitest"
import { applyExportGate, EXPORT_GATE_RULES } from "./exportGate"
import type { Claim } from "@/core/provenance/claim"
import type { Relationship } from "@/core/relationship/relationship"
import type { MapEntity } from "@/types/domain.types"

const LAYER = "layer-1"

function unit(id: string, name = id): MapEntity {
  return { kind: "unit", id, name, layerId: LAYER, parentId: null }
}

function person(id: string): MapEntity {
  return { kind: "person", id, name: "A Named Officer", layerId: LAYER, parentId: null }
}

function edge(id: string, fromId: string, toId: string, over: Partial<Relationship> = {}): Relationship {
  return { id, fromId, toId, type: "subordinate_to", startDate: null, endDate: null, metadata: {}, ...over }
}

/** The endpoint-proxy definition of "sourced": the entity carries at least one claim. */
function claim(id: string, entityId: string): Claim {
  return { id, entityId, field: "sources", value: null, sourceId: "src-1", credibility: null, timestamp: null }
}

const VALID_OVERRIDE = {
  proposedBy: "analyst-a",
  confirmedBy: "analyst-b",
  confirmedAt: "2026-08-04",
  rationale: "Corroborated by two independent filings.",
}

describe("applyExportGate: natural persons", () => {
  it("excludes a natural-person entity", () => {
    const gated = applyExportGate({ entities: [unit("u-1"), person("p-1")], relationships: [], claims: [] })

    expect(gated.entities.map((e) => e.id)).toEqual(["u-1"])
    expect(gated.excluded.entities).toEqual([{ id: "p-1", reason: "natural-person" }])
  })

  // "No natural-person Entities, AND no Relationship naming one" — the second half is the
  // one that is easy to forget, and it is the half that leaks a name through the edge table
  // after the entity row has been removed.
  it("excludes any relationship naming a person, even a fully sourced one", () => {
    const gated = applyExportGate({
      entities: [unit("u-1"), person("p-1")],
      relationships: [edge("r-1", "u-1", "p-1", { type: "officer_of" })],
      claims: [claim("c-1", "u-1"), claim("c-2", "p-1")],
    })

    expect(gated.relationships).toEqual([])
    expect(gated.excluded.relationships).toEqual([{ id: "r-1", reason: "names-excluded-entity" }])
  })

  it("drops the claims of an excluded entity, so no name survives in provenance", () => {
    const gated = applyExportGate({
      entities: [unit("u-1"), person("p-1")],
      relationships: [],
      claims: [claim("c-1", "u-1"), claim("c-2", "p-1")],
    })

    expect(gated.claims.map((c) => c.id)).toEqual(["c-1"])
  })
})

describe("applyExportGate: unsourced relationships", () => {
  it("ships an edge whose both endpoints carry a claim", () => {
    const gated = applyExportGate({
      entities: [unit("u-1"), unit("u-2")],
      relationships: [edge("r-1", "u-1", "u-2")],
      claims: [claim("c-1", "u-1"), claim("c-2", "u-2")],
    })

    expect(gated.relationships.map((r) => r.id)).toEqual(["r-1"])
  })

  it("excludes an edge when either endpoint carries no claim", () => {
    const gated = applyExportGate({
      entities: [unit("u-1"), unit("u-2")],
      relationships: [edge("r-1", "u-1", "u-2")],
      claims: [claim("c-1", "u-1")],
    })

    expect(gated.relationships).toEqual([])
    expect(gated.excluded.relationships).toEqual([{ id: "r-1", reason: "unsourced" }])
  })

  // A claim on some other field is still a citation attached to the entity. The endpoint
  // proxy asks whether the entity is sourced at all, not whether the EDGE is -- which the
  // model cannot express, and which the export documentation has to say plainly.
  it("counts a claim on any field, not only the general-citation sentinel", () => {
    const gated = applyExportGate({
      entities: [unit("u-1"), unit("u-2")],
      relationships: [edge("r-1", "u-1", "u-2")],
      claims: [claim("c-1", "u-1"), { ...claim("c-2", "u-2"), field: "echelon", value: "Brigade" }],
    })

    expect(gated.relationships.map((r) => r.id)).toEqual(["r-1"])
  })

  it("excludes an edge whose endpoint is not in the dataset at all", () => {
    const gated = applyExportGate({
      entities: [unit("u-1")],
      relationships: [edge("r-1", "u-1", "u-absent")],
      claims: [claim("c-1", "u-1")],
    })

    expect(gated.excluded.relationships).toEqual([{ id: "r-1", reason: "dangling-endpoint" }])
  })
})

describe("applyExportGate: assessment tier", () => {
  const sourced = { entities: [unit("u-1"), unit("u-2")], claims: [claim("c-1", "u-1"), claim("c-2", "u-2")] }

  it("excludes an assessment-tier edge by default", () => {
    const gated = applyExportGate({ ...sourced, relationships: [edge("r-1", "u-1", "u-2", { type: "acts_for" })] })

    expect(gated.excluded.relationships).toEqual([{ id: "r-1", reason: "assessment-tier" }])
  })

  it("ships an assessment-tier edge carrying a valid two-person override", () => {
    const gated = applyExportGate({
      ...sourced,
      relationships: [edge("r-1", "u-1", "u-2", { type: "acts_for", exportOverride: VALID_OVERRIDE })],
    })

    expect(gated.relationships.map((r) => r.id)).toEqual(["r-1"])
  })

  // The ceremony is the whole point: one person cannot authorise their own publication.
  // `decodeExportOverride` already refuses this, and the gate must not re-decide it.
  it("refuses a self-confirmed override", () => {
    const gated = applyExportGate({
      ...sourced,
      relationships: [edge("r-1", "u-1", "u-2", {
        type: "acts_for",
        exportOverride: { ...VALID_OVERRIDE, confirmedBy: VALID_OVERRIDE.proposedBy },
      })],
    })

    expect(gated.excluded.relationships).toEqual([{ id: "r-1", reason: "assessment-tier" }])
  })

  it("refuses a structurally malformed override", () => {
    const gated = applyExportGate({
      ...sourced,
      relationships: [edge("r-1", "u-1", "u-2", {
        type: "acts_for",
        exportOverride: { ...VALID_OVERRIDE, rationale: "  " },
      })],
    })

    expect(gated.relationships).toEqual([])
  })

  // An override authorises publication of an assessment; it does not manufacture a source,
  // and it says nothing about a person. Order matters, and this pins it.
  it("does not let an override rescue an unsourced or person-naming edge", () => {
    const unsourced = applyExportGate({
      entities: [unit("u-1"), unit("u-2")],
      claims: [claim("c-1", "u-1")],
      relationships: [edge("r-1", "u-1", "u-2", { type: "acts_for", exportOverride: VALID_OVERRIDE })],
    })
    expect(unsourced.excluded.relationships).toEqual([{ id: "r-1", reason: "unsourced" }])

    const naming = applyExportGate({
      entities: [unit("u-1"), person("p-1")],
      claims: [claim("c-1", "u-1"), claim("c-2", "p-1")],
      relationships: [edge("r-1", "u-1", "p-1", { type: "acts_for", exportOverride: VALID_OVERRIDE })],
    })
    expect(naming.excluded.relationships).toEqual([{ id: "r-1", reason: "names-excluded-entity" }])
  })
})

describe("applyExportGate: what must NOT be stripped", () => {
  // Story 82: the ADMIRALTY ratings are the project's differentiator and belong in the
  // artefact. A gate that quietly dropped them would be removing the thing that makes the
  // dataset worth citing.
  it("keeps the ratings on a claim that ships", () => {
    const rated: Claim = { ...claim("c-1", "u-1"), credibility: 2 }
    const gated = applyExportGate({ entities: [unit("u-1")], relationships: [], claims: [rated] })

    expect(gated.claims[0].credibility).toBe(2)
  })

  it("is a pure function that does not mutate its input", () => {
    const entities = [unit("u-1"), person("p-1")]
    applyExportGate({ entities, relationships: [], claims: [] })

    expect(entities).toHaveLength(2)
  })
})

describe("EXPORT_GATE_RULES", () => {
  // The rules are published alongside the data: a reuser has to be able to read what was
  // filtered out and why, or the absence of a row is indistinguishable from an absence of
  // evidence. Each rule states the reason code it produces.
  it("documents every reason the gate can produce", () => {
    const produced = new Set(EXPORT_GATE_RULES.map((r) => r.reason))

    expect(produced).toEqual(
      new Set(["natural-person", "names-excluded-entity", "dangling-endpoint", "unsourced", "assessment-tier"]),
    )
    for (const rule of EXPORT_GATE_RULES) expect(rule.statement.length).toBeGreaterThan(20)
  })
})
