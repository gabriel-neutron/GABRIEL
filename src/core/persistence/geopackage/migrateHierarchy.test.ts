import { describe, expect, it } from "vitest"
import type { EntityKind } from "@/core/entity/entity"
import type { Relationship } from "@/core/relationship/relationship"
import { LEGACY_CORPORATE_LINKS, migrateHierarchyToRelationships } from "./migrateHierarchy"

/**
 * Written from `docs/timelines/SLICE_2B_CRITERIA.md` criteria 33-42 and from section 5
 * of `docs/timelines/GABRIEL_V2_SLICE_2B_BUILD.md`. The table below is transcribed from
 * that spec section, never copied out of the implementation: a changed id must be a red
 * test, not a silent re-classification.
 */

const NOW = "2026-07-31T12:00:00.000Z"

const ROSTEC = "23dfd3ce-6465-55ca-83d4-cc8c766d8444" // Rostec State Corporation
const NPK_TECHMASH = "b4f1f1cf-1791-58de-b761-f65842e9d202" // NPK Techmash JSC
const KAMAZ = "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39" // KAMAZ PTC
const KALASHNIKOV = "d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c" // JSC Kalashnikov Concern
const MOTOVILIKHA = "f727b211-b3f4-525c-9776-07192c0d2e80" // PJSC Motovilikha Plants

/** Section 5's table, keyed on ids and never on labels: the parent's real name in the
 *  file is `Rostec State Corporation`, not the `Rostec` the docs abbreviate. */
const SECTION_5_LINKS: Record<string, { parentId: string; percent?: number }> = {
  "74212d89-d123-5e04-8e7e-f817483c6b1d": { parentId: ROSTEC }, // United Aircraft Corporation (UAC) PJSC
  "95a79d63-c7d6-5cdf-b415-23499d444448": { parentId: ROSTEC }, // Russian Helicopters JSC
  "d3708808-9a6b-54cb-94b7-ecef7315efb8": { parentId: ROSTEC }, // United Engine Corporation JSC (UEC)
  "d2f659b0-7f66-5c14-8081-39f48737145f": { parentId: ROSTEC }, // High Precision Systems JSC
  "e667a62a-386a-548a-a8e2-9989616ab7a0": { parentId: ROSTEC }, // JSC Concern Radio-Electronic Technologies (KRET)
  "f0be4fd5-018d-5413-a8fb-93ad47643ac9": { parentId: ROSTEC }, // JSC Ruselectronics
  "02b83897-e746-500c-a4da-48a9be042986": { parentId: ROSTEC }, // Shvabe Holding
  "b4f1f1cf-1791-58de-b761-f65842e9d202": { parentId: ROSTEC }, // NPK Techmash JSC
  "9e60ea3d-533d-53f5-a67d-eb6a0b7f1c39": { parentId: ROSTEC, percent: 49.9 }, // KAMAZ PTC
  "d02a273a-9b1a-5a51-b33b-df7fa7bc4e4c": { parentId: ROSTEC, percent: 25 }, // JSC Kalashnikov Concern
  "2b57b3fb-4fdb-593c-bab4-28bad2214670": { parentId: ROSTEC }, // Uralvagonzavod JSC (UVZ)
  "f727b211-b3f4-525c-9776-07192c0d2e80": { parentId: NPK_TECHMASH }, // PJSC Motovilikha Plants
  "ac8c1602-9c56-5615-b08c-10e67cb93a05": { parentId: ROSTEC }, // JSC Rosoboronexport
}

type MigrationEntity = { id: string; kind: EntityKind; parentId: string | null }

function unit(id: string, parentId: string | null): MigrationEntity {
  return { id, kind: "unit", parentId }
}

function corporate(id: string, parentId: string | null): MigrationEntity {
  return { id, kind: "corporate", parentId }
}

/** Every corporate child of section 5, three unit subordinations, and two roots whose
 *  `parentId` is null and which must therefore mint nothing. */
function mixedEntities(): MigrationEntity[] {
  const corporates = Object.keys(SECTION_5_LINKS).map((childId) =>
    // The legacy column's value, which the migration must ignore in favour of the
    // frozen table: both are set to the real legacy parent here so the test cannot
    // pass by reading the wrong one.
    corporate(childId, SECTION_5_LINKS[childId]?.parentId ?? ROSTEC),
  )
  return [
    ...corporates,
    unit("unit-brigade", "unit-army"),
    unit("unit-battalion", "unit-brigade"),
    unit("unit-company", "unit-battalion"),
    corporate(ROSTEC, null),
    unit("unit-army", null),
  ]
}

function edgeFor(rels: readonly Relationship[], childId: string): Relationship | undefined {
  return rels.find((rel) => rel.fromId === childId)
}

