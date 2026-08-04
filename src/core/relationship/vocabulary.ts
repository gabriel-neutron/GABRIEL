import type { EntityKind } from "@/core/entity/entity"
import type { RelationshipMetadata, RelationshipTier, RelationshipType } from "./relationship"

/**
 * Bumped by the amendment procedure, which edits this file and its test together.
 * Adding to the *initial* list is authoring, not amendment — which is why the
 * thirteen entries below cost nothing here and would cost a version bump later.
 */
/**
 * `1.1.0`, not `1.0.0`: four record-tier `publicDefinition` strings were amended on 2026-08-04 to
 * restore the documentary phrasing the PRD's legal posture requires ("the answer to a challenge is
 * 'the filing exists'"). `subordinate_to`, `fields`, `produces` and `supplies` had shipped asserting
 * facts about the world rather than about records, and `supplies` had dropped its evidentiary
 * threshold entirely. Minor, not major: no type was added, removed or renamed and no schema moved,
 * so a reuser's code still compiles — but the published prose changed, which is a dataset change
 * under ADR 0010 and must be visible to anyone who pinned the previous text.
 */
export const EDGE_VOCABULARY_VERSION = "1.1.0"

export type EdgeLayer =
  | "orbat" | "military-industrial" | "industrial"
  | "financial" | "logistics" | "shipping"

/** The closed value set one metadata key may hold. A `readonly string[]` is an enum;
 *  the object form is an inclusive numeric range (only `percent` uses it). */
export type MetadataRule = readonly string[] | { min: number; max: number }

/** Closed value sets per metadata key, declared by the type that owns the key. */
export type MetadataSpec = Partial<Record<keyof RelationshipMetadata, MetadataRule>>

export type EdgeTypeDefinition = {
  type: RelationshipType
  tier: RelationshipTier
  /** null for assessment-tier edges, which are not confined to one layer. */
  layer: EdgeLayer | null
  fromLabel: string
  toLabel: string
  /** Advisory only — orders and filters the target picker. Never rejects. */
  fromKinds: EntityKind[]
  toKinds: EntityKind[]
  /** Ships verbatim in the CC-BY dataset. Authored, not transcribed from the PRD;
   *  do not paraphrase, tidy or regenerate. */
  publicDefinition: string
  dateRequired: "start" | null
  metadata: MetadataSpec
}

/**
 * `corporate_parent` and `owned_by` are deliberately split and carry disjoint
 * `toKinds`. `corporate_parent` is organisation-to-organisation corporate
 * structure; `owned_by` is a natural person holding an entity. The two carry
 * different publication risk — a person's ownership names an individual and is
 * gated out of the public dataset by the natural-person clause — so collapsing
 * them is the mistake the split exists to prevent.
 */
