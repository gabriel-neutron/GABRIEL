/** A durable record of an integrity problem, written into the saved GeoPackage.
 *  Follows the claims/sources/rating_events table pattern. `acknowledgedBy` is free
 *  text: Gabriel has no identity system and git supplies the real attribution. */
export type IntegrityEventKind =
  | "hierarchy-migrated"
  | "multiple-active-hierarchy"
  | "cross-kind-parent"
  | "merge-dropped-edge"
  | "invalid-entry"

/**
 * Runtime companion to the union, in declaration order — the precedent is
 * `ENTITY_KINDS` (`entity.ts:110`). Anything validating a persisted kind checks
 * this allowlist instead of re-deriving the union by hand.
 *
 * `multiple-active-hierarchy` is the same string as in `RELATIONSHIP_VIOLATION_CODES`
 * (`relationship/validate.ts:6-10`) on purpose: one condition, one name, so the
 * validator and the durable record cannot drift into parallel taxonomies.
 *
 * `invalid-entry` is the fifth member, added by owner ruling on 2026-08-03. It is the
 * one kind named after what Gabriel DID rather than what it found: something the project
 * carries could not be validated, and is kept exactly as it stands rather than discarded.
 * It covers the six relationship violation codes that have no kind of their own
 * (`unknown-type`, `date-order`, `invalid-date`, `missing-required-date`,
 * `invalid-metadata`, `invalid-export-override`) and an `integrity_events` row that
 * cannot be read back. Deliberately not named `relationship-violation`: the same ruling
 * requires an unreadable row to come back as an event too, and that row need not be
 * about a relationship at all. Which condition produced it is in `detail`, never guessed
 * from the kind.
 */
export const INTEGRITY_EVENT_KINDS = [
  "hierarchy-migrated",
  "multiple-active-hierarchy",
  "cross-kind-parent",
  "merge-dropped-edge",
  "invalid-entry",
] as const satisfies readonly IntegrityEventKind[]

export type IntegrityEvent = {
  /** Deterministic, so re-detection updates one row instead of accumulating. */
  id: string
  kind: IntegrityEventKind
  /** ISO 8601. Injected, never read from a clock inside a pure function. */
  createdAt: string
  /** One sentence, publishable, naming entities rather than ids. */
  summary: string
  /** Structured payload. Always an object; `{}` when there is nothing to add. */
  detail: Record<string, unknown>
  acknowledgedBy?: string
  acknowledgedAt?: string
  acknowledgedNote?: string
}

const VALID_KINDS = new Set<IntegrityEventKind>(INTEGRITY_EVENT_KINDS)

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** A row may arrive already decoded or still as the JSON text of its column. */
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

/** `detail` is required, so a corrupt or absent payload decodes to `{}` and never to
 *  `undefined` — a value the type says cannot exist. The precedent is `decodeAssessor`
 *  (`ratingEvents.table.ts:20-29`), not `decodeAliases`. */
function decodeDetail(raw: unknown): Record<string, unknown> {
  return parseCandidate(raw) ?? {}
}

/**
 * Fail-closed: anything not structurally valid decodes to `undefined` rather than
 * throwing, because a corrupt integrity row must never make a project unopenable —
 * that would be the control destroying the data it records.
 *
 * `createdAt` is checked for presence, not for ISO shape: dropping an otherwise
 * intact record over an unusual timestamp loses more than it protects.
 *
 * Every key is read with a `!= null` test rather than a key-presence test, because
 * `decodeRow` (`columnDescriptor.ts:63-69`) assigns every descriptor prop
 * unconditionally, so a key is present-but-null on every row that came off disk.
 */
export function decodeIntegrityEvent(raw: unknown): IntegrityEvent | undefined {
  try {
    const candidate = parseCandidate(raw)
    if (candidate == null) return undefined

    const id = nonEmptyString(candidate.id)
    const createdAt = nonEmptyString(candidate.createdAt)
    const summary = nonEmptyString(candidate.summary)
    const kind = nonEmptyString(candidate.kind)
    if (id == null || createdAt == null || summary == null) return undefined
    if (kind == null || !VALID_KINDS.has(kind as IntegrityEventKind)) return undefined

    const acknowledgedBy = nonEmptyString(candidate.acknowledgedBy)
    const acknowledgedAt = nonEmptyString(candidate.acknowledgedAt)
    const acknowledgedNote = nonEmptyString(candidate.acknowledgedNote)

    return {
      id,
      kind: kind as IntegrityEventKind,
      createdAt,
      summary,
      detail: decodeDetail(candidate.detail),
      ...(acknowledgedBy == null ? {} : { acknowledgedBy }),
      ...(acknowledgedAt == null ? {} : { acknowledgedAt }),
      ...(acknowledgedNote == null ? {} : { acknowledgedNote }),
    }
  } catch {
    return undefined
  }
}