describe("migrateHierarchyToRelationships", () => {
  // --- criterion 33 -----------------------------------------------------------------
  it("locks the 13 legacy corporate links to the ids in section 5 of the build spec", () => {
    expect(LEGACY_CORPORATE_LINKS).toEqual(SECTION_5_LINKS)
    expect(Object.keys(LEGACY_CORPORATE_LINKS)).toHaveLength(13)

    const parents = Object.values(LEGACY_CORPORATE_LINKS).map((link) => link.parentId)
    expect(parents.filter((parentId) => parentId === ROSTEC)).toHaveLength(12)
    expect(parents.filter((parentId) => parentId === NPK_TECHMASH)).toHaveLength(1)

    // The only two-level chain: Motovilikha -> Techmash -> Rostec. Both hops asserted.
    expect(LEGACY_CORPORATE_LINKS[MOTOVILIKHA]?.parentId).toBe(NPK_TECHMASH)
    expect(LEGACY_CORPORATE_LINKS[NPK_TECHMASH]?.parentId).toBe(ROSTEC)
  })

  // --- criterion 34 -----------------------------------------------------------------
  describe("percent", () => {
    it("mints exactly two priced edges and the multiset is 49.9 and 25", () => {
      const result = migrateHierarchyToRelationships(mixedEntities(), [], NOW)
      const priced = result.relationships.filter((rel) => rel.metadata.percent != null)
      expect(priced).toHaveLength(2)

      const values = priced
        .map((rel) => rel.metadata.percent ?? Number.NaN)
        .sort((a, b) => a - b)
      expect(values).toEqual([25, 49.9])

      // 49.9, never 50: `c.` is a precision qualifier and 49.9 is deliberately below
      // the control threshold, so rounding up inverts the analytical meaning.
      expect(edgeFor(result.relationships, KAMAZ)?.metadata.percent).toBe(49.9)
      expect(values).not.toContain(50)

      // 25, never 25.000001: fabricating a value for the source's "+1 share" would
      // invent unsourced data in a published field.
      expect(edgeFor(result.relationships, KALASHNIKOV)?.metadata.percent).toBe(25)
      expect(values).not.toContain(25.000001)
    })

    it("leaves percent undefined on every other minted edge, never null and never 0", () => {
      const result = migrateHierarchyToRelationships(mixedEntities(), [], NOW)
      for (const edge of result.relationships) {
        if (edge.fromId === KAMAZ || edge.fromId === KALASHNIKOV) continue
        // The published CC-BY definition reads a bare edge as "no ownership share
        // established"; a defaulted 0 would instead publish an unsourced figure.
        expect(edge.metadata.percent).toBeUndefined()
        expect(edge.metadata.percent).not.toBeNull()
        expect(edge.metadata.percent).not.toBe(0)
      }
    })

    it("treats percent 0 as a legal recorded value, which is why it is never a default", () => {
      const zero: Relationship = {
        id: "hier:zero-share",
        fromId: "zero-share",
        toId: ROSTEC,
        type: "corporate_parent",
        startDate: null,
        endDate: null,
        metadata: { percent: 0 },
      }
      const result = migrateHierarchyToRelationships(
        [corporate("zero-share", ROSTEC)],
        [zero],
        NOW,
      )
      // Carried through verbatim: zero percent is a statement, not an absence.
      expect(result.relationships).toContainEqual(zero)
      expect({ percent: 0 }).not.toEqual({})

      const full = migrateHierarchyToRelationships(mixedEntities(), [], NOW)
      expect(full.relationships.filter((rel) => rel.metadata.percent === 0)).toEqual([])
    })
  })

  // --- criterion 35 (T12) -----------------------------------------------------------
  it("emits exactly two relationship types over a mixed entity set", () => {
    const result = migrateHierarchyToRelationships(mixedEntities(), [], NOW)
    expect(result.mintedEdges).toBe(result.relationships.length)
    expect(result.mintedEdges).toBeGreaterThan(0)
    const types = new Set(result.relationships.map((rel) => rel.type))
    expect(types).toEqual(new Set(["subordinate_to", "corporate_parent"]))
  })

  // --- criterion 38 (T12), the test that cannot be argued with -----------------------
  it("still mints 25 percent when the note says otherwise", () => {
    // The real note carries TWO percentages and the first, 95%, is a MARKET share, so
    // any regex publishes "Rostec holds 95% of Kalashnikov" - false and defamatory.
    // The function's signature does not even accept `notes`; this is the regression
    // guard against someone widening it later.
    const kalashnikovWithMisleadingNote = {
      id: KALASHNIKOV,
      kind: "corporate" as EntityKind,
      parentId: ROSTEC,
      notes: "Rostec holds 100% and 3% and c.7%",
    }
    const entities = [
      kalashnikovWithMisleadingNote,
      corporate(KAMAZ, ROSTEC),
      unit("unit-brigade", "unit-army"),
    ]

    const result = migrateHierarchyToRelationships(entities, [], NOW)
    const edge = edgeFor(result.relationships, KALASHNIKOV)
    expect(edge?.metadata.percent).toBe(25)
    expect(edge?.type).toBe("corporate_parent")
    expect(edge?.toId).toBe(ROSTEC)
    // And the note's numbers reach nothing at all.
    expect(result.relationships.map((rel) => rel.metadata.percent)).not.toContain(100)
    expect(result.relationships.map((rel) => rel.metadata.percent)).not.toContain(7)
  })

  // --- criterion 39 -----------------------------------------------------------------
  it("gives every minted edge the same minted edge shape", () => {
    const result = migrateHierarchyToRelationships(mixedEntities(), [], NOW)
    expect(result.relationships.length).toBeGreaterThan(0)

    for (const edge of result.relationships) {
      expect(edge.id).toBe("hier:" + edge.fromId)
      // Reversible on a first-colon split; no entity id in the file contains `:`.
      expect(edge.id.slice(edge.id.indexOf(":") + 1)).toBe(edge.fromId)
      expect(edge.startDate).toBeNull()
      expect(edge.endDate).toBeNull()
      // Absent, not present-and-undefined: no machine-minted edge may carry the
      // two-person ExportOverride (ADR 0009).
      expect("exportOverride" in edge).toBe(false)
      expect(edge.exportOverride).toBeUndefined()
    }

    const priced = result.relationships.filter((rel) => Object.keys(rel.metadata).length > 0)
    expect(priced).toHaveLength(2)
    for (const edge of result.relationships) {
      if (priced.includes(edge)) continue
      expect(edge.metadata).toEqual({})
    }
  })

  // --- criterion 40 (T13) -----------------------------------------------------------
  it("throws from the count assertion with the right prefix and the right payload", () => {
    // A duplicate child id is what makes the assertion reachable at all (Q2B-5(c)):
    // the second occurrence can be neither minted nor counted as already present.
    const dupCorporate = corporate("dup-corporate", ROSTEC)
    const dupUnit = unit("dup-unit", "unit-army")
    const entities = [
      dupCorporate,
      dupCorporate,
      dupUnit,
      dupUnit,
      unit("unit-solo", "unit-army"),
    ]

    expect(() => migrateHierarchyToRelationships(entities, [], NOW)).toThrow(
      /^Hierarchy migration/,
    )

    let message = ""
    try {
      migrateHierarchyToRelationships(entities, [], NOW)
    } catch (e) {
      message = e instanceof Error ? e.message : String(e)
    }
    expect(message.startsWith("Hierarchy migration")).toBe(true)
    // The prefix is load-bearing: load.ts re-wraps anything it does not recognise as
    // `Corrupted GeoPackage or unsupported schema`, and telling an analyst their
    // healthy file is corrupt is a false diagnosis at the worst possible moment.
    expect(message).not.toContain("Corrupted GeoPackage")
    // Both integers: 5 entities carry a parent, 3 were accounted for.
    expect(message).toContain("5")
    expect(message).toContain("3")
    // Every missing child id, by name.
    expect(message).toContain("dup-corporate")
    expect(message).toContain("dup-unit")
  })

  // --- criterion 41 -----------------------------------------------------------------
  it("is idempotent when the first run's edges come back as existing", () => {
    const entities = mixedEntities()
    const first = migrateHierarchyToRelationships(entities, [], NOW)
    expect(first.mintedEdges).toBeGreaterThan(0)

    const second = migrateHierarchyToRelationships(entities, first.relationships, NOW)
    expect(second.mintedEdges).toBe(0)
    expect(second.skippedAlreadyPresent).toBe(first.mintedEdges)
    // The artefact: "0 minted" must not be able to pass by the function having
    // recognised nothing and done nothing at all.
    expect(second.skippedAlreadyPresent).not.toBe(0)
    // The count assertion still holds, as N === 0 + N.
    expect(second.entitiesWithParentId).toBe(second.mintedEdges + second.skippedAlreadyPresent)
    expect(second.entitiesWithParentId).toBe(first.entitiesWithParentId)
    expect(second.relationships).toEqual(first.relationships)
  })

  // --- criterion 42 -----------------------------------------------------------------
  it("takes now by injection and never mutates its input arrays", () => {
    const frozenEntities = Object.freeze(mixedEntities().map((e) => Object.freeze(e)))
    const frozenExisting: readonly Relationship[] = Object.freeze([])
    const entitiesBefore = JSON.stringify(frozenEntities)

    const result = migrateHierarchyToRelationships(frozenEntities, frozenExisting, NOW)

    expect(result.integrityEvents).toHaveLength(1)
    expect(result.integrityEvents[0]?.createdAt).toBe(NOW)
    expect(JSON.stringify(frozenEntities)).toBe(entitiesBefore)
    expect(frozenExisting).toEqual([])
    expect(frozenExisting).toHaveLength(0)
  })
})
