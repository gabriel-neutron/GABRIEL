import type { IntegrityEvent } from "./integrityEvent"

/**
 * Acknowledging an integrity event is **not** a confirmation, and deliberately carries none
 * of the ceremony ADR 0009 puts around credibility `1`. That ceremony exists because a
 * machine-assigned "Confirmed" would launder unverified material into a published dataset;
 * an acknowledgement asserts nothing about the world at all. It records that a person has
 * READ a record Gabriel already made about itself, and the record it annotates stays exactly
 * as minted either way -- the event is not deleted, downgraded, or resolved.
 *
 * So `by` is free text, as `integrityEvent.ts` already says: Gabriel has no identity system
 * and git supplies the real attribution. What is NOT free is whether the acknowledgement
 * survives a reload, which is what the refusals below are about.
 */
export type Acknowledgement = {
  /** Free text. Git attribution is the real record; this is who the analyst says they are. */
  by: string
  note?: string
  /** ISO 8601, injected. Never read from a clock inside a pure function. */
  at: string
}

const trimmed = (value: string | undefined): string => (value ?? "").trim()

/**
 * Returns the SAME array when nothing was written, so a caller can compare by reference to
 * tell a refusal from a no-op edit -- the precedent is `confirmCredibility`, whose store
 * action detects an ineligible claim exactly that way.
 *
 * Three conditions refuse:
 *
 * - **A blank `by` or `at`.** `decodeIntegrityEvent` drops any string that trims to empty,
 *   so a blank acknowledgement would hold for the session and silently vanish on reload,
 *   leaving the panel showing the event as outstanding with nothing to say why.
 * - **An unknown id.**
 * - **An event already acknowledged.** The three fields are single-valued, so a second
 *   acknowledgement overwrites the first attribution leaving no trace it existed -- the same
 *   defect as replacing a subordination edge rather than end-dating it. Refusing loses
 *   nothing and stays open to a ledger-shaped acknowledgement later, which is what
 *   `rating_events` is for claims.
 */
export function acknowledgeIntegrityEvent(
  events: readonly IntegrityEvent[],
  eventId: string,
  ack: Acknowledgement,
): IntegrityEvent[] {
  const by = trimmed(ack.by)
  const at = trimmed(ack.at)
  if (by.length === 0 || at.length === 0) return events as IntegrityEvent[]

  const index = events.findIndex((e) => e.id === eventId)
  if (index === -1) return events as IntegrityEvent[]
  if (events[index].acknowledgedAt != null) return events as IntegrityEvent[]

  const note = trimmed(ack.note)
  const next = [...events]
  next[index] = {
    ...events[index],
    acknowledgedBy: by,
    acknowledgedAt: at,
    // Absent, not empty: the decoder would drop `""` and the field would come back missing
    // anyway, so the in-memory shape matches what disk can actually hold.
    ...(note.length === 0 ? {} : { acknowledgedNote: note }),
  }
  return next
}
