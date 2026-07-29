import { describe, expect, it } from "vitest"
import type { EntityKind } from "@/core/entity/entity"
import type { RelationshipMetadata, RelationshipTier, RelationshipType } from "./relationship"
import type { EdgeLayer, MetadataSpec } from "./vocabulary"
import { ASSESSMENT_TIER_TYPES, EDGE_TYPES, EDGE_VOCABULARY_VERSION, RECORD_TIER_TYPES } from "./vocabulary"

type Equal<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false
type Expect<T extends true> = T

/** Written as a unicode escape so this file itself carries no backtick (Trap T7). */
const BACKTICK = "\u0060"

type AuthoredRow = {
  tier: RelationshipTier
  layer: EdgeLayer | null
  fromLabel: string
  toLabel: string
  fromKinds: EntityKind[]
  toKinds: EntityKind[]
}

/**
 * Transcribed from the authored table in
 * docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md:175-189, not read off the
 * implementation. Changing any row is an amendment to the published vocabulary
 * and requires an EDGE_VOCABULARY_VERSION bump.
 */
const AUTHORED_TABLE: Record<RelationshipType, AuthoredRow> = {
  subordinate_to: {
    tier: "record", layer: "orbat", fromLabel: "unit", toLabel: "formation",
    fromKinds: ["unit"], toKinds: ["unit"],
  },
  fields: {
    tier: "record", layer: "military-industrial", fromLabel: "unit", toLabel: "equipment class",
    fromKinds: ["unit"], toKinds: ["equipment_class"],
  },
  produces: {
    tier: "record", layer: "industrial", fromLabel: "facility", toLabel: "equipment class",
    fromKinds: ["corporate"], toKinds: ["equipment_class"],
  },
  corporate_parent: {
    tier: "record", layer: "financial", fromLabel: "subsidiary", toLabel: "parent org",
    fromKinds: ["corporate", "vessel"], toKinds: ["corporate"],
  },
  owned_by: {
    tier: "record", layer: "financial", fromLabel: "entity", toLabel: "owning person",
    fromKinds: ["corporate", "vessel"], toKinds: ["person"],
  },
  beneficially_owned_by: {
    tier: "record", layer: "financial", fromLabel: "entity", toLabel: "beneficial owner",
    fromKinds: ["corporate"], toKinds: ["person", "corporate"],
  },
  officer_of: {
    tier: "record", layer: "financial", fromLabel: "officer", toLabel: "organisation",
    fromKinds: ["person", "corporate"], toKinds: ["corporate"],
  },
  supplies: {
    tier: "record", layer: "industrial", fromLabel: "supplier", toLabel: "customer",
    fromKinds: ["corporate"], toKinds: ["corporate"],
  },
  shipped_to: {
    tier: "record", layer: "logistics", fromLabel: "consignor", toLabel: "consignee",
    fromKinds: ["corporate"], toKinds: ["corporate"],
  },
  operated_by: {
    tier: "record", layer: "shipping", fromLabel: "asset", toLabel: "operator",
    fromKinds: ["vessel", "corporate"], toKinds: ["corporate"],
  },
  insured_by: {
    tier: "record", layer: "shipping", fromLabel: "insured", toLabel: "insurer",
    fromKinds: ["vessel", "corporate"], toKinds: ["corporate"],
  },
  successor_of: {
    tier: "record", layer: "financial", fromLabel: "entity", toLabel: "predecessor",
    fromKinds: ["corporate"], toKinds: ["corporate"],
  },
  acts_for: {
    tier: "assessment", layer: null, fromLabel: "instrument", toLabel: "principal",
    fromKinds: ["corporate", "person", "vessel"], toKinds: ["corporate", "person"],
  },
}

/**
 * Transcribed from the authored definitions at
 * docs/timelines/GABRIEL_V2_SLICE_0_1_BUILD.md:198-247, with the spec block's
 * line wraps joined by exactly one space. These ship verbatim in the CC-BY
 * dataset; drift here is a publication defect, not a refactor.
 */
