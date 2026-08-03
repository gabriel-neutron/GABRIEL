import { describe, expect, it } from "vitest"
import { RELATIONSHIP_VIOLATION_CODES } from "@/core/relationship/validate"
import type { IntegrityEvent } from "./integrityEvent"
import { decodeIntegrityEvent, INTEGRITY_EVENT_KINDS } from "./integrityEvent"

/** Every value a corrupt `integrity_events` row can plausibly arrive as, plus the
 *  two shapes the decoder is explicitly asked about: an unknown kind and a detail
 *  column holding text that is not JSON. */
const CORRUPT_INPUTS: unknown[] = [
  undefined,
  null,
  42,
  "x",
  [],
  {},
  {
    id: "ie-unknown-kind",
    kind: "hierarchy-exploded",
    createdAt: "2026-07-31T09:00:00.000Z",
    summary: "A kind no version of this module ever declared.",
    detail: "{}",
  },
  {
    id: "ie-bad-detail",
    kind: "cross-kind-parent",
    createdAt: "2026-07-31T09:00:00.000Z",
    summary: "A row whose detail column is not JSON.",
    detail: "{not json",
  },
]

function isValidEvent(event: IntegrityEvent): boolean {
  return (
    typeof event.id === "string" && event.id.length > 0 &&
    typeof event.createdAt === "string" && event.createdAt.length > 0 &&
    typeof event.summary === "string" && event.summary.length > 0 &&
    (INTEGRITY_EVENT_KINDS as readonly string[]).includes(event.kind)
  )
}

describe("integrityEvent", () => {
  it("locks the integrity event kinds at four", () => {
    expect([...INTEGRITY_EVENT_KINDS]).toEqual([
      "hierarchy-migrated",
      "multiple-active-hierarchy",
      "cross-kind-parent",
      "merge-dropped-edge",
    ])

    // One condition, one name: the kind must be the SAME string the validator
    // emits, not a parallel taxonomy. Asserted as the intersection of the two
    // vocabularies so a rename on either side turns this red instead of
    // silently forking the name.
    const codes = RELATIONSHIP_VIOLATION_CODES as readonly string[]
    const shared = (INTEGRITY_EVENT_KINDS as readonly string[]).filter((kind) => codes.includes(kind))
    expect(shared).toEqual(["multiple-active-hierarchy"])
  })

  it("never throws on a corrupt row, and never decodes detail to undefined", () => {
    for (const raw of CORRUPT_INPUTS) {
      let decoded: IntegrityEvent | undefined
      expect(() => {
        decoded = decodeIntegrityEvent(raw)
      }).not.toThrow()

      if (decoded === undefined) continue

      // `detail` is a required field, so a corrupt payload decodes to `{}` —
      // never to `undefined`, which the type says cannot exist (T9).
      expect(decoded.detail).not.toBeUndefined()
      expect(decoded.detail).toEqual({})
      expect(isValidEvent(decoded)).toBe(true)
    }
  })

  it("rejects a row whose kind is outside the four", () => {
    // Not a stylistic choice: `kind` is typed as the closed union, so a row
    // carrying anything else cannot come back as an IntegrityEvent without the
    // decoder minting a value the type says cannot exist.
    expect(decodeIntegrityEvent(CORRUPT_INPUTS[6])).toBeUndefined()
  })

  it("decodes a well-formed row, keeping its detail payload", () => {
    const decoded = decodeIntegrityEvent({
      id: "ie-1",
      kind: "hierarchy-migrated",
      createdAt: "2026-07-31T09:00:00.000Z",
      summary: "999 subordinate_to edges and 13 corporate_parent edges were minted.",
      detail: JSON.stringify({ minted: 1012 }),
    })

    expect(decoded).not.toBeUndefined()
    expect(decoded?.kind).toBe("hierarchy-migrated")
    expect(decoded?.detail).toEqual({ minted: 1012 })
    expect(decoded?.acknowledgedAt).toBeUndefined()
  })
})
