import type { Relationship, RelationshipType } from "./relationship"
import { decodeExportOverride, isSelfConfirmedOverride } from "./relationship"
import { isHierarchyBearing } from "./isHierarchyBearing"
import type { EdgeTypeDefinition, MetadataRule, MetadataSpec } from "./vocabulary"
import { EDGE_TYPES } from "./vocabulary"

export const RELATIONSHIP_VIOLATION_CODES = [
  "unknown-type", "dangling-endpoint", "self-loop", "date-order", "invalid-date",
  "missing-required-date", "invalid-metadata", "multiple-active-hierarchy",
  "invalid-export-override",
] as const

export type RelationshipViolationCode = typeof RELATIONSHIP_VIOLATION_CODES[number]

export type RelationshipViolation = {
  code: RelationshipViolationCode
  relationshipId: string
  detail: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function definitionFor(type: RelationshipType): EdgeTypeDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(EDGE_TYPES, type) ? EDGE_TYPES[type] : undefined
}

function isEnumRule(rule: MetadataRule): rule is readonly string[] {
  return Array.isArray(rule)
}

function quote(value: string): string {
  return "\"" + value + "\""
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return quote(value)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null) return "null"
  return typeof value
}

/**
 * A key present with value `undefined` counts as absent: `decodeRow` assigns
 * every descriptor prop unconditionally, so undefined-valued keys are routine
 * on anything that came off disk.
 */
function metadataProblems(rel: Relationship, spec: MetadataSpec): string[] {
  const metadata = (rel.metadata ?? {}) as Record<string, unknown>
  const rules = spec as Record<string, MetadataRule | undefined>
  const problems: string[] = []

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue

    const rule = rules[key]
    if (rule === undefined) {
      problems.push("key " + quote(key) + " is not declared by type " + quote(rel.type))
      continue
    }
    if (isEnumRule(rule)) {
      if (typeof value !== "string" || !rule.includes(value)) {
        problems.push(
          "key " + quote(key) + " has value " + describeValue(value) +
          ", outside the declared set [" + rule.join(", ") + "]",
        )
      }
      continue
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      problems.push("key " + quote(key) + " must be a finite number, got " + describeValue(value))
      continue
    }
    if (value < rule.min || value > rule.max) {
      problems.push(
        "key " + quote(key) + " has value " + String(value) +
        ", outside the inclusive range " + String(rule.min) + " to " + String(rule.max),
      )
    }
  }

  return problems
}

/**
 * `!= null`, not `=== undefined`: `decodeRow` assigns every descriptor prop
 * unconditionally, so a NULL persisted column arrives as a present key holding
 * null and must read as "no override", not as a malformed one (Trap T6).
 */
function exportOverrideProblem(rel: Relationship, definition: EdgeTypeDefinition | undefined): string | undefined {
  if (rel.exportOverride == null) return undefined
  if (decodeExportOverride(rel.exportOverride) === undefined) {
    // Two causes, two messages: an analyst redoing the ceremony with a second
    // person needs to know which rule fired.
    if (isSelfConfirmedOverride(rel.exportOverride)) {
      return "exportOverride has the same person in proposedBy and confirmedBy " +
        quote(rel.exportOverride.proposedBy) + ", and the two must differ"
    }
    return "exportOverride is malformed: proposedBy, confirmedBy, confirmedAt and rationale " +
      "must all be non-blank strings, and confirmedAt must begin with an ISO 8601 date (YYYY-MM-DD)"
  }
  if (definition !== undefined && definition.tier === "record") {
    return "exportOverride sits on record-tier type " + quote(rel.type) +
      ", where it has no meaning — only assessment-tier edges are export-gated"
  }
  return undefined
}

/**
 * Counts every active hierarchy-bearing parent, corporate ones included — the
 * "Organic" in the name is now the narrower historical case, kept only because
 * the name is referenced by the acceptance criteria.
 */
function countActiveOrganicParents(rels: Relationship[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const rel of rels) {
    if (!isHierarchyBearing(rel)) continue
    counts.set(rel.fromId, (counts.get(rel.fromId) ?? 0) + 1)
  }
  return counts
}

/**
 * `entityIds` omitted skips the dangling-endpoint check — callers that do not
 * yet have the entity set (pure unit tests) still get every other check.
 * At most one violation per edge per code; a corpus-wide rule such as
 * multiple-active-hierarchy still reports once per offending edge.
 */
export function validateRelationships(
  rels: Relationship[],
  entityIds?: Set<string>,
): RelationshipViolation[] {
  const violations: RelationshipViolation[] = []
  const organicParentCounts = countActiveOrganicParents(rels)

  function report(code: RelationshipViolationCode, rel: Relationship, detail: string): void {
    violations.push({ code, relationshipId: rel.id, detail })
  }

  for (const rel of rels) {
    const definition = definitionFor(rel.type)
    if (definition === undefined) {
      report("unknown-type", rel, "type " + quote(rel.type) + " is not a key of EDGE_TYPES")
    }

    if (entityIds !== undefined) {
      const missing: string[] = []
      if (!entityIds.has(rel.fromId)) missing.push("fromId " + quote(rel.fromId))
      if (!entityIds.has(rel.toId)) missing.push("toId " + quote(rel.toId))
      if (missing.length > 0) {
        report("dangling-endpoint", rel, missing.join(" and ") + " is absent from the entity set")
      }
    }

    if (rel.fromId === rel.toId) {
      report("self-loop", rel, "fromId and toId are the same entity " + quote(rel.fromId))
    }

    const malformedDates: string[] = []
    if (rel.startDate != null && !ISO_DATE.test(rel.startDate)) {
      malformedDates.push("startDate " + quote(rel.startDate))
    }
    if (rel.endDate != null && !ISO_DATE.test(rel.endDate)) {
      malformedDates.push("endDate " + quote(rel.endDate))
    }
    if (malformedDates.length > 0) {
      report("invalid-date", rel, malformedDates.join(" and ") + " is not an ISO 8601 date (YYYY-MM-DD)")
    }

    // Only meaningful once both dates are well formed: the comparison is a
    // string compare and "2026-1-5" > "2026-10-01" lexicographically.
    if (
      malformedDates.length === 0 && rel.startDate != null && rel.endDate != null &&
      rel.startDate > rel.endDate
    ) {
      report(
        "date-order", rel,
        "startDate " + quote(rel.startDate) + " is after endDate " + quote(rel.endDate),
      )
    }

    if (definition !== undefined && definition.dateRequired === "start" && rel.startDate == null) {
      report("missing-required-date", rel, "type " + quote(rel.type) + " requires a startDate, which is null")
    }

    if (definition !== undefined) {
      const problems = metadataProblems(rel, definition.metadata)
      if (problems.length > 0) report("invalid-metadata", rel, problems.join("; "))
    }

    if (isHierarchyBearing(rel)) {
      const conflicts = organicParentCounts.get(rel.fromId) ?? 0
      if (conflicts > 1) {
        report(
          "multiple-active-hierarchy", rel,
          "entity " + quote(rel.fromId) + " has " + String(conflicts) +
          " active hierarchy-bearing edges, and may have only one",
        )
      }
    }

    const overrideProblem = exportOverrideProblem(rel, definition)
    if (overrideProblem !== undefined) report("invalid-export-override", rel, overrideProblem)
  }

  return violations
}