const AUTHORED_DEFINITIONS: Record<RelationshipType, string> = {
  subordinate_to:
    "The subject unit is a subordinate element of the named formation in its order of battle.",
  fields:
    "The subject unit is equipped with, and operates, the named class of equipment.",
  produces:
    "The subject facility manufactures or assembles the named class of equipment.",
  corporate_parent:
    "The subject organisation is recorded as part of the named parent organisation's corporate " +
    "structure. Where a shareholding is known it is given as a percentage; where no percentage " +
    "is recorded, no ownership share, controlling interest or acquisition date has been " +
    "established. This is not, on its own, a statement of legal control.",
  owned_by:
    "The named person holds a registered equity stake in the subject entity. No minimum " +
    "threshold is applied; reusers may filter by the recorded percentage.",
  beneficially_owned_by:
    "The named party is recorded as a beneficial owner of the subject entity — the person or " +
    "organisation that ultimately benefits from its ownership.",
  officer_of:
    "The subject party holds a named office in the organisation: director, secretary, or " +
    "registered agent.",
  supplies:
    "The subject supplier provides goods or services to the named customer.",
  shipped_to:
    "The subject consignor shipped goods to the named consignee on the recorded date.",
  operated_by:
    "The named operator exercises a recorded operating role over the subject asset: technical, " +
    "commercial, ISM, or charter.",
  insured_by:
    "The named insurer provides insurance cover to the subject vessel or organisation.",
  successor_of:
    "The subject entity is recorded as the successor to the named predecessor, typically " +
    "following re-registration, renaming, or restructuring.",
  acts_for:
    "ASSESSMENT — not a documentary record. This project assesses that the subject entity acts " +
    "on behalf of the named principal. This is an analytical judgement and should be weighed as " +
    "such.",
}

/** Transcribed from spec:78-84 (the key comments) and spec:175-189 (the table). */
const AUTHORED_METADATA: Record<RelationshipType, MetadataSpec> = {
  subordinate_to: { attachment: ["organic", "attached"] },
  fields: {},
  produces: {},
  corporate_parent: { percent: { min: 0, max: 100 } },
  owned_by: { percent: { min: 0, max: 100 } },
  beneficially_owned_by: {},
  officer_of: { role: ["director", "secretary", "registered_agent"] },
  supplies: {},
  shipped_to: {},
  operated_by: { operatorRole: ["technical", "commercial", "ISM", "charterer"] },
  insured_by: {},
  successor_of: {},
  acts_for: { basis: ["control", "intermediary", "proxy"] },
}

const METADATA_KEYS = ["attachment", "role", "operatorRole", "basis", "percent"] as const
type DeclaredMetadataKey = typeof METADATA_KEYS[number]

/** Every key any MetadataSpec may declare is a key of RelationshipMetadata, and vice versa. */
const metadataKeysMatchTheType: Expect<Equal<DeclaredMetadataKey, keyof RelationshipMetadata>> = true

/** From spec:175-189: which types own which metadata key. */
const METADATA_OWNERS: Record<DeclaredMetadataKey, RelationshipType[]> = {
  attachment: ["subordinate_to"],
  role: ["officer_of"],
  operatorRole: ["operated_by"],
  basis: ["acts_for"],
  percent: ["corporate_parent", "owned_by"],
}

const AUTHORED_TYPES = Object.keys(AUTHORED_TABLE) as RelationshipType[]

