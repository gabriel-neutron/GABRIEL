import type { EntityKind } from "@/core/entity/entity"
import type { RelationshipMetadata, RelationshipTier, RelationshipType } from "./relationship"

/**
 * Bumped by the amendment procedure, which edits this file and its test together.
 * Adding to the *initial* list is authoring, not amendment — which is why the
 * thirteen entries below cost nothing here and would cost a version bump later.
 */
export const EDGE_VOCABULARY_VERSION = "1.0.0"

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
    publicDefinition: "The subject unit is a subordinate element of the named formation in its order of battle.",
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
    publicDefinition: "The subject unit is equipped with, and operates, the named class of equipment.",
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
    publicDefinition: "The subject facility manufactures or assembles the named class of equipment.",
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
    publicDefinition: "The subject supplier provides goods or services to the named customer.",
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
