/**
 * A relationship is either a documentary record or an analytical assessment.
 * The tier is a property of the edge type, not of the individual edge, and it
 * drives publication: assessment-tier edges are excluded from the CC-BY export
 * unless a per-edge `ExportOverride` says otherwise.
 */
export type RelationshipTier = "record" | "assessment"

export type RelationshipType =
  | "subordinate_to" | "fields" | "produces" | "corporate_parent" | "owned_by"
  | "beneficially_owned_by" | "officer_of" | "supplies" | "shipped_to"
  | "operated_by" | "insured_by" | "successor_of"   // record tier — 12
  | "acts_for"                                      // assessment tier — 1

/** Flat optional bag. Validity is per type and enforced at runtime by
 *  `validateRelationships`, never by the type system. */
export type RelationshipMetadata = {
  attachment?: "organic" | "attached"                                   // subordinate_to
  role?: "director" | "secretary" | "registered_agent"                  // officer_of
  operatorRole?: "technical" | "commercial" | "ISM" | "charterer"       // operated_by
  basis?: "control" | "intermediary" | "proxy"                          // acts_for
  percent?: number                                                      // corporate_parent, owned_by — 0–100
}

/** Per-edge authorisation to publish one assessment-tier edge under CC-BY (story 80).
 *  Deliberately not in RelationshipMetadata: metadata keys are owned by exactly one
 *  declaring type, and this concern is cross-type. Absent means excluded. */
export type ExportOverride = {
  proposedBy: string
  /** Must differ from proposedBy. This is the two-person aspect; it enforces
   *  ceremony and attribution, not authentication — Gabriel has no identity system. */
  confirmedBy: string
  confirmedAt: string
  rationale: string
}

/**
 * Direction is fixed by the naming rule: every type reads as "A *type* B", so
 * `fromId` is always A. No type is symmetric.
 */
export type Relationship = {
  id: string
  fromId: string
  toId: string
  type: RelationshipType
  /** ISO 8601 (YYYY-MM-DD) or null. An edge with no end date is active. */
  startDate: string | null
  endDate: string | null
  metadata: RelationshipMetadata
  /** Read only by the export gate (Stage 1.5). Undefined on virtually every edge. */
  exportOverride?: ExportOverride
}

export type RelationshipDraft = Omit<Relationship, "id">

const CONFIRMED_AT_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function parseCandidate(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw) as unknown)
    } catch {
      return undefined
    }
  }
  return asRecord(raw)
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

/** Fail-closed: anything not structurally valid decodes to `undefined`, i.e. "no
 *  override", i.e. excluded from export. Never throws. */
export function decodeExportOverride(raw: unknown): ExportOverride | undefined {
  try {
    const candidate = parseCandidate(raw)
    if (candidate === undefined) return undefined

    const proposedBy = nonEmptyString(candidate.proposedBy)
    const confirmedBy = nonEmptyString(candidate.confirmedBy)
    const confirmedAt = nonEmptyString(candidate.confirmedAt)
    const rationale = nonEmptyString(candidate.rationale)
    if (
      proposedBy === undefined || confirmedBy === undefined ||
      confirmedAt === undefined || rationale === undefined
    ) return undefined

    // The two-person rule: a self-confirmed override is no ceremony at all.
    if (proposedBy === confirmedBy) return undefined
    if (!CONFIRMED_AT_DATE_PREFIX.test(confirmedAt)) return undefined

    return { proposedBy, confirmedBy, confirmedAt, rationale }
  } catch {
    return undefined
  }
}

/**
 * Why a rejected override was rejected, for callers that must report the cause
 * rather than just fail closed. `decodeExportOverride` already enforces the
 * two-person rule; this only names it, and reuses the same primitives so the
 * rule and its notion of a "real" name are defined once.
 *
 * A blank name is a structural fault, not a one-person ceremony, so it stays
 * with the malformed case rather than being reported as self-confirmation.
 */
export function isSelfConfirmedOverride(raw: unknown): boolean {
  const candidate = parseCandidate(raw)
  if (candidate === undefined) return false
  const proposedBy = nonEmptyString(candidate.proposedBy)
  return proposedBy !== undefined && proposedBy === nonEmptyString(candidate.confirmedBy)
}