describe("EDGE_TYPES", () => {
  // AMENDMENT PROCEDURE: this test is a CI tripwire. Changing the number of edge
  // types means editing vocabulary.ts and this test together AND bumping
  // EDGE_VOCABULARY_VERSION (spec:326-330). Do not "fix" it by editing the count.
  it("locks the vocabulary at 13 entries, 12 record + 1 assessment", () => {
    const keys = Object.keys(EDGE_TYPES)
    expect(keys).toHaveLength(13)
    expect(RECORD_TIER_TYPES).toHaveLength(12)
    expect(ASSESSMENT_TIER_TYPES).toHaveLength(1)

    // The two tier arrays partition the key set: no overlap, nothing missing.
    expect(RECORD_TIER_TYPES.filter((type) => ASSESSMENT_TIER_TYPES.includes(type))).toEqual([])
    expect([...RECORD_TIER_TYPES, ...ASSESSMENT_TIER_TYPES].sort()).toEqual([...keys].sort())

    for (const type of RECORD_TIER_TYPES) expect(EDGE_TYPES[type].tier).toBe("record")
    for (const type of ASSESSMENT_TIER_TYPES) expect(EDGE_TYPES[type].tier).toBe("assessment")
  })

  it("pins EDGE_VOCABULARY_VERSION at 1.0.0", () => {
    expect(EDGE_VOCABULARY_VERSION).toBe("1.0.0")
  })

  it("matches the authored vocabulary table row for row", () => {
    expect(Object.keys(EDGE_TYPES).sort()).toEqual(AUTHORED_TYPES.slice().sort())

    for (const type of AUTHORED_TYPES) {
      const authored = AUTHORED_TABLE[type]
      const definition = EDGE_TYPES[type]
      expect(definition.type).toBe(type)
      expect(definition.tier).toBe(authored.tier)
      expect(definition.layer).toBe(authored.layer)
      expect(definition.fromLabel).toBe(authored.fromLabel)
      expect(definition.toLabel).toBe(authored.toLabel)
      expect(definition.fromKinds).toEqual(authored.fromKinds)
      expect(definition.toKinds).toEqual(authored.toKinds)
    }
  })

  it("keeps corporate_parent and owned_by toKinds disjoint", () => {
    const corporateParentTo = EDGE_TYPES.corporate_parent.toKinds
    const ownedByTo = EDGE_TYPES.owned_by.toKinds
    expect(corporateParentTo).toEqual(["corporate"])
    expect(ownedByTo).toEqual(["person"])
    expect(corporateParentTo.filter((kind) => ownedByTo.includes(kind))).toEqual([])
  })

  it("requires a start date for shipped_to and for no other type", () => {
    expect(EDGE_TYPES.shipped_to.dateRequired).toBe("start")
    for (const type of AUTHORED_TYPES) {
      if (type === "shipped_to") continue
      expect(EDGE_TYPES[type].dateRequired).toBeNull()
    }
  })

  // AMENDMENT, 2026-07-29, owner-authorised: this assertion also forbade a
  // semicolon, which contradicted the verbatim lock below (two authored
  // definitions use one). The no-semicolon clause was a stale proxy for
  // "PRD mechanics were stripped rather than pasted" and was struck from
  // SLICE_0_CRITERIA.md criterion 23. The length and backtick clauses stand.
  it("publishes a non-empty definition of at least 40 characters with no backtick for every type", () => {
    for (const type of AUTHORED_TYPES) {
      const definition = EDGE_TYPES[type].publicDefinition
      expect(definition.trim().length).toBeGreaterThan(0)
      expect(definition.length).toBeGreaterThanOrEqual(40)
      expect(definition).not.toContain(BACKTICK)
    }
  })

  it("publishes each authored definition verbatim as a single-line string", () => {
    const published: Record<string, string> = {}
    for (const type of AUTHORED_TYPES) {
      const definition = EDGE_TYPES[type].publicDefinition
      published[type] = definition
      expect(definition).not.toContain("\n")
      expect(definition).not.toContain("  ")
    }
    expect(published).toEqual(AUTHORED_DEFINITIONS)
  })

  it("declares each metadata key on exactly the types that own it, with the authored value sets", () => {
    expect(metadataKeysMatchTheType).toBe(true)

    for (const type of AUTHORED_TYPES) {
      expect(EDGE_TYPES[type].metadata).toEqual(AUTHORED_METADATA[type])
    }

    // No stray keys: nothing declares a key outside RelationshipMetadata.
    for (const type of AUTHORED_TYPES) {
      for (const key of Object.keys(EDGE_TYPES[type].metadata)) {
        expect(METADATA_KEYS).toContain(key)
      }
    }

    // No missing ones: each key is declared by exactly its owning types.
    for (const key of METADATA_KEYS) {
      const declaringTypes = AUTHORED_TYPES.filter((type) => EDGE_TYPES[type].metadata[key] !== undefined)
      expect(declaringTypes.slice().sort()).toEqual(METADATA_OWNERS[key].slice().sort())
    }
  })
})