export const EDGE_TYPES: Record<RelationshipType, EdgeTypeDefinition> = {
  subordinate_to: {
    type: "subordinate_to",
    tier: "record",
    layer: "orbat",
    fromLabel: "unit",
    toLabel: "formation",
    fromKinds: ["unit"],
    toKinds: ["unit"],
    publicDefinition: "The subject unit is recorded in a cited source as a subordinate element of the named formation's order of battle. Where the attachment qualifier reads 'attached' the source records that subordination as temporary; absent or 'organic', it records the unit's standing place. This states what the cited record says, not a verified present chain of command.",
    dateRequired: null,
    metadata: { attachment: ["organic", "attached"] },
  },
  fields: {
    type: "fields",
    tier: "record",
    layer: "military-industrial",
    fromLabel: "unit",
    toLabel: "equipment class",
    fromKinds: ["unit"],
    toKinds: ["equipment_class"],
    publicDefinition: "The subject unit was observed operating the named class of equipment on the recorded date. Where no date is recorded the observation is undated, and states nothing about what the unit operates now.",
    dateRequired: null,
    metadata: {},
  },
  produces: {
    type: "produces",
    tier: "record",
    layer: "industrial",
    fromLabel: "facility",
    toLabel: "equipment class",
    fromKinds: ["corporate"],
    toKinds: ["equipment_class"],
    publicDefinition: "The subject facility is documented as manufacturing, assembling or refurbishing the named class of equipment. This records what a cited source states about the facility's output; it is not, on its own, evidence of current production.",
    dateRequired: null,
    metadata: {},
  },
  corporate_parent: {
    type: "corporate_parent",
    tier: "record",
    layer: "financial",
    fromLabel: "subsidiary",
    toLabel: "parent org",
    fromKinds: ["corporate", "vessel"],
    toKinds: ["corporate"],
    publicDefinition: "The subject organisation is recorded as part of the named parent organisation's corporate structure. Where a shareholding is known it is given as a percentage; where no percentage is recorded, no ownership share, controlling interest or acquisition date has been established. This is not, on its own, a statement of legal control.",
    dateRequired: null,
    metadata: { percent: { min: 0, max: 100 } },
  },
  owned_by: {
    type: "owned_by",
    tier: "record",
    layer: "financial",
    fromLabel: "entity",
    toLabel: "owning person",
    fromKinds: ["corporate", "vessel"],
    toKinds: ["person"],
    publicDefinition: "The named person holds a registered equity stake in the subject entity. No minimum threshold is applied; reusers may filter by the recorded percentage.",
    dateRequired: null,
    metadata: { percent: { min: 0, max: 100 } },
  },
  beneficially_owned_by: {
    type: "beneficially_owned_by",
    tier: "record",
    layer: "financial",
    fromLabel: "entity",
    toLabel: "beneficial owner",
    fromKinds: ["corporate"],
    toKinds: ["person", "corporate"],
    publicDefinition: "The named party is recorded as a beneficial owner of the subject entity — the person or organisation that ultimately benefits from its ownership.",
    dateRequired: null,
    metadata: {},
  },
  officer_of: {
    type: "officer_of",
    tier: "record",
    layer: "financial",
    fromLabel: "officer",
    toLabel: "organisation",
    fromKinds: ["person", "corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The subject party holds a named office in the organisation: director, secretary, or registered agent.",
    dateRequired: null,
    metadata: { role: ["director", "secretary", "registered_agent"] },
  },
  supplies: {
    type: "supplies",
    tier: "record",
    layer: "industrial",
    fromLabel: "supplier",
    toLabel: "customer",
    fromKinds: ["corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The subject supplier is documented as providing goods or services to the named customer on a recurring basis — a contract, or at least two recorded transactions. A single or undocumented delivery does not meet that threshold and is not recorded as a supply relationship.",
    dateRequired: null,
    metadata: {},
  },
  shipped_to: {
    type: "shipped_to",
    tier: "record",
    layer: "logistics",
    fromLabel: "consignor",
    toLabel: "consignee",
    fromKinds: ["corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The subject consignor shipped goods to the named consignee on the recorded date.",
    dateRequired: "start",
    metadata: {},
  },
  operated_by: {
    type: "operated_by",
    tier: "record",
    layer: "shipping",
    fromLabel: "asset",
    toLabel: "operator",
    fromKinds: ["vessel", "corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The named operator exercises a recorded operating role over the subject asset: technical, commercial, ISM, or charter.",
    dateRequired: null,
    metadata: { operatorRole: ["technical", "commercial", "ISM", "charterer"] },
  },
  insured_by: {
    type: "insured_by",
    tier: "record",
    layer: "shipping",
    fromLabel: "insured",
    toLabel: "insurer",
    fromKinds: ["vessel", "corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The named insurer provides insurance cover to the subject vessel or organisation.",
    dateRequired: null,
    metadata: {},
  },
  successor_of: {
    type: "successor_of",
    tier: "record",
    layer: "financial",
    fromLabel: "entity",
    toLabel: "predecessor",
    fromKinds: ["corporate"],
    toKinds: ["corporate"],
    publicDefinition: "The subject entity is recorded as the successor to the named predecessor, typically following re-registration, renaming, or restructuring.",
    dateRequired: null,
    metadata: {},
  },
  acts_for: {
    type: "acts_for",
    tier: "assessment",
    layer: null,
    fromLabel: "instrument",
    toLabel: "principal",
    fromKinds: ["corporate", "person", "vessel"],
    toKinds: ["corporate", "person"],
    publicDefinition: "ASSESSMENT — not a documentary record. This project assesses that the subject entity acts on behalf of the named principal. This is an analytical judgement and should be weighed as such.",
    dateRequired: null,
    metadata: { basis: ["control", "intermediary", "proxy"] },
  },
}

function typesInTier(tier: RelationshipTier): RelationshipType[] {
  const keys = Object.keys(EDGE_TYPES) as RelationshipType[]
  return keys.filter((key) => EDGE_TYPES[key].tier === tier)
}

export const RECORD_TIER_TYPES: RelationshipType[] = typesInTier("record")

export const ASSESSMENT_TIER_TYPES: RelationshipType[] = typesInTier("assessment")
